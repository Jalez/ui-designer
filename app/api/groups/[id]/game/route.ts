import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLtiSession } from "@/lib/lti/session";
import { getSql } from "@/app/api/_lib/db";

function mapRow(row: Record<string, any>) {
  return {
    id: row.id,
    userId: row.user_id,
    mapName: row.map_name,
    title: row.title,
    progressData: row.progress_data ?? {},
    isPublic: row.is_public ?? false,
    shareToken: row.share_token ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    hideSidebar: row.hide_sidebar ?? false,
    groupId: row.group_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/groups/[id]/game
 * Returns the shared game for this group, or null if none exists yet.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  const session = await getServerSession(authOptions);
  const ltiSession = session ? null : await getLtiSession();

  if (!session?.user && !ltiSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = await getSql();
  const result = await sql.query(
    "SELECT * FROM projects WHERE group_id = $1 ORDER BY created_at ASC LIMIT 1",
    [groupId]
  );
  const rows = (result as any).rows ?? result;
  if (!rows?.length) {
    return NextResponse.json({ game: null });
  }

  return NextResponse.json({ game: mapRow(rows[0]) });
}

/**
 * POST /api/groups/[id]/game
 * Creates the shared game for this group (idempotent — returns existing if already created).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  const session = await getServerSession(authOptions);
  const ltiSession = session ? null : await getLtiSession();

  if (!session?.user && !ltiSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session?.userId || session?.user?.email || ltiSession?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Could not determine user" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mapName = body.mapName || "all";

  const sql = await getSql();

  // Verify group exists
  const groupResult = await sql.query("SELECT id, name FROM groups WHERE id = $1", [groupId]);
  const groupRows = (groupResult as any).rows ?? groupResult;
  if (!groupRows?.length) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const groupName = groupRows[0].name;

  // Upsert: return existing game or create a new one
  const existing = await sql.query(
    "SELECT * FROM projects WHERE group_id = $1 ORDER BY created_at ASC LIMIT 1",
    [groupId]
  );
  const existingRows = (existing as any).rows ?? existing;
  if (existingRows?.length) {
    return NextResponse.json({ game: mapRow(existingRows[0]) });
  }

  const created = await sql.query(
    `INSERT INTO projects (user_id, map_name, title, progress_data, group_id)
     VALUES ($1, $2, $3, '{}', $4)
     RETURNING *`,
    [userId, mapName, groupName, groupId]
  );
  const createdRows = (created as any).rows ?? created;

  return NextResponse.json({ game: mapRow(createdRows[0]) }, { status: 201 });
}
