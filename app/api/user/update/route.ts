import { type NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/middleware/admin";
import { getUserService } from "@/app/api/_lib/services/userService";
import type { Session } from "next-auth";

// PUT - Update user role (promote/demote admin)
export const PUT = withAdminAuth(async (request: NextRequest, context: any, session?: Session, isSelfUpdate?: boolean) => {
  try {
    const userId = session?.userId;
    const action = await request.json();

    const userService = getUserService();

    if (action === "promote") {
      const result = await userService.promoteUserToAdmin(userId);

      return NextResponse.json({
        message: `User ${result.email} has been promoted to admin`,
        action: "promote"
      });

    } else if (action === "demote") {
      const result = await userService.demoteUserFromAdmin(userId);

      return NextResponse.json({
        message: `Admin privileges have been removed from ${result.email}`,
        action: "demote"
      });

    } else {
      return NextResponse.json({ error: "Invalid action. Must be 'promote' or 'demote'" }, { status: 400 });
    }

  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
