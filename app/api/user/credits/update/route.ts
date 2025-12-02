import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/middleware/auth";
import db from "@/lib/db";
import { z } from "zod";

const updateCreditsSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin();

    const body = await request.json();
    const { userId, amount, reason } = updateCreditsSchema.parse(body);

    // Update user credits
    const updateStmt = db.prepare(`
      UPDATE users 
      SET current_credits = current_credits + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `);
    updateStmt.run(amount, userId);

    // Record in credit history
    const historyStmt = db.prepare(`
      INSERT INTO credit_history (history_id, user_id, amount, reason, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const historyId = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    historyStmt.run(historyId, userId, amount, reason || "Admin update");

    // Get updated credits
    const selectStmt = db.prepare("SELECT current_credits FROM users WHERE user_id = ?");
    const user = selectStmt.get(userId) as { current_credits: number };

    return NextResponse.json({ 
      success: true,
      credits: user.current_credits 
    });
  } catch (error) {
    console.error("Error updating credits:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message === "Forbidden - Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: "Failed to update credits" },
      { status: 500 }
    );
  }
}

