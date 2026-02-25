import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { Game, CreateGameOptions, UpdateGameOptions } from "./types";

export * from "./types";

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
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function createGame(options: CreateGameOptions): Promise<Game> {
  const db = getDb();
  
  const result = await db.insert(projects).values({
    userId: options.userId,
    mapName: options.mapName,
    title: options.title,
    progressData: options.progressData ?? {},
  }).returning();
  
  if (result.length === 0) {
    throw new Error("Failed to create game");
  }
  
  return mapGame(result[0]);
}

export async function getGameById(id: string, userId: string): Promise<Game | null> {
  const db = getDb();
  
  const result = await db.select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return mapGame(result[0]);
}

export async function getGamesByUserId(userId: string): Promise<Game[]> {
  const db = getDb();
  
  const result = await db.select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
  
  return result.map(mapGame);
}

export async function getPublicGames(): Promise<Game[]> {
  const db = getDb();
  
  const result = await db.select()
    .from(projects)
    .where(eq(projects.isPublic, true))
    .orderBy(desc(projects.updatedAt));
  
  return result.map((row) => mapGame({ ...row, progressData: {} }));
}

export async function getGameByShareToken(token: string): Promise<Game | null> {
  const db = getDb();
  
  const result = await db.select()
    .from(projects)
    .where(and(eq(projects.shareToken, token), eq(projects.isPublic, true)))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return mapGame(result[0]);
}

export async function updateGame(
  id: string,
  userId: string,
  options: UpdateGameOptions
): Promise<Game | null> {
  const db = getDb();
  
  if (!id || typeof id !== "string") {
    throw new Error("Invalid game ID: must be a non-empty string");
  }
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid user ID: must be a non-empty string");
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
  
  if (Object.keys(updateData).length === 0) {
    return await getGameById(id, userId);
  }
  
  const result = await db.update(projects)
    .set(updateData)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  
  if (result.length === 0) {
    return null;
  }
  
  return mapGame(result[0]);
}

export async function deleteGame(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db.delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  
  return result.length > 0;
}

export async function regenerateShareToken(id: string, userId: string): Promise<string | null> {
  const db = getDb();
  
  const newToken = crypto.randomUUID();
  
  const result = await db.update(projects)
    .set({ shareToken: newToken })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  
  return result.length > 0 ? newToken : null;
}
