import { and, desc, eq, inArray, or, sql as drizzleSql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectCollaborators, projects } from "@/lib/db/schema";
import { createMap } from "@/app/api/_lib/services/mapService";
import { deleteMap } from "@/app/api/_lib/services/mapService/delete";
import { purgeOrphanLevels } from "@/app/api/_lib/services/levelService/purgeOrphans";
import { evaluateAccessWindows, normalizeAccessWindowTimeZone, normalizeGameAccessWindows } from "@/lib/gameAccessWindows";
import type { CreateGameOptions, Game, GameCollaborator, UpdateGameOptions } from "./types";

export * from "./types";

export type ShareAccessError = "not_started" | "expired" | "access_key_required" | "access_key_invalid";

export interface ShareTokenLookupResult {
  game: Game | null;
  error?: ShareAccessError;
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function getActorCandidates(actor: string | string[]): string[] {
  const values = Array.isArray(actor) ? actor : [actor];
  const candidates = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeIdentifier(value);
    candidates.add(value);
    candidates.add(normalized);
  }

  return Array.from(candidates);
}

function mapGame(row: typeof projects.$inferSelect): Game {
  return {
    id: row.id,
    user_id: row.userId,
    map_name: row.mapName,
    title: row.title,
    description: row.description ?? null,
    progress_data: row.progressData as Record<string, unknown>,
    is_public: row.isPublic ?? false,
    share_token: row.shareToken ?? null,
    thumbnail_url: row.thumbnailUrl ?? null,
    hide_sidebar: row.hideSidebar ?? false,
    access_window_enabled: row.accessWindowEnabled ?? false,
    access_starts_at: row.accessStartsAt ?? null,
    access_ends_at: row.accessEndsAt ?? null,
    access_window_timezone: normalizeAccessWindowTimeZone(row.accessWindowTimezone),
    access_windows: normalizeGameAccessWindows(row.accessWindows),
    access_key_required: row.accessKeyRequired ?? false,
    access_key: row.accessKey ?? null,
    collaboration_mode: row.collaborationMode === "group" ? "group" : "individual",
    group_id: row.groupId ?? null,
    allow_duplicate_users: row.allowDuplicateUsers ?? true,
    drawboard_capture_mode: row.drawboardCaptureMode === "playwright" ? "playwright" : "browser",
    manual_drawboard_capture: row.manualDrawboardCapture ?? false,
    remote_sync_debounce_ms: row.remoteSyncDebounceMs ?? 500,
    drawboard_reload_debounce_ms: row.drawboardReloadDebounceMs ?? 48,
    instance_purge_cadence:
      row.instancePurgeCadence === "daily" || row.instancePurgeCadence === "weekly" || row.instancePurgeCadence === "monthly"
        ? row.instancePurgeCadence
        : null,
    instance_purge_timezone: row.instancePurgeTimezone ?? null,
    instance_purge_hour: row.instancePurgeHour ?? null,
    instance_purge_minute: row.instancePurgeMinute ?? null,
    instance_purge_weekday: row.instancePurgeWeekday ?? null,
    instance_purge_day_of_month: row.instancePurgeDayOfMonth ?? null,
    instance_purge_last_executed_at: row.instancePurgeLastExecutedAt ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function withPermissions(game: Game, actor: string | string[], collaboratorMatch?: string | null): Game {
  const candidates = getActorCandidates(actor);
  const ownerCandidates = candidates.map((c) => normalizeIdentifier(c));
  const isOwner = ownerCandidates.includes(normalizeIdentifier(game.user_id));
  const isCollaborator = Boolean(collaboratorMatch);

  return {
    ...game,
    is_owner: isOwner,
    is_collaborator: isCollaborator,
    can_edit: isOwner || isCollaborator,
    can_manage_collaborators: isOwner || isCollaborator,
    can_remove_collaborators: isOwner,
  };
}

function evaluateWindowAccess(game: Game): ShareAccessError | undefined {
  return evaluateAccessWindows({
    enabled: game.access_window_enabled,
    timeZone: game.access_window_timezone,
    windows: game.access_windows,
    legacyStartsAt: game.access_starts_at,
    legacyEndsAt: game.access_ends_at,
  });
}

function evaluateShareAccess(game: Game, accessKey?: string | null): ShareAccessError | undefined {
  const windowError = evaluateWindowAccess(game);
  if (windowError) {
    return windowError;
  }

  if (!game.access_key_required) {
    return undefined;
  }

  if (!game.access_key) {
    return "access_key_required";
  }

  if (!accessKey) {
    return "access_key_required";
  }

  if (accessKey !== game.access_key) {
    return "access_key_invalid";
  }

  return undefined;
}

export function evaluateGameRouteAccess(game: Game, accessKey?: string | null): ShareAccessError | undefined {
  const windowError = evaluateWindowAccess(game);
  if (windowError) {
    return windowError;
  }

  if (game.can_edit) {
    return undefined;
  }

  return evaluateShareAccess(game, accessKey);
}

export async function createGame(options: CreateGameOptions): Promise<Game> {
  const db = getDb();
  // New games always get a unique empty map; options.mapName is intentionally ignored.
  const targetMapName = `game-${crypto.randomUUID()}`;

  // Create an empty map for new games (no levels cloned)
    const map = await createMap({
      name: targetMapName,
      can_use_ai: true,
    });

  const result = await db
    .insert(projects)
    .values({
      userId: options.userId,
      mapName: map.name,
      title: options.title,
      progressData: options.progressData ?? {},
    })
    .returning();

  if (result.length === 0) {
    throw new Error("Failed to create game");
  }

  return mapGame(result[0]);
}

export async function countGamesUsingMap(mapName: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(projects)
    .where(eq(projects.mapName, mapName));

  return Number(result[0]?.count ?? 0);
}

/**
 * Maps and levels are owned through the games built on them: a caller may edit map
 * content when they own or collaborate on at least one game using one of these maps.
 */
export async function canActorEditMaps(mapNames: string[], actor: string | string[]): Promise<boolean> {
  if (mapNames.length === 0) {
    return false;
  }

  const db = getDb();
  const actorCandidates = getActorCandidates(actor);

  if (actorCandidates.length === 0) {
    return false;
  }

  const result = await db
    .select({ id: projects.id })
    .from(projects)
    .leftJoin(
      projectCollaborators,
      and(eq(projectCollaborators.projectId, projects.id), inArray(projectCollaborators.userId, actorCandidates)),
    )
    .where(
      and(
        inArray(projects.mapName, mapNames),
        or(inArray(projects.userId, actorCandidates), inArray(projectCollaborators.userId, actorCandidates)),
      ),
    )
    .limit(1);

  return result.length > 0;
}

export async function updateGameMapName(id: string, mapName: string): Promise<Game | null> {
  const db = getDb();
  const result = await db
    .update(projects)
    .set({
      mapName,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  if (result.length === 0) {
    return null;
  }

  return mapGame(result[0]);
}

export async function getGameById(id: string, actor: string | string[]): Promise<Game | null> {
  const db = getDb();
  const actorCandidates = getActorCandidates(actor);

  const result = await db
    .select({
      project: projects,
      collaboratorUserId: projectCollaborators.userId,
    })
    .from(projects)
    .leftJoin(
      projectCollaborators,
      and(eq(projectCollaborators.projectId, projects.id), inArray(projectCollaborators.userId, actorCandidates)),
    )
    .where(and(eq(projects.id, id), or(inArray(projects.userId, actorCandidates), inArray(projectCollaborators.userId, actorCandidates))))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const game = mapGame(result[0].project);
  return withPermissions(game, actorCandidates, result[0].collaboratorUserId);
}

export async function getGameByIdForGameplay(id: string, actor?: string | string[]): Promise<Game | null> {
  const db = getDb();

  if (actor) {
    const actorScoped = await getGameById(id, actor);
    if (actorScoped) {
      return actorScoped;
    }
  }

  const publicResult = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.isPublic, true)))
    .limit(1);

  if (publicResult.length === 0) {
    return null;
  }

  const game = mapGame(publicResult[0]);
  return withPermissions(game, actor ?? []);
}

export async function getGamesByUserId(actor: string | string[]): Promise<Game[]> {
  const db = getDb();
  const actorCandidates = getActorCandidates(actor);

  const result = await db
    .select({
      project: projects,
      collaboratorUserId: projectCollaborators.userId,
    })
    .from(projects)
    .leftJoin(
      projectCollaborators,
      and(eq(projectCollaborators.projectId, projects.id), inArray(projectCollaborators.userId, actorCandidates)),
    )
    .where(or(inArray(projects.userId, actorCandidates), inArray(projectCollaborators.userId, actorCandidates)))
    .orderBy(desc(projects.updatedAt));

  const byId = new Map<string, Game>();
  for (const row of result) {
    if (!byId.has(row.project.id)) {
      const game = withPermissions(mapGame(row.project), actorCandidates, row.collaboratorUserId);
      byId.set(game.id, game);
    }
  }

  return Array.from(byId.values());
}

export async function getPublicGames(): Promise<Game[]> {
  const db = getDb();

  const result = await db.select().from(projects).where(eq(projects.isPublic, true)).orderBy(desc(projects.updatedAt));

  return result
    .map(mapGame)
    .filter((game) => evaluateWindowAccess(game) === undefined)
    .map((game) => ({ ...game, progress_data: {} }));
}

export async function getGameByIdUnscoped(id: string): Promise<Game | null> {
  const db = getDb();

  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

  if (result.length === 0) {
    return null;
  }

  return mapGame(result[0]);
}

export async function getGameByShareToken(token: string, accessKey?: string | null): Promise<ShareTokenLookupResult> {
  const db = getDb();

  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.shareToken, token), eq(projects.isPublic, true)))
    .limit(1);

  if (result.length === 0) {
    return { game: null };
  }

  const game = mapGame(result[0]);
  const accessError = evaluateShareAccess(game, accessKey);

  if (accessError) {
    return { game: null, error: accessError };
  }

  return { game };
}

