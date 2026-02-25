import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getCreditService } from "@/app/api/_lib/services/creditService";
import { getUserPlan } from "@/app/api/_lib/services/planService";
import { ensureUserInitialized } from "@/app/api/_lib/services/userService";

export const GET = withAdminOrUserAuth(async (_request: NextRequest, _context, session: Session) => {
  try {
    const userId = session.userId;

    // Initialize user if not exists
    await ensureUserInitialized(userId);

    const creditService = getCreditService();

    // Get user credits and plan
    const [userCredits, userPlan] = await Promise.all([
      creditService.getUserCredits({ userId: userId }),
      getUserPlan(userId),
    ]);

    if (!userCredits || !userPlan) {
      return NextResponse.json({ error: "User credits not found" }, { status: 404 });
    }

    return NextResponse.json({
      credits: userCredits.currentCredits,
      totalEarned: userCredits.totalCreditsEarned,
      totalUsed: userCredits.totalCreditsUsed,
      lastResetDate: userCredits.lastResetDate,
    });
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
