import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { evaluateGameRouteAccess, getGameById, getGameByIdForGameplay } from "@/app/api/_lib/services/gameService";
import { resolveSessionAdmin } from "@/app/api/_lib/services/adminService/read";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { getLevelsForMap } from "@/app/api/_lib/services/mapService/read";
import {
  attachGameAccessCookie,
  clearGameAccessCookie,
  getRawAccessKeyFromRequest,
  resolveAccessKeyForGame,
} from "@/app/api/_lib/services/gameService/accessCookie";
import { getLtiSession, hasOutcomeService } from "@/lib/lti";
import { BASE_LEVEL_VARIANT_ID, getLevelVariantAssignmentKey } from "@/lib/levels/variants";
import { ensureGameRetentionWindow } from "@/app/api/_lib/services/gameRetentionService";

export function getRows(result: { rows?: unknown[] } | unknown[] | null | undefined): Record<string, unknown>[] {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }

  return (result.rows ?? []) as Record<string, unknown>[];
}

export function getAccessKeyFromRequest(request: NextRequest): string | null {
  return getRawAccessKeyFromRequest(request);
}

export function accessDenied(reason: "not_started" | "expired" | "access_key_required" | "access_key_invalid") {
  if (reason === "not_started") {
    return NextResponse.json({ error: "Game is not open yet", reason }, { status: 403 });
  }
  if (reason === "expired") {
    return NextResponse.json({ error: "Game access windows have ended", reason }, { status: 403 });
  }
  return NextResponse.json(
    {
      error: reason === "access_key_invalid" ? "Invalid access key" : "Access key required",
      reason,
      requiresAccessKey: true,
    },
    { status: 403 },
  );
}

export function shouldEnforceAccess(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("accessContext") === "game";
}

function normalizeProgressData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

const GROUP_START_MIN_READY_COUNT = 2;

function normalizeGroupStartGate(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const readyUserIds = Array.isArray(source.readyUserIds)
    ? Array.from(new Set(source.readyUserIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)))
    : [];
  const rawReadyUsers =
    source.readyUsers && typeof source.readyUsers === "object" && !Array.isArray(source.readyUsers)
      ? source.readyUsers as Record<string, unknown>
      : {};
  const readyUsers = readyUserIds.reduce<Record<string, Record<string, unknown>>>((acc, userId) => {
    const user = rawReadyUsers[userId];
    const userRecord = user && typeof user === "object" && !Array.isArray(user)
      ? user as Record<string, unknown>
      : {};
    acc[userId] = {
      userId,
      ...(typeof userRecord.userName === "string" ? { userName: userRecord.userName } : {}),
      ...(typeof userRecord.userEmail === "string" ? { userEmail: userRecord.userEmail } : {}),
      ...(typeof userRecord.userImage === "string" ? { userImage: userRecord.userImage } : {}),
      ...(typeof userRecord.readyAt === "string" ? { readyAt: userRecord.readyAt } : {}),
    };
    return acc;
  }, {});

  return {
    status: source.status === "started" ? "started" as const : "waiting" as const,
    minReadyCount: GROUP_START_MIN_READY_COUNT,
    readyUserIds,
    readyUsers,
    startedAt: typeof source.startedAt === "string" ? source.startedAt : null,
    startedByUserId: typeof source.startedByUserId === "string" ? source.startedByUserId : null,
  };
}

function ensureGroupStartGateProgressData(
  progressData: Record<string, unknown>,
  collaborationMode: "group" | "individual",
): Record<string, unknown> {
  if (collaborationMode !== "group") {
    return progressData;
  }

  return {
    ...progressData,
    groupStartGate: normalizeGroupStartGate(progressData.groupStartGate),
  };
}