export async function updateGame(id: string, options: UpdateGameOptions): Promise<Game | null> {
  const db = getDb();

  if (!id || typeof id !== "string") {
    throw new Error("Invalid game ID: must be a non-empty string");
  }

  const updateData: Record<string, unknown> = {};

  if (options.title !== undefined) {
    if (typeof options.title !== "string") {
      throw new Error("Invalid title: must be a string");
    }
    updateData.title = options.title;
  }

  if (options.description !== undefined) {
    if (options.description !== null && typeof options.description !== "string") {
      throw new Error("Invalid description: must be a string or null");
    }
    updateData.description = options.description;
  }

  if (options.progressData !== undefined) {
    if (options.progressData === null) {
      throw new Error("Invalid progressData: cannot be null");
    }
    if (typeof options.progressData !== "object") {
      throw new Error(`Invalid progressData: must be an object, got ${typeof options.progressData}`);
    }
    updateData.progressData = options.progressData;
  }

  if (options.isPublic !== undefined) {
    updateData.isPublic = options.isPublic;
  }

  if (options.shareToken !== undefined) {
    updateData.shareToken = options.shareToken;
  }

  if (options.thumbnailUrl !== undefined) {
    updateData.thumbnailUrl = options.thumbnailUrl;
  }

  if (options.hideSidebar !== undefined) {
    updateData.hideSidebar = options.hideSidebar;
  }

  if (options.accessWindowEnabled !== undefined) {
    updateData.accessWindowEnabled = options.accessWindowEnabled;
  }

  if (options.accessStartsAt !== undefined) {
    updateData.accessStartsAt = options.accessStartsAt;
  }

  if (options.accessEndsAt !== undefined) {
    updateData.accessEndsAt = options.accessEndsAt;
  }

  if (options.accessWindowTimezone !== undefined) {
    updateData.accessWindowTimezone = options.accessWindowTimezone?.trim() || null;
  }

  if (options.accessWindows !== undefined) {
    updateData.accessWindows = normalizeGameAccessWindows(options.accessWindows);
  }

  if (options.accessKeyRequired !== undefined) {
    updateData.accessKeyRequired = options.accessKeyRequired;
  }

  if (options.accessKey !== undefined) {
    updateData.accessKey = options.accessKey;
  }

  if (options.collaborationMode !== undefined) {
    if (options.collaborationMode !== "individual" && options.collaborationMode !== "group") {
      throw new Error("Invalid collaborationMode");
    }
    updateData.collaborationMode = options.collaborationMode;
  }

  if (options.allowDuplicateUsers !== undefined) {
    updateData.allowDuplicateUsers = options.allowDuplicateUsers;
  }

  if (options.drawboardCaptureMode !== undefined) {
    if (options.drawboardCaptureMode !== "browser" && options.drawboardCaptureMode !== "playwright") {
      throw new Error("Invalid drawboardCaptureMode");
    }
    updateData.drawboardCaptureMode = options.drawboardCaptureMode;
  }

  if (options.manualDrawboardCapture !== undefined) {
    if (typeof options.manualDrawboardCapture !== "boolean") {
      throw new Error("Invalid manualDrawboardCapture: must be a boolean");
    }
    updateData.manualDrawboardCapture = options.manualDrawboardCapture;
  }

  if (options.remoteSyncDebounceMs !== undefined) {
    const n = Math.round(Number(options.remoteSyncDebounceMs));
    if (!Number.isFinite(n)) {
      throw new Error("Invalid remoteSyncDebounceMs: must be a number");
    }
    updateData.remoteSyncDebounceMs = Math.min(10_000, Math.max(0, n));
  }

  if (options.drawboardReloadDebounceMs !== undefined) {
    const n = Math.round(Number(options.drawboardReloadDebounceMs));
    if (!Number.isFinite(n)) {
      throw new Error("Invalid drawboardReloadDebounceMs: must be a number");
    }
    updateData.drawboardReloadDebounceMs = Math.min(10_000, Math.max(0, n));
  }

  if (options.instancePurgeCadence !== undefined) {
    if (
      options.instancePurgeCadence !== null &&
      options.instancePurgeCadence !== "daily" &&
      options.instancePurgeCadence !== "weekly" &&
      options.instancePurgeCadence !== "monthly"
    ) {
      throw new Error("Invalid instancePurgeCadence");
    }
    updateData.instancePurgeCadence = options.instancePurgeCadence;
  }

  if (options.instancePurgeTimezone !== undefined) {
    if (options.instancePurgeTimezone !== null) {
      if (typeof options.instancePurgeTimezone !== "string" || !options.instancePurgeTimezone.trim()) {
        throw new Error("Invalid instancePurgeTimezone");
      }
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: options.instancePurgeTimezone.trim() });
      } catch {
        throw new Error("Invalid instancePurgeTimezone");
      }
      updateData.instancePurgeTimezone = options.instancePurgeTimezone.trim();
    } else {
      updateData.instancePurgeTimezone = null;
    }
  }

  if (options.instancePurgeHour !== undefined) {
    if (options.instancePurgeHour === null) {
      updateData.instancePurgeHour = null;
    } else {
      const n = Math.round(Number(options.instancePurgeHour));
      if (!Number.isFinite(n) || n < 0 || n > 23) {
        throw new Error("Invalid instancePurgeHour");
      }
      updateData.instancePurgeHour = n;
    }
  }

  if (options.instancePurgeMinute !== undefined) {
    if (options.instancePurgeMinute === null) {
      updateData.instancePurgeMinute = null;
    } else {
      const n = Math.round(Number(options.instancePurgeMinute));
      if (!Number.isFinite(n) || n < 0 || n > 59) {
        throw new Error("Invalid instancePurgeMinute");
      }
      updateData.instancePurgeMinute = n;
    }
  }

  if (options.instancePurgeWeekday !== undefined) {
    if (options.instancePurgeWeekday === null) {
      updateData.instancePurgeWeekday = null;
    } else {
      const n = Math.round(Number(options.instancePurgeWeekday));
      if (!Number.isFinite(n) || n < 0 || n > 6) {
        throw new Error("Invalid instancePurgeWeekday");
      }
      updateData.instancePurgeWeekday = n;
    }
  }

  if (options.instancePurgeDayOfMonth !== undefined) {
    if (options.instancePurgeDayOfMonth === null) {
      updateData.instancePurgeDayOfMonth = null;
    } else {
      const n = Math.round(Number(options.instancePurgeDayOfMonth));
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        throw new Error("Invalid instancePurgeDayOfMonth");
      }
      updateData.instancePurgeDayOfMonth = n;
    }
  }

  if (options.instancePurgeLastExecutedAt !== undefined) {
    if (options.instancePurgeLastExecutedAt !== null && !(options.instancePurgeLastExecutedAt instanceof Date)) {
      throw new Error("Invalid instancePurgeLastExecutedAt: must be a Date or null");
    }
    updateData.instancePurgeLastExecutedAt = options.instancePurgeLastExecutedAt;
  }

  if (Object.keys(updateData).length === 0) {
    const unchanged = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return unchanged.length > 0 ? mapGame(unchanged[0]) : null;
  }

  const result = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();

  if (result.length === 0) {
    return null;
  }

  return mapGame(result[0]);
}

