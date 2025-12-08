import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Route context type for middleware - represents Next.js App Router handler context
 * Can contain params, searchParams, and other route-specific data
 */
export interface MiddlewareContext {
  params?: Promise<Record<string, string | string[]>>;
  searchParams?: Promise<Record<string, string | string[]>>;
  [key: string]: unknown;
}

/**
 * Wrapper function to protect authenticated routes
 * Checks authentication before executing the handler
 *
 * Supports both simple handlers and handlers with dynamic params:
 * - Simple: withAuth(async (request) => { ... })
 * - With params: withAuth(async (request, { params }) => { ... })
 * - With session: withAuth(async (request, { params }, session) => { ... })
 *
 * @param handler - The route handler function to protect
 * @returns A protected route handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth(
  handler: (request: NextRequest, context: any, session?: Session) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      const session = (await getServerSession(authOptions)) as Session;

      // Check authentication
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      // User is authenticated, proceed with the handler
      return await handler(request, context, session);
    } catch (error) {
      console.error("Auth error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/**
 * Get the current authenticated session (for use inside protected handlers)
 * Returns null if not authenticated
 */
export async function getSession(): Promise<Session | null> {
  try {
    const session = (await getServerSession(authOptions)) as Session;
    if (!session?.user?.email) {
      return null;
    }
    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}