function mergeProgressData(
  existingProgressData: unknown,
  nextProgressData: unknown,
): Record<string, unknown> {
  const existing = normalizeProgressData(existingProgressData);
  const next = normalizeProgressData(nextProgressData);
  const existingPointsByLevel =
    existing.pointsByLevel && typeof existing.pointsByLevel === "object" && !Array.isArray(existing.pointsByLevel)
      ? existing.pointsByLevel as Record<string, Record<string, unknown>>
      : {};
  const nextPointsByLevel =
    next.pointsByLevel && typeof next.pointsByLevel === "object" && !Array.isArray(next.pointsByLevel)
      ? next.pointsByLevel as Record<string, Record<string, unknown>>
      : {};
  const mergedGameplayTelemetry =
    existing.gameplayTelemetry && typeof existing.gameplayTelemetry === "object" && !Array.isArray(existing.gameplayTelemetry)
      ? existing.gameplayTelemetry as Record<string, unknown>
      : {};
  const nextGameplayTelemetry =
    next.gameplayTelemetry && typeof next.gameplayTelemetry === "object" && !Array.isArray(next.gameplayTelemetry)
      ? next.gameplayTelemetry as Record<string, unknown>
      : {};
  const existingLtiGroupOutcomeTargets =
    existing.ltiGroupOutcomeTargets && typeof existing.ltiGroupOutcomeTargets === "object" && !Array.isArray(existing.ltiGroupOutcomeTargets)
      ? existing.ltiGroupOutcomeTargets as Record<string, unknown>
      : {};
  const nextLtiGroupOutcomeTargets =
    next.ltiGroupOutcomeTargets && typeof next.ltiGroupOutcomeTargets === "object" && !Array.isArray(next.ltiGroupOutcomeTargets)
      ? next.ltiGroupOutcomeTargets as Record<string, unknown>
      : {};
  const existingGroupStartGate = normalizeGroupStartGate(existing.groupStartGate);
  const nextHasGroupStartGate = "groupStartGate" in next;
  const nextGroupStartGate = nextHasGroupStartGate ? normalizeGroupStartGate(next.groupStartGate) : null;
  const gameplayTelemetry =
    mergedGameplayTelemetry.users || nextGameplayTelemetry.users
      ? {
          ...mergedGameplayTelemetry,
          ...nextGameplayTelemetry,
          users: {
            ...(mergedGameplayTelemetry.users && typeof mergedGameplayTelemetry.users === "object" ? mergedGameplayTelemetry.users : {}),
            ...(nextGameplayTelemetry.users && typeof nextGameplayTelemetry.users === "object" ? nextGameplayTelemetry.users : {}),
          },
        }
      : undefined;
  const ltiGroupOutcomeTargets =
    Object.keys(existingLtiGroupOutcomeTargets).length || Object.keys(nextLtiGroupOutcomeTargets).length
      ? {
          ...existingLtiGroupOutcomeTargets,
          ...nextLtiGroupOutcomeTargets,
        }
      : undefined;
  const groupStartGate =
    nextGroupStartGate
      ? existingGroupStartGate.status === "started" && nextGroupStartGate.status !== "started"
        ? existingGroupStartGate
        : nextGroupStartGate
      : ("groupStartGate" in existing ? existingGroupStartGate : undefined);
  const pointsByLevel =
    Object.keys(existingPointsByLevel).length || Object.keys(nextPointsByLevel).length
      ? Object.fromEntries(
          [...new Set([...Object.keys(existingPointsByLevel), ...Object.keys(nextPointsByLevel)])].map((levelName) => [
            levelName,
            {
              ...(existingPointsByLevel[levelName] && typeof existingPointsByLevel[levelName] === "object"
                ? existingPointsByLevel[levelName]
                : {}),
              ...(nextPointsByLevel[levelName] && typeof nextPointsByLevel[levelName] === "object"
                ? nextPointsByLevel[levelName]
                : {}),
            },
          ]),
        )
      : undefined;

  if ("levels" in next) {
    return {
      ...existing,
      ...next,
      ...(pointsByLevel ? { pointsByLevel } : {}),
      ...(gameplayTelemetry ? { gameplayTelemetry } : {}),
      ...(ltiGroupOutcomeTargets ? { ltiGroupOutcomeTargets } : {}),
      ...(groupStartGate ? { groupStartGate } : {}),
    };
  }

  return {
    ...existing,
    ...next,
    ...(pointsByLevel ? { pointsByLevel } : {}),
    ...(gameplayTelemetry ? { gameplayTelemetry } : {}),
    ...(ltiGroupOutcomeTargets ? { ltiGroupOutcomeTargets } : {}),
    ...(groupStartGate ? { groupStartGate } : {}),
    ...(existing.levels === undefined ? {} : { levels: existing.levels }),
  };
}