export interface DeleteGameResult {
  deleted: boolean;
  deletedMap: boolean;
  deletedOrphanLevels: number;
}

export async function deleteGame(id: string): Promise<DeleteGameResult> {
  const db = getDb();
  const existing = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

  if (existing.length === 0) {
    return {
      deleted: false,
      deletedMap: false,
      deletedOrphanLevels: 0,
    };
  }

  const mapName = existing[0].mapName;

  const result = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning();

  if (result.length === 0) {
    return {
      deleted: false,
      deletedMap: false,
      deletedOrphanLevels: 0,
    };
  }

  let deletedMap = false;
  let deletedOrphanLevels = 0;
  const remainingMapUsers = await countGamesUsingMap(mapName);

  if (remainingMapUsers === 0) {
    deletedMap = await deleteMap(mapName);
    const purgeResult = await purgeOrphanLevels();
    deletedOrphanLevels = purgeResult.deleted;
  }

  return {
    deleted: true,
    deletedMap,
    deletedOrphanLevels,
  };
}

export async function regenerateShareToken(id: string): Promise<string | null> {
  const db = getDb();

  const newToken = crypto.randomUUID();

  const result = await db.update(projects).set({ shareToken: newToken }).where(eq(projects.id, id)).returning();

  return result.length > 0 ? newToken : null;
}

