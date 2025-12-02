import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getCreditService } from "@/app/api/_lib/services/creditService";
import type { ServiceUsageParams } from "@/app/api/_lib/services/creditService/types";

export const POST = withAdminOrUserAuth(async (request: NextRequest, _context, session: Session, isSelf) => {
  try {
    const userId = session.userId;
    const body = await request.json();

    const creditService = getCreditService();

    // Check if this is a self-update (user deducting credits for service usage)
    if (isSelf) {
      // Self-update: only allow credit deduction for service usage
      const { serviceName } = body;
      if (!serviceName) {
        return NextResponse.json({ error: "Service name is required" }, { status: 400 });
      }

      // Prepare service usage parameters
      const usageParams: ServiceUsageParams = {
        userId,
        serviceName,
        fileSizeMb: body.fileSizeMb,
        pageCount: body.pageCount,
        metadata: body.metadata,
      };

      // Attempt to deduct credits
      const success = await creditService.deductCredits(usageParams);

      if (!success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            success: false,
          },
          { status: 402 },
        ); // Payment Required status code for insufficient credits
      }

      // Get updated credits after deduction
      const userCredits = await creditService.getUserCredits({ userId });

      return NextResponse.json({
        success: true,
        creditsRemaining: userCredits?.currentCredits || 0,
        message: "Credits deducted successfully",
      });
    } else {
      // Admin update: allow full credit management
      const { credits } = body;

      // Validate required fields
      if (typeof credits !== "number" || credits < 0 || !Number.isInteger(credits)) {
        return NextResponse.json({ error: "credits must be a non-negative integer" }, { status: 400 });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userId)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      // Use creditService for admin credit updates
      const result = await creditService.adminUpdateCredits({
        userId,
        credits,
        adminUserId: session.userId,
        adminEmail: session?.user?.email || "unknown",
      });

      return NextResponse.json({
        success: true,
        message: `Credits updated successfully for ${userId}`,
        previousCredits: result.previousCredits,
        newCredits: result.newCredits,
      });
    }
  } catch (error) {
    console.error("Error updating credits:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