function normalizeVariantAssignments(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0),
  );
}

async function ensureVariantAssignmentsForInstance(
  instanceId: string,
  mapName: string,
  existingProgressData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existingAssignments = normalizeVariantAssignments(existingProgressData.variantAssignments);
  const levels = await getLevelsForMap(mapName);
  if (!levels.length) {
    return existingProgressData;
  }

  const nextAssignments: Record<string, string> = {};
  let changed = false;

  levels.forEach((level, index) => {
    const key = getLevelVariantAssignmentKey({ identifier: level.identifier }, index);
    const variants = Array.isArray(level.json?.variants)
      ? level.json.variants.filter((variant): variant is { id: string } => (
          !!variant
          && typeof variant === "object"
          && typeof (variant as { id?: unknown }).id === "string"
          && ((variant as { id: string }).id.length > 0)
        ))
      : [];
    const previous = existingAssignments[key];

    if (variants.length === 0) {
      nextAssignments[key] = BASE_LEVEL_VARIANT_ID;
      if (previous !== BASE_LEVEL_VARIANT_ID) {
        changed = true;
      }
      return;
    }

    const hasPreviousVariant = typeof previous === "string" && variants.some((variant) => variant.id === previous);
    if (hasPreviousVariant) {
      nextAssignments[key] = previous;
      return;
    }

    nextAssignments[key] = variants[Math.floor(Math.random() * variants.length)]!.id;
    changed = true;
  });

  if (!changed) {
    const previousKeys = Object.keys(existingAssignments);
    const nextKeys = Object.keys(nextAssignments);
    if (
      previousKeys.length === nextKeys.length &&
      nextKeys.every((key) => existingAssignments[key] === nextAssignments[key])
    ) {
      return existingProgressData;
    }
  }

  return atomicAssignVariants(instanceId, nextAssignments);
}

