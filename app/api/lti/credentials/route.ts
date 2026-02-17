import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { randomBytes, randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = await getSql();

  // Return existing credentials or auto-generate new ones
  const existing = await sql.query(
    "SELECT consumer_key, consumer_secret FROM lti_credentials WHERE user_id = $1",
    [session.userId]
  );

  if ((existing as any).rows?.length > 0 || (Array.isArray(existing) && existing.length > 0)) {
    const row = (existing as any).rows?.[0] ?? (existing as any)[0];
    return NextResponse.json({
      consumerKey: row.consumer_key,
      consumerSecret: row.consumer_secret,
    });
  }

  // Generate new credentials
  const consumerKey = randomUUID();
  const consumerSecret = randomBytes(32).toString("hex");

  await sql.query(
    `INSERT INTO lti_credentials (user_id, consumer_key, consumer_secret)
     VALUES ($1, $2, $3)`,
    [session.userId, consumerKey, consumerSecret]
  );

  return NextResponse.json({ consumerKey, consumerSecret });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (body.action !== "regenerate") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const sql = await getSql();

  const newSecret = randomBytes(32).toString("hex");

  const result = await sql.query(
    `UPDATE lti_credentials
     SET consumer_secret = $1
     WHERE user_id = $2
     RETURNING consumer_key, consumer_secret`,
    [newSecret, session.userId]
  );

  const rows = (result as any).rows ?? (result as any);
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No credentials found — call GET first" }, { status: 404 });
  }

  return NextResponse.json({
    consumerKey: rows[0].consumer_key,
    consumerSecret: rows[0].consumer_secret,
  });
}
