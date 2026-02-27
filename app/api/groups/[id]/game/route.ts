import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLtiSession } from "@/lib/lti/session";
import { getSql } from "@/app/api/_lib/db";

function summarizeProgressData(progressData: Record<string, any> | undefined) {
  const levels = Array.isArray(progressData?.levels) ? progressData.levels : [];
  return {
    hasLevels: levels.length > 0,
    levelCount: levels.length,
    levelNames: levels.slice(0, 5).map((l: any) => l?.name).filter(Boolean),
    htmlLen: levels.reduce((acc: number, l: any) => acc + (typeof l?.code?.html === "string" ? l.code.html.length : 0), 0),
    cssLen: levels.reduce((acc: number, l: any) => acc + (typeof l?.code?.css === "string" ? l.code.css.length : 0), 0),
    jsLen: levels.reduce((acc: number, l: any) => acc + (typeof l?.code?.js === "string" ? l.code.js.length : 0), 0),
  };
}

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
    accessWindowEnabled: row.access_window_enabled ?? false,
    accessStartsAt: row.access_starts_at ?? null,
    accessEndsAt: row.access_ends_at ?? null,
    accessKeyRequired: row.access_key_required ?? false,
    hasAccessKey: Boolean(row.access_key),
    collaborationMode: row.collaboration_mode ?? "individual",
    isOwner: false,
    isCollaborator: false,
    canEdit: true,
    canManageCollaborators: false,
    canRemoveCollaborators: false,
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
  console.log(`[groups.game:get] groupId=${groupId}`);

  const session = await getServerSession(authOptions);
  const ltiSession = session ? null : await getLtiSession();

  if (!session?.user && !ltiSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = await getSql();
  const result = await sql.query(
    "SELECT * FROM projects WHERE group_id = $1 AND collaboration_mode = 'group' ORDER BY created_at ASC LIMIT 1",
    [groupId]
  );
  const rows = (result as any).rows ?? result;
  if (!rows?.length) {
    console.log(`[groups.game:get] groupId=${groupId} game=none`);
    return NextResponse.json({ game: null });
  }

  console.log(
    `[groups.game:get] groupId=${groupId} gameId=${rows[0].id} summary=${JSON.stringify(summarizeProgressData(rows[0].progress_data || {}))}`
  );

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
  console.log(`[groups.game:post] groupId=${groupId}`);

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
    "SELECT * FROM projects WHERE group_id = $1 AND collaboration_mode = 'group' ORDER BY created_at ASC LIMIT 1",
    [groupId]
  );
  const existingRows = (existing as any).rows ?? existing;
  if (existingRows?.length) {
    console.log(`[groups.game:post] groupId=${groupId} reusedGameId=${existingRows[0].id}`);
    return NextResponse.json({ game: mapRow(existingRows[0]) });
  }

  const created = await sql.query(
    `INSERT INTO projects (user_id, map_name, title, progress_data, group_id, collaboration_mode)
     VALUES ($1, $2, $3, '{}', $4, 'group')
     RETURNING *`,
    [userId, mapName, groupName, groupId]
  );
  const createdRows = (created as any).rows ?? created;

  console.log(`[groups.game:post] groupId=${groupId} createdGameId=${createdRows[0].id} userId=${userId}`);

  return NextResponse.json({ game: mapRow(createdRows[0]) }, { status: 201 });
}

/**
 * PATCH /api/groups/[id]/game
 * Updates shared game data for this group.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  const session = await getServerSession(authOptions);
  const ltiSession = session ? null : await getLtiSession();

  if (!session?.user && !ltiSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const progressData = body?.progressData;

  console.log(
    `[groups.game:patch:recv] groupId=${groupId} summary=${JSON.stringify(summarizeProgressData(progressData as Record<string, any>))}`
  );

  if (!progressData || typeof progressData !== "object" || Array.isArray(progressData)) {
    return NextResponse.json({ error: "Invalid progressData" }, { status: 400 });
  }

  const sql = await getSql();
  const existing = await sql.query(
    "SELECT * FROM projects WHERE group_id = $1 AND collaboration_mode = 'group' ORDER BY created_at ASC LIMIT 1",
    [groupId]
  );
  const existingRows = (existing as any).rows ?? existing;
  if (!existingRows?.length) {
    console.log(`[groups.game:patch] groupId=${groupId} game=not-found`);
    return NextResponse.json({ error: "Group game not found" }, { status: 404 });
  }

  const updated = await sql.query(
    `UPDATE projects
     SET progress_data = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [existingRows[0].id, progressData]
  );
  const updatedRows = (updated as any).rows ?? updated;

  console.log(
    `[groups.game:patch:ok] groupId=${groupId} gameId=${updatedRows[0].id} summary=${JSON.stringify(summarizeProgressData(updatedRows[0].progress_data || {}))}`
  );

  return NextResponse.json({ game: mapRow(updatedRows[0]) });
}
