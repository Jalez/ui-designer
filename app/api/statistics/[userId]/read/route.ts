import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getCreditUsageData, getServiceBreakdown, getUserCredits } from "@/app/api/_lib/services/creditService";
import { getModelUsage } from "@/app/api/_lib/services/modelService";
import { getUserPlanInfo } from "@/app/api/_lib/services/planService";
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

    // Get credit usage data over time (includes date filling logic)
    const filledData = await getCreditUsageData(userId, days);

    // Calculate totals from actual usage data
    const totalCredits = filledData.reduce((sum, item) => sum + (Number(item.credits) || 0), 0);
    const totalMonetaryValue = filledData.reduce((sum, item) => sum + (Number(item.monetary_value) || 0), 0);

    // Get service usage breakdown
    const serviceBreakdown = await getServiceBreakdown(userId, utcDateThreshold);

    // Get model usage statistics
    const modelUsage = await getModelUsage(userId, utcDateThreshold);

    // Get user credits info
    const creditsInfo = await getUserCredits({ userId });

    // Get user plan info
    const planInfo = await getUserPlanInfo(userId);

    // Get user details
    const userService = getUserService();
    const userDetails = await userService.getUserById(userId);

    // Combine user info
    const userInfo = {
      userId,
      email: userDetails?.email || userId,
      name: userDetails?.name || userDetails?.email || userId,
      current_credits: creditsInfo?.currentCredits || 0,
      plan_name: planInfo?.plan_name || null,
      joined_at: planInfo?.joined_at || null,
    };

    return NextResponse.json({
      data: filledData,
      userId,
      userEmail: userInfo.email,
      days,
      totalCredits,
      totalMonetaryValue,
      modelUsage,
      serviceBreakdown,
      userInfo,
    });
  } catch (error) {
    console.error("User statistics API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