export async function regenerateAccessKey(id: string): Promise<string | null> {
  const db = getDb();

  const newKey = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

  const result = await db
    .update(projects)
    .set({ accessKey: newKey, accessKeyRequired: true })
    .where(eq(projects.id, id))
    .returning();

  return result.length > 0 ? newKey : null;
}

export async function listCollaborators(id: string): Promise<GameCollaborator[]> {
  const db = getDb();

  const rows = await db
    .select({
      user_id: projectCollaborators.userId,
      added_by: projectCollaborators.addedBy,
      created_at: projectCollaborators.createdAt,
    })
    .from(projectCollaborators)
    .where(eq(projectCollaborators.projectId, id));

  return rows as GameCollaborator[];
}

export async function addCollaborator(id: string, collaboratorId: string, addedBy: string): Promise<void> {
  const db = getDb();
  const normalizedCollaboratorId = normalizeIdentifier(collaboratorId);

  await db
    .insert(projectCollaborators)
    .values({
      projectId: id,
      userId: normalizedCollaboratorId,
      addedBy,
    })
    .onConflictDoNothing();
}

export async function removeCollaborator(id: string, collaboratorId: string): Promise<boolean> {
  const db = getDb();
  const normalizedCollaboratorId = normalizeIdentifier(collaboratorId);

  const result = await db
    .delete(projectCollaborators)
    .where(and(eq(projectCollaborators.projectId, id), eq(projectCollaborators.userId, normalizedCollaboratorId)))
    .returning();

  return result.length > 0;
}
