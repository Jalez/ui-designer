import type { DrawboardArtifactRecord } from "@/lib/drawboard/artifactCache";
import { getDb } from "@/lib/db";
import { drawboardArtifactCache } from "@/lib/db/schema";
import { eq, gt, and } from "drizzle-orm";

const DEFAULT_TTL_SECONDS = 60 * 60;

const memoryCache = new Map<string, { value: DrawboardArtifactRecord; expiresAt: number }>();

function normalizeGameId(gameId: string | null | undefined): string | null {
  const normalized = gameId?.trim();
  return normalized ? normalized : null;
}

export async function purgeGameDrawboardArtifacts(gameId: string): Promise<void> {
  const normalizedGameId = normalizeGameId(gameId);
  if (!normalizedGameId) return;

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.value.gameId === normalizedGameId) {
      memoryCache.delete(key);
    }
  }

  try {
    const db = getDb();
    await db
      .delete(drawboardArtifactCache)
      .where(eq(drawboardArtifactCache.gameId, normalizedGameId));
  } catch (error) {
    console.error("[drawboard-artifact-cache] failed to purge game artifacts", error);
  }
}

export async function getCachedDrawboardArtifact(key: string): Promise<DrawboardArtifactRecord | null> {
  const now = Date.now();
  const memory = memoryCache.get(key);
  if (memory && memory.expiresAt > now) {
    return memory.value;
  }
  if (memory) {
    memoryCache.delete(key);
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(drawboardArtifactCache)
      .where(
        and(
          eq(drawboardArtifactCache.key, key),
          gt(drawboardArtifactCache.expiresAt, new Date()),
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const record = row.data as DrawboardArtifactRecord;
    memoryCache.set(key, { value: record, expiresAt: now + DEFAULT_TTL_SECONDS * 1000 });
    return record;
  } catch (error) {
    console.error("[drawboard-artifact-cache] getCachedDrawboardArtifact failed", error);
    return null;
  }
}

export async function setCachedDrawboardArtifact(
  key: string,
  value: DrawboardArtifactRecord,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  memoryCache.set(key, { value, expiresAt: expiresAt.getTime() });

  try {
    const db = getDb();
    await db
      .insert(drawboardArtifactCache)
      .values({
        key,
        gameId: normalizeGameId(value.gameId),
        data: value as unknown as Record<string, unknown>,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: drawboardArtifactCache.key,
        set: {
          gameId: normalizeGameId(value.gameId),
          data: value as unknown as Record<string, unknown>,
          expiresAt,
        },
      });
  } catch (error) {
    console.error("[drawboard-artifact-cache] setCachedDrawboardArtifact failed", error);
  }
}
