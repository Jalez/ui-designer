import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminAuth } from "@/app/api/_lib/middleware/admin";
import { getAllCreditUsageData, getAllServiceBreakdown } from "@/app/api/_lib/services/creditService";
import { getAllModelUsage } from "@/app/api/_lib/services/modelService";

// GET - Fetch credit usage analytics (admin only - all users)
export const GET = withAdminAuth(async (request: NextRequest, _context, session: Session) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = session.userId;
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Calculate the date threshold in UTC for the service functions
    const now = new Date();
    const utcDateThreshold = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

    // Get credit usage data over time (includes date filling logic)
    const filledData = await getAllCreditUsageData({ days, userId: userId || undefined });

    // Calculate totals from actual usage data (excluding filled zeros)
    const totalCredits = filledData.reduce((sum, item) => sum + (Number(item.credits) || 0), 0);
    const totalMonetaryValue = filledData.reduce((sum, item) => sum + (Number(item.monetary_value) || 0), 0);

    // Get service usage breakdown
    const serviceBreakdown = await getAllServiceBreakdown({
      dateThreshold: utcDateThreshold,
      userId: userId || undefined,
    });

    // Get model usage statistics
    const modelUsage = await getAllModelUsage({ dateThreshold: utcDateThreshold, userId: userId || undefined });

    return NextResponse.json({
      data: filledData,
      userId,
      days,
      totalCredits,
      totalMonetaryValue,
      modelUsage,
      serviceBreakdown,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
