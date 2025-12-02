import { type NextRequest, NextResponse } from "next/server";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getUserPlanDetails } from "@/app/api/_lib/services/planService";

// GET - Get user's current plan information
export const GET = withAdminOrUserAuth(async (request: NextRequest, context) => {
  try {
    const userEmail = context.params.userEmail;
    const planDetails = await getUserPlanDetails(userEmail);

    return NextResponse.json(planDetails);

  } catch (error) {
    console.error("User plan read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
