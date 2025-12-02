import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { isAdmin } from "@/app/api/_lib/services/adminService";
import { withAuth } from "./auth";

/**
 * Wrapper function to protect admin routes
 * Checks authentication and admin status before executing the handler
 *
 * Supports both simple handlers and handlers with dynamic params:
 * - Simple: withAdminAuth(async (request) => { ... })
 * - With params: withAdminAuth(async (request, { params }) => { ... })
 * - With session: withAdminAuth(async (request, { params }, session) => { ... })
 *
 * @param handler - The route handler function to protect
 * @returns A protected route handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAdminAuth(
  handler: (request: NextRequest, context: any, session?: Session) => Promise<NextResponse>,
) {
  return withAuth(async (request: NextRequest, context: any, session?: Session) => {
    try {
      // Check admin status using the session passed from withAuth
      const isUserAdmin = await isAdmin(session.userId);
      if (!isUserAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }

      // User is authenticated and is an admin, proceed with the handler
      return await handler(request, context, session);
    } catch (error) {
      console.error("Admin auth error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

/**
 * Wrapper function to allow access for admin users or the target user themselves
 * Checks authentication and either admin status OR if the user is accessing their own data
 *
 * Always passes an isSelf flag to handlers for conditional logic:
 * - For read operations: handlers can ignore the flag
 * - For update operations: handlers can use the flag to restrict self-updates
 *
 * Requires context with params containing userId for user identification:
 * - With params: withAdminOrUserAuth(async (request, { params }, session, isSelf) => { ... })
 *
 * @param handler - The route handler function to protect (receives isSelf flag)
 * @returns A protected route handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAdminOrUserAuth(
  handler: (request: NextRequest, context: any, session?: Session, isSelf?: boolean) => Promise<NextResponse>,
) {
  return withAuth(async (request: NextRequest, context: any, session?: Session) => {
    try {
      const userId = session.userId;
      const targetUserId = session.userId;

      // Check if user is admin OR accessing their own data
      const isUserAdmin = await isAdmin(userId);
      const isSelf = userId === targetUserId;

      if (!isUserAdmin && !isSelf) {
        return NextResponse.json(
          { error: "Access denied. You can only access your own data or must be an admin." },
          { status: 403 },
        );
      }

      // User is authenticated and has permission, proceed with the handler
      return await handler(request, context, session, isSelf);
    } catch (error) {
      console.error("Admin or user auth error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
