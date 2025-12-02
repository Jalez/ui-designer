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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch credit history from database
    const stmt = db.prepare(`
      SELECT history_id, amount, reason, service_name, created_at
      FROM credit_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const history = stmt.all(userId, limit, offset);

    // Get total count
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM credit_history WHERE user_id = ?");
    const { count } = countStmt.get(userId) as { count: number };

    return NextResponse.json({ 
      history,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error("Error fetching credit history:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit history" },
      { status: 500 }
    );
  }
}

