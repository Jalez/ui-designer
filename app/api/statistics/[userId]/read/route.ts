import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getUserService } from "@/app/api/_lib/services/userService";

// GET - Fetch user statistics (user or admin access)
export const GET = withAdminOrUserAuth(async (request: NextRequest, _context, session: Session) => {
  try {
    const userId = session.userId;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Calculate the date threshold in UTC for the service functions that need it
    const now = new Date();
    const utcDateThreshold = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

    // Get service usage breakdown

    // Get model usage statistics

    // Get user credits info

    // Get user plan info

    // Get user details
    const userService = getUserService();
    const userDetails = await userService.getUserById(userId);

    // Combine user info
    const userInfo = {
      userId,
      email: userDetails?.email || userId,
      name: userDetails?.name || userDetails?.email || userId,

    };

    return NextResponse.json({
      userId,
      userEmail: userInfo.email,
      days,
      userInfo,
    });
  } catch (error) {
    console.error("User statistics API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
