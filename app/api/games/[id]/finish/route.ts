import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { evaluateGameRouteAccess, getGameById, getGameByIdForGameplay } from "@/app/api/_lib/services/gameService";
import { resolveAccessKeyForGame } from "@/app/api/_lib/services/gameService/accessCookie";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { finalizeGameAttempt } from "@/app/api/_lib/services/gameStatisticsService";
import {
  accessDenied,
  getRows,
  resolveInstance,
  shouldEnforceAccess,
} from "../instance/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  let body: {
    points?: number;
    maxPoints?: number;
    pointsByLevel?: Record<string, { points?: number; maxPoints?: number; accuracy?: number; bestTime?: string; scenarios?: { scenarioId: string; accuracy: number }[] }>;
    progressData?: Record<string, unknown>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const points = typeof body.points === "number" ? body.points : 0;
  const maxPoints = typeof body.maxPoints === "number" ? body.maxPoints : 0;
  if (maxPoints <= 0) {
    return NextResponse.json({ error: "Invalid points: maxPoints must be positive" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const enforceGameplayAccess = shouldEnforceAccess(request);
  const actorIdentifiers = session?.user?.email
    ? ([session.userId, session.user.email].filter(Boolean) as string[])
    : [];
  if (!session?.user?.email && !enforceGameplayAccess) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = enforceGameplayAccess
    ? await getGameByIdForGameplay(gameId, actorIdentifiers.length ? actorIdentifiers : undefined)
    : await getGameById(gameId, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (session?.user?.email && !game.can_edit && !game.is_public) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  if (enforceGameplayAccess) {
    const isOwnerOrCollaborator = Boolean(session?.user?.email && (game.can_edit || game.is_owner));
    if (!isOwnerOrCollaborator) {
      const resolvedKey = resolveAccessKeyForGame(request, {
        id: game.id,
        access_key_required: game.access_key_required,
        access_key: game.access_key,
      });
      const accessError = evaluateGameRouteAccess(game, resolvedKey);
      if (accessError) {
        return accessDenied(accessError);
      }
    }
  }

  if (!session?.user?.email && game.collaboration_mode === "group") {
    return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
  }

  const mode = game.collaboration_mode === "group" ? "group" : "individual";
  const actorUserId = session?.user?.email
    ? (await getOrCreateUserByEmail(session.user.email)).id
    : request.nextUrl.searchParams.get("guestId");
  if (!actorUserId) {
    return NextResponse.json({ error: "guestId is required for public individual games" }, { status: 400 });
  }

  const resolved = await resolveInstance(request, gameId, actorUserId, mode, Boolean(game.can_edit));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const existing = (resolved.instance.progressData || {}) as Record<string, unknown>;
  const incomingProgressData =
    body.progressData && typeof body.progressData === "object" && !Array.isArray(body.progressData)
      ? body.progressData
      : {};
  const existingGameplayTelemetry =
    existing.gameplayTelemetry && typeof existing.gameplayTelemetry === "object" && !Array.isArray(existing.gameplayTelemetry)
      ? existing.gameplayTelemetry as Record<string, unknown>
      : {};
  const incomingGameplayTelemetry =
    incomingProgressData.gameplayTelemetry &&
    typeof incomingProgressData.gameplayTelemetry === "object" &&
    !Array.isArray(incomingProgressData.gameplayTelemetry)
      ? incomingProgressData.gameplayTelemetry as Record<string, unknown>
      : {};
  const finishedAt = new Date();
  const progressData: Record<string, unknown> = {
    ...existing,
    ...incomingProgressData,
    ...((existingGameplayTelemetry.users || incomingGameplayTelemetry.users)
      ? {
          gameplayTelemetry: {
            ...existingGameplayTelemetry,
            ...incomingGameplayTelemetry,
            users: {
              ...(existingGameplayTelemetry.users && typeof existingGameplayTelemetry.users === "object"
                ? existingGameplayTelemetry.users
                : {}),
              ...(incomingGameplayTelemetry.users && typeof incomingGameplayTelemetry.users === "object"
                ? incomingGameplayTelemetry.users
                : {}),
            },
          },
        }
      : {}),
  };
  if (mode === "group") {
    const existingUserFinishStates =
      existing.userFinishStates && typeof existing.userFinishStates === "object" && !Array.isArray(existing.userFinishStates)
        ? existing.userFinishStates as Record<string, unknown>
        : {};
    progressData.userFinishStates = {
      ...existingUserFinishStates,
      [actorUserId]: {
        finishedAt: finishedAt.toISOString(),
        finalScore: { points, maxPoints },
      },
    };
    delete progressData.finishedAt;
    delete progressData.finalScore;
  } else {
    progressData.finishedAt = finishedAt.toISOString();
    progressData.finalScore = { points, maxPoints };
  }
  if (body.pointsByLevel && typeof body.pointsByLevel === "object" && !Array.isArray(body.pointsByLevel)) {
    progressData.pointsByLevel = body.pointsByLevel;
  }

  const sql = await getSql();
  // For group mode, atomically merge userFinishStates so that concurrent submissions
  // from different group members do not overwrite each other (last-write-wins blind
  // UPDATE would silently drop one member's entry).
  const updatedResult = mode === "group"
    ? await sql.query(
        `UPDATE game_instances
         SET progress_data = (
           $2::jsonb
           || jsonb_build_object(
             'pointsByLevel',
             COALESCE(progress_data->'pointsByLevel', '{}'::jsonb)
             || COALESCE($2->'pointsByLevel', '{}'::jsonb),
             'gameplayTelemetry',
             CASE
               WHEN COALESCE(progress_data->'gameplayTelemetry'->'users', '{}'::jsonb) = '{}'::jsonb
                    AND COALESCE($2->'gameplayTelemetry'->'users', '{}'::jsonb) = '{}'::jsonb
                 THEN COALESCE(progress_data->'gameplayTelemetry', $2->'gameplayTelemetry', 'null'::jsonb)
               ELSE COALESCE(progress_data->'gameplayTelemetry', '{}'::jsonb)
                    || COALESCE($2->'gameplayTelemetry', '{}'::jsonb)
                    || jsonb_build_object(
                      'users',
                      COALESCE(progress_data->'gameplayTelemetry'->'users', '{}'::jsonb)
                      || COALESCE($2->'gameplayTelemetry'->'users', '{}'::jsonb)
                    )
             END,
             'userFinishStates',
             COALESCE(progress_data->'userFinishStates', '{}'::jsonb)
             || ($2->'userFinishStates')
           )
         ),
         updated_at = NOW()
         WHERE id = $1
         RETURNING id, progress_data`,
        [resolved.instance.id, progressData],
      )
    : await sql.query(
        "UPDATE game_instances SET progress_data = $2, updated_at = NOW() WHERE id = $1 RETURNING id, progress_data",
        [resolved.instance.id, progressData],
      );
  const updatedRows = getRows(updatedResult);
  const persistedProgressData =
    (updatedRows[0] as { progress_data?: Record<string, unknown> })?.progress_data ?? progressData;

  const actorDisplayName = session?.user?.name || session?.user?.email || (actorUserId ? "Guest" : null);
  const resolvedUserId = mode === "individual" ? actorUserId : null;
  const resolvedGroupId = mode === "group" ? (resolved.instance.groupId ?? request.nextUrl.searchParams.get("groupId")) : null;

  const statistics = await finalizeGameAttempt({
    gameId,
    mapName: game.map_name,
    instanceId: String(resolved.instance.id),
    scope: mode,
    userId: resolvedUserId,
    groupId: resolvedGroupId,
    playerDisplayName: actorDisplayName,
    points,
    maxPoints,
    progressData: persistedProgressData,
    pointsByLevel: body.pointsByLevel,
    finishedAt,
  });

  if (resolvedGroupId) {
    const memberResult = await sql.query(
      `SELECT COALESCE(NULLIF(TRIM(u.name), ''), u.email, gm.user_id::text) AS display_name
       FROM group_members gm
       LEFT JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY display_name ASC`,
      [resolvedGroupId],
    );
    const participantResult = await sql.query(
      `SELECT COALESCE(NULLIF(TRIM(display_name), ''), user_id::text, 'unknown') AS display_name
       FROM game_attempt_participants
       WHERE attempt_id = $1
       ORDER BY display_name ASC`,
      [statistics.attemptId],
    );
    console.log(
      `[finish-membership] gameId=${gameId} groupId=${resolvedGroupId} instanceId=${resolved.instance.id} expected=${JSON.stringify(getRows(memberResult).map((row) => String(row.display_name)))} actual=${JSON.stringify(getRows(participantResult).map((row) => String(row.display_name)))}`
    );
  } else {
    console.log(
      `[finish-membership] gameId=${gameId} groupId=none instanceId=${resolved.instance.id} actorUserId=${actorUserId} attemptId=${statistics.attemptId}`
    );
  }

  return NextResponse.json({
    success: true,
    statistics,
    instance: {
      ...resolved.instance,
      progressData: persistedProgressData,
    },
  });
}
