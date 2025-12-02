import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/api/_lib/middleware/auth";
import db from "@/lib/db/sqlite";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user credits from database
    const stmt = db.prepare("SELECT current_credits FROM users WHERE user_id = ?");
    const user = stmt.get(userId) as { current_credits: number } | undefined;

    if (!user) {
      // Return 0 credits for users that don't exist yet
      return NextResponse.json({ 
        credits: 0,
        totalEarned: 0,
        totalUsed: 0
      });
    }

    return NextResponse.json({ 
      credits: user.current_credits || 0,
      totalEarned: 0, // Can be calculated from credit_history
      totalUsed: 0 // Can be calculated from credit_history
    });
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}

