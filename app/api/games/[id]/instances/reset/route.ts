import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { extractRows } from "@/app/api/_lib/db/shared";
import { getGameById } from "@/app/api/_lib/services/gameService";
import { purgeGameDrawboardArtifacts } from "@/app/api/_lib/services/drawboardArtifactCacheService";

function getWsAdminUrl(): string {
  const explicit = process.env.WS_SERVER_HTTP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const configuredWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configuredWsUrl) {
    return configuredWsUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/$/, "");
  }

  return "http://localhost:3100";
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const game = await getGameById(id, actorIdentifiers);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_edit) {
    return NextResponse.json({ error: "No edit access for this game" }, { status: 403 });
  }

  const sql = await getSql();
  const result = await sql.query(
    "DELETE FROM game_instances WHERE game_id = $1 RETURNING id",
    [id],
  );

  const deletedCount = extractRows(result).length;
  const deletedArtifactCount = await purgeGameDrawboardArtifacts(id);

  let wsInvalidation: Record<string, unknown> | null = null;
  try {
    const wsResponse = await fetch(`${getWsAdminUrl()}/admin/reset-game-instances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ws-service-token": process.env.WS_SERVICE_TOKEN || "",
      },
      body: JSON.stringify({
        gameId: id,
        deletedCount,
        actorUserId: session.userId,
        actorUserEmail: session.user.email,
        actorUserName: session.user.name,
        reason: "creator_reset_all_instances",
      }),
      cache: "no-store",
    });
    wsInvalidation = await wsResponse.json().catch(() => null);
    if (!wsResponse.ok) {
      console.error("[reset-game-instances:ws-invalidation-failed]", wsInvalidation);
    }
  } catch (error) {
    console.error("[reset-game-instances:ws-invalidation-error]", error);
  }

  return NextResponse.json({
    gameId: id,
    deletedCount,
    deletedArtifactCount,
    wsInvalidation,
    message: deletedCount > 0 ? "Game instances reset." : "No game instances to reset.",
  });
}