async function attachCurrentLtiOutcomeTarget(
  instanceId: string,
  existingProgressData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const ltiSession = await getLtiSession();
  if (!ltiSession || !hasOutcomeService(ltiSession)) {
    return existingProgressData;
  }

  const userId = ltiSession.userId;
  if (!userId) {
    return existingProgressData;
  }

  const currentTargets =
    existingProgressData.ltiGroupOutcomeTargets &&
    typeof existingProgressData.ltiGroupOutcomeTargets === "object" &&
    !Array.isArray(existingProgressData.ltiGroupOutcomeTargets)
      ? existingProgressData.ltiGroupOutcomeTargets as Record<string, unknown>
      : {};
  const currentTarget =
    currentTargets[userId] && typeof currentTargets[userId] === "object" && !Array.isArray(currentTargets[userId])
      ? currentTargets[userId] as Record<string, unknown>
      : null;

  if (currentTarget?.sourcedid === ltiSession.outcomeService.sourcedid) {
    return existingProgressData;
  }

  const nextProgressData = {
    ...existingProgressData,
    ltiGroupOutcomeTargets: {
      ...currentTargets,
      [userId]: {
        userId,
        userEmail: ltiSession.userEmail,
        userName: ltiSession.userName,
        sourcedid: ltiSession.outcomeService.sourcedid,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  const { persistedProgressData } = await updateInstanceProgressData(
    instanceId,
    existingProgressData,
    nextProgressData,
  );

  return normalizeProgressData(persistedProgressData);
}

async function updateInstanceProgressData(
  instanceId: string,
  existingProgressData: unknown,
  nextProgressData: unknown,
) {
  const sql = await getSql();
  const mergedProgressData = mergeProgressData(existingProgressData, nextProgressData);
  const updatedResult = await sql.query(
    "UPDATE game_instances SET progress_data = $2, updated_at = NOW() WHERE id = $1 RETURNING id, progress_data",
    [instanceId, mergedProgressData],
  );
  const updatedRows = getRows(updatedResult);

  return {
    mergedProgressData,
    persistedProgressData: updatedRows[0]?.progress_data ?? mergedProgressData,
  };
}

/**
 * Atomically assigns variant assignments in the DB so that concurrent GET /instance
 * requests never overwrite each other's assignments. The SQL expression ensures that
 * values already stored in the DB always win over the incoming candidates, so the
 * first writer's random pick is preserved regardless of how many requests race.
 *
 * Returns the progress_data as it exists in the DB after the update.
 */
async function atomicAssignVariants(
  instanceId: string,
  candidateAssignments: Record<string, string>,
): Promise<Record<string, unknown>> {
  const sql = await getSql();
  // The expression `$2::jsonb || COALESCE(progress_data->'variantAssignments', '{}')` means:
  // start with our candidates, then overlay whatever is already in the DB.
  // Because the DB values are on the right, they always win for any key that already exists.
  const result = await sql.query(
    `UPDATE game_instances
     SET progress_data = jsonb_set(
       progress_data,
       '{variantAssignments}',
       $2::jsonb || COALESCE(progress_data->'variantAssignments', '{}'::jsonb)
     ),
     updated_at = NOW()
     WHERE id = $1
     RETURNING progress_data`,
    [instanceId, candidateAssignments],
  );
  const rows = getRows(result);
  return normalizeProgressData(rows[0]?.progress_data);
}


function buildGroupInstanceResponse(groupId: string, row: Record<string, unknown>) {
  return {
    instance: {
      id: row.id,
      scope: "group" as const,
      groupId,
      userId: null,
      progressData: ensureGroupStartGateProgressData(
        normalizeProgressData(row.progress_data),
        "group",
      ),
    },
  } as const;
}

function buildIndividualInstanceResponse(userId: string, row: Record<string, unknown>) {
  return {
    instance: {
      id: row.id,
      scope: "individual" as const,
      groupId: null,
      userId,
      progressData: row.progress_data ?? {},
    },
  } as const;
}

function buildServiceInstanceResponse(
  row: Record<string, unknown>,
  fallback: { groupId: string | null; userId: string | null },
) {
  const scope = row.scope === "group" ? "group" as const : "individual" as const;
  const rowGroupId = typeof row.group_id === "string" ? row.group_id : null;
  const rowUserId = typeof row.user_id === "string" ? row.user_id : null;
  return {
    instance: {
      id: row.id,
      scope,
      groupId: rowGroupId ?? fallback.groupId,
      userId: rowUserId ?? fallback.userId,
      progressData:
        scope === "group"
          ? ensureGroupStartGateProgressData(normalizeProgressData(row.progress_data), "group")
          : row.progress_data ?? {},
    },
  } as const;
}

function isDuplicateGroupInstanceError(error: unknown): error is { code?: string; constraint?: string } {
  return (
    !!error
    && typeof error === "object"
    && "code" in error
    && (error.code === "23505" || ("constraint" in error && error.constraint === "idx_game_instances_group_unique"))
  );
}

function isDuplicateIndividualInstanceError(error: unknown): error is { code?: string; constraint?: string } {
  return (
    !!error
    && typeof error === "object"
    && "code" in error
    && (error.code === "23505" || ("constraint" in error && error.constraint === "idx_game_instances_individual_unique"))
  );
}

export async function resolveGroupInstance(sql: Awaited<ReturnType<typeof getSql>>, gameId: string, groupId: string) {
  const existingResult = await sql.query(
    "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'group' AND group_id = $2 LIMIT 1",
    [gameId, groupId],
  );
  const existingRows = getRows(existingResult);
  if (existingRows.length) {
    return buildGroupInstanceResponse(groupId, existingRows[0]);
  }

  try {
    const createdResult = await sql.query(
      `INSERT INTO game_instances (game_id, scope, group_id, progress_data)
       VALUES ($1, 'group', $2, $3)
       RETURNING id, progress_data`,
      [gameId, groupId, ensureGroupStartGateProgressData({}, "group")],
    );
    const createdRows = getRows(createdResult);
    return buildGroupInstanceResponse(groupId, createdRows[0]);
  } catch (error) {
    if (!isDuplicateGroupInstanceError(error)) {
      throw error;
    }

    const racedResult = await sql.query(
      "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'group' AND group_id = $2 LIMIT 1",
      [gameId, groupId],
    );
    const racedRows = getRows(racedResult);
    if (!racedRows.length) {
      throw error;
    }
    return buildGroupInstanceResponse(groupId, racedRows[0]);
  }
}

export async function resolveIndividualInstance(sql: Awaited<ReturnType<typeof getSql>>, gameId: string, actorUserId: string) {
  const existingResult = await sql.query(
    "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'individual' AND user_id = $2 LIMIT 1",
    [gameId, actorUserId],
  );
  const existingRows = getRows(existingResult);
  if (existingRows.length) {
    return buildIndividualInstanceResponse(actorUserId, existingRows[0]);
  }

  try {
    const createdResult = await sql.query(
      `INSERT INTO game_instances (game_id, scope, user_id, progress_data)
       VALUES ($1, 'individual', $2, '{}')
       RETURNING id, progress_data`,
      [gameId, actorUserId],
    );
    const createdRows = getRows(createdResult);
    return buildIndividualInstanceResponse(actorUserId, createdRows[0]);
  } catch (error) {
    if (!isDuplicateIndividualInstanceError(error)) {
      throw error;
    }

    const racedResult = await sql.query(
      "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'individual' AND user_id = $2 LIMIT 1",
      [gameId, actorUserId],
    );
    const racedRows = getRows(racedResult);
    if (!racedRows.length) {
      throw error;
    }
    return buildIndividualInstanceResponse(actorUserId, racedRows[0]);
  }
}

export async function resolveInstance(
  request: NextRequest,
  gameId: string,
  actorUserId: string,
  mode: "individual" | "group",
  canEditGame: boolean = false,
) {
  const sql = await getSql();

  if (mode === "group") {
    const groupId = request.nextUrl.searchParams.get("groupId");
    if (!groupId) {
      if (canEditGame) {
        return resolveIndividualInstance(sql, gameId, actorUserId);
      }
      return { error: "groupId is required for group mode", status: 400 } as const;
    }

    if (canEditGame) {
      const groupResult = await sql.query("SELECT id FROM groups WHERE id = $1 LIMIT 1", [groupId]);
      const groupRows = getRows(groupResult);
      if (!groupRows.length) {
        return { error: "Group not found", status: 404 } as const;
      }
    } else {
      const membershipResult = await sql.query(
        "SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1",
        [groupId, actorUserId],
      );
      const membershipRows = getRows(membershipResult);
      if (!membershipRows.length) {
        return { error: "You are not a member of this group", status: 403 } as const;
      }
    }

    return resolveGroupInstance(sql, gameId, groupId);
  }

  return resolveIndividualInstance(sql, gameId, actorUserId);
}

async function resolveServiceTokenAuth(request: NextRequest, gameId: string) {
  const serviceToken = request.headers.get("x-ws-service-token");
  if (!serviceToken || serviceToken !== process.env.WS_SERVICE_TOKEN) {
    return null;
  }

  const groupId = request.nextUrl.searchParams.get("groupId");
  const userId = request.nextUrl.searchParams.get("userId");
  const instanceId = request.nextUrl.searchParams.get("instanceId");

  const sql = await getSql();

  // Look up the game directly (no actor-based access check for service calls)
  const gameResult = await sql.query(
    `SELECT id, collaboration_mode, map_name,
            instance_purge_cadence, instance_purge_timezone, instance_purge_hour,
            instance_purge_minute, instance_purge_weekday, instance_purge_day_of_month,
            instance_purge_last_executed_at
     FROM projects
     WHERE id = $1
     LIMIT 1`,
    [gameId],
  );
  const gameRows = getRows(gameResult);
  if (!gameRows.length) {
    return { error: "Game not found", status: 404 } as const;
  }

  const mode = gameRows[0].collaboration_mode === "group" ? "group" : "individual";
  const mapName = (gameRows[0].map_name as string) || "";
  await ensureGameRetentionWindow({
    gameId,
    instancePurgeCadence: (gameRows[0].instance_purge_cadence as "daily" | "weekly" | "monthly" | null | undefined) ?? null,
    instancePurgeTimezone: (gameRows[0].instance_purge_timezone as string | null | undefined) ?? null,
    instancePurgeHour:
      typeof gameRows[0].instance_purge_hour === "number"
        ? gameRows[0].instance_purge_hour
        : Number(gameRows[0].instance_purge_hour ?? 0),
    instancePurgeMinute:
      typeof gameRows[0].instance_purge_minute === "number"
        ? gameRows[0].instance_purge_minute
        : Number(gameRows[0].instance_purge_minute ?? 0),
    instancePurgeWeekday:
      typeof gameRows[0].instance_purge_weekday === "number"
        ? gameRows[0].instance_purge_weekday
        : Number(gameRows[0].instance_purge_weekday ?? 1),
    instancePurgeDayOfMonth:
      typeof gameRows[0].instance_purge_day_of_month === "number"
        ? gameRows[0].instance_purge_day_of_month
        : Number(gameRows[0].instance_purge_day_of_month ?? 1),
    instancePurgeLastExecutedAt:
      (gameRows[0].instance_purge_last_executed_at as Date | string | null | undefined) ?? null,
  });

  if (instanceId) {
    const instanceResult = await sql.query(
      `SELECT id, scope, group_id, user_id, progress_data
       FROM game_instances
       WHERE id = $1 AND game_id = $2
       LIMIT 1`,
      [instanceId, gameId],
    );
    const instanceRows = getRows(instanceResult);
    if (!instanceRows.length) {
      return { error: "Game instance not found", status: 404 } as const;
    }

    const row = instanceRows[0];
    const rowGroupId = typeof row.group_id === "string" ? row.group_id : null;
    const rowUserId = typeof row.user_id === "string" ? row.user_id : null;
    if (groupId && rowGroupId !== groupId) {
      return { error: "Game instance mismatch", status: 409 } as const;
    }
    if (userId && rowUserId !== userId) {
      return { error: "Game instance mismatch", status: 409 } as const;
    }

    return {
      ...buildServiceInstanceResponse(row, { groupId, userId }),
      collaborationMode: mode,
      mapName,
    } as const;
  }

  if (mode === "group") {
    if (!groupId) {
      if (userId) {
        const individualInstance = await resolveIndividualInstance(sql, gameId, userId);
        const progressData = await ensureVariantAssignmentsForInstance(
          String(individualInstance.instance.id),
          mapName,
          normalizeProgressData(individualInstance.instance.progressData),
        );
        return {
          instance: {
            ...individualInstance.instance,
            progressData,
          },
          collaborationMode: mode,
          mapName,
        } as const;
      }
      return { error: "groupId is required for group mode", status: 400 } as const;
    }
    const groupInstance = await resolveGroupInstance(sql, gameId, groupId);
    const progressData = await ensureVariantAssignmentsForInstance(
      String(groupInstance.instance.id),
      mapName,
      normalizeProgressData(groupInstance.instance.progressData),
    );
    return {
      instance: {
        ...groupInstance.instance,
        progressData,
      },
      collaborationMode: mode,
      mapName,
    } as const;
  }

  // Individual mode
  if (!userId) {
    return { error: "userId is required for individual mode", status: 400 } as const;
  }
  const individualInstance = await resolveIndividualInstance(sql, gameId, userId);
  const progressData = await ensureVariantAssignmentsForInstance(
    String(individualInstance.instance.id),
    mapName,
    normalizeProgressData(individualInstance.instance.progressData),
  );
  return {
    instance: {
      ...individualInstance.instance,
      progressData,
    },
    collaborationMode: mode,
    mapName,
  } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Service token auth (WS server calls)
  const serviceResult = await resolveServiceTokenAuth(request, id);
  if (serviceResult) {
    if ("error" in serviceResult) {
      return NextResponse.json({ error: serviceResult.error }, { status: serviceResult.status });
    }
    return NextResponse.json({
      gameId: id,
      collaborationMode: serviceResult.collaborationMode,
      mapName: serviceResult.mapName,
      instance: serviceResult.instance,
    });
  }

  const session = await getServerSession(authOptions);
  const enforceGameplayAccess = shouldEnforceAccess(request);
  const actorIdentifiers = session?.user?.email
    ? [session.userId, session.user.email].filter(Boolean) as string[]
    : [];
  if (!session?.user?.email && !enforceGameplayAccess) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = enforceGameplayAccess
    ? await getGameByIdForGameplay(id, actorIdentifiers.length ? actorIdentifiers : undefined)
    : await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const isActorAdmin = await resolveSessionAdmin(session);

  if (session?.user?.email && !game.can_edit && !game.is_public && !isActorAdmin) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  if (enforceGameplayAccess) {
    const rawAccessKey = getRawAccessKeyFromRequest(request);
    const accessError = evaluateGameRouteAccess(game, resolveAccessKeyForGame(request, game));
    if (accessError) {
      const deniedResponse = accessDenied(accessError);
      if (accessError === "access_key_required" || accessError === "access_key_invalid") {
        clearGameAccessCookie(request, deniedResponse, game.id);
      }
      return deniedResponse;
    }

    const mode = game.collaboration_mode === "group" ? "group" : "individual";
    const ownUserId = session?.user?.email
      ? (await getOrCreateUserByEmail(session.user.email)).id
      : request.nextUrl.searchParams.get("guestId");
    if (!ownUserId) {
      return NextResponse.json({ error: "guestId is required for public individual games" }, { status: 400 });
    }
    if (!session?.user?.email && game.collaboration_mode === "group") {
      return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
    }

    await ensureGameRetentionWindow({
      gameId: game.id,
      instancePurgeCadence: game.instance_purge_cadence,
      instancePurgeTimezone: game.instance_purge_timezone,
      instancePurgeHour: game.instance_purge_hour,
      instancePurgeMinute: game.instance_purge_minute,
      instancePurgeWeekday: game.instance_purge_weekday,
      instancePurgeDayOfMonth: game.instance_purge_day_of_month,
      instancePurgeLastExecutedAt: game.instance_purge_last_executed_at,
    });

    // Allow creators and admins to view another user's individual instance via ?userId=
    const canEditOrAdmin = Boolean(game.can_edit) || isActorAdmin;
    const targetUserId = request.nextUrl.searchParams.get("userId");
    const actorUserId = (targetUserId && canEditOrAdmin && mode === "individual") ? targetUserId : ownUserId;

    const resolved = await resolveInstance(request, id, actorUserId, mode, canEditOrAdmin);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const instance =
      mode === "group"
        ? {
            ...resolved.instance,
            progressData: await attachCurrentLtiOutcomeTarget(
              String(resolved.instance.id),
              normalizeProgressData(resolved.instance.progressData),
            ),
          }
        : resolved.instance;
    const progressData = await ensureVariantAssignmentsForInstance(
      String(instance.id),
      game.map_name,
      normalizeProgressData(instance.progressData),
    );
    const normalizedInstance = {
      ...instance,
      progressData,
    };

    const response = NextResponse.json({
      gameId: id,
      collaborationMode: mode,
      mapName: game.map_name,
      instance: normalizedInstance,
    });
    attachGameAccessCookie(request, response, game, rawAccessKey);
    return response;
  }

  if (!session?.user?.email && game.collaboration_mode === "group") {
    return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
  }

  await ensureGameRetentionWindow({
    gameId: game.id,
    instancePurgeCadence: game.instance_purge_cadence,
    instancePurgeTimezone: game.instance_purge_timezone,
    instancePurgeHour: game.instance_purge_hour,
    instancePurgeMinute: game.instance_purge_minute,
    instancePurgeWeekday: game.instance_purge_weekday,
    instancePurgeDayOfMonth: game.instance_purge_day_of_month,
    instancePurgeLastExecutedAt: game.instance_purge_last_executed_at,
  });

  const mode = game.collaboration_mode === "group" ? "group" : "individual";
  const ownUserId = session?.user?.email
    ? (await getOrCreateUserByEmail(session.user.email)).id
    : request.nextUrl.searchParams.get("guestId");
  if (!ownUserId) {
    return NextResponse.json({ error: "guestId is required for public individual games" }, { status: 400 });
  }

  // Allow creators and admins to view another user's individual instance via ?userId=
  const canEditOrAdmin = Boolean(game.can_edit) || isActorAdmin;
  const targetUserId = request.nextUrl.searchParams.get("userId");
  const actorUserId = (targetUserId && canEditOrAdmin && mode === "individual") ? targetUserId : ownUserId;

  const resolved = await resolveInstance(request, id, actorUserId, mode, canEditOrAdmin);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const instance =
    mode === "group"
      ? {
          ...resolved.instance,
          progressData: await attachCurrentLtiOutcomeTarget(
            String(resolved.instance.id),
            normalizeProgressData(resolved.instance.progressData),
          ),
        }
      : resolved.instance;
  const progressData = await ensureVariantAssignmentsForInstance(
    String(instance.id),
    game.map_name,
    normalizeProgressData(instance.progressData),
  );

  return NextResponse.json({
    gameId: id,
    collaborationMode: mode,
    mapName: game.map_name,
    instance: {
      ...instance,
      progressData,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const progressData = body?.progressData;
  if (!progressData || typeof progressData !== "object" || Array.isArray(progressData)) {
    return NextResponse.json({ error: "Invalid progressData payload" }, { status: 400 });
  }

  // Service token auth (WS server calls)
  const serviceResult = await resolveServiceTokenAuth(request, id);
  if (serviceResult) {
    if ("error" in serviceResult) {
      return NextResponse.json({ error: serviceResult.error }, { status: serviceResult.status });
    }

    const { persistedProgressData } = await updateInstanceProgressData(
      String(serviceResult.instance.id),
      serviceResult.instance.progressData,
      progressData,
    );

    return NextResponse.json({
      gameId: id,
      collaborationMode: serviceResult.collaborationMode,
      instance: {
        ...serviceResult.instance,
        progressData: persistedProgressData,
      },
    });
  }

  const session = await getServerSession(authOptions);
  const enforceGameplayAccess = shouldEnforceAccess(request);
  const actorIdentifiers = session?.user?.email
    ? [session.userId, session.user.email].filter(Boolean) as string[]
    : [];
  if (!session?.user?.email && !enforceGameplayAccess) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = enforceGameplayAccess
    ? await getGameByIdForGameplay(id, actorIdentifiers.length ? actorIdentifiers : undefined)
    : await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const isPatchActorAdmin = await resolveSessionAdmin(session);

  if (enforceGameplayAccess) {
    const rawAccessKey = getRawAccessKeyFromRequest(request);
    const accessError = evaluateGameRouteAccess(game, resolveAccessKeyForGame(request, game));
    if (accessError) {
      const deniedResponse = accessDenied(accessError);
      if (accessError === "access_key_required" || accessError === "access_key_invalid") {
        clearGameAccessCookie(request, deniedResponse, game.id);
      }
      return deniedResponse;
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

    const resolved = await resolveInstance(request, id, actorUserId, mode, Boolean(game.can_edit) || isPatchActorAdmin);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { persistedProgressData } = await updateInstanceProgressData(
      String(resolved.instance.id),
      resolved.instance.progressData,
      progressData,
    );

    const response = NextResponse.json({
      gameId: id,
      collaborationMode: mode,
      instance: {
        ...resolved.instance,
        progressData: persistedProgressData,
      },
    });
    attachGameAccessCookie(request, response, game, rawAccessKey);
    return response;
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

  const resolved = await resolveInstance(request, id, actorUserId, mode, Boolean(game.can_edit) || isPatchActorAdmin);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { persistedProgressData } = await updateInstanceProgressData(
    String(resolved.instance.id),
    resolved.instance.progressData,
    progressData,
  );

  return NextResponse.json({
    gameId: id,
    collaborationMode: mode,
    instance: {
      ...resolved.instance,
      progressData: persistedProgressData,
    },
  });
}
