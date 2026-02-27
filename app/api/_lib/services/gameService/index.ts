import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectCollaborators, projects } from "@/lib/db/schema";
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
    progress_data: row.progressData as Record<string, unknown>,
    is_public: row.isPublic ?? false,
    share_token: row.shareToken ?? null,
    thumbnail_url: row.thumbnailUrl ?? null,
    hide_sidebar: row.hideSidebar ?? false,
    access_window_enabled: row.accessWindowEnabled ?? false,
    access_starts_at: row.accessStartsAt ?? null,
    access_ends_at: row.accessEndsAt ?? null,
    access_key_required: row.accessKeyRequired ?? false,
    access_key: row.accessKey ?? null,
    collaboration_mode: row.collaborationMode === "group" ? "group" : "individual",
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
  if (!game.access_window_enabled) {
    return undefined;
  }

  const now = Date.now();
  if (game.access_starts_at && now < game.access_starts_at.getTime()) {
    return "not_started";
  }

  if (game.access_ends_at && now > game.access_ends_at.getTime()) {
    return "expired";
  }

  return undefined;
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

export async function createGame(options: CreateGameOptions): Promise<Game> {
  const db = getDb();

  const result = await db
    .insert(projects)
    .values({
      userId: options.userId,
      mapName: options.mapName,
      title: options.title,
      progressData: options.progressData ?? {},
    })
    .returning();

  if (result.length === 0) {
    throw new Error("Failed to create game");
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

export async function deleteGame(id: string, ownerId: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, ownerId)))
    .returning();

  return result.length > 0;
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
