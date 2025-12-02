import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getUserService } from "@/app/api/_lib/services/userService";

// DELETE - Remove user completely from the system
export const DELETE = withAdminOrUserAuth(
  async (request: NextRequest, context: any, session?: Session, isSelf?: boolean) => {
    try {
      const userId = session?.userId;

      const userService = getUserService();
      const result = await userService.deleteUser(userId);

      return NextResponse.json({
        message: `User ${result.email} has been completely removed from the system`,
        action: "delete",
      });
    } catch (error) {
      console.error("Admin user delete error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  },
);
