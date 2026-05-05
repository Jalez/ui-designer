import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminAuth } from "@/app/api/_lib/middleware/admin";

// GET - Fetch credit usage analytics (admin only - all users)
export const GET = withAdminAuth(async (request: NextRequest, _context, session: Session) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = session.userId;
    const days = parseInt(searchParams.get("days") || "30", 10);

    return NextResponse.json({
      userId,
      days,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
