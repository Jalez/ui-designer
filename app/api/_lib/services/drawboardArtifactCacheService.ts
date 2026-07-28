import type { DrawboardArtifactRecord } from "@/lib/drawboard/artifactCache";
import { getDb } from "@/lib/db";
import { drawboardArtifactCache } from "@/lib/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;
// The in-process cache is a best-effort read accelerator, so bound it: a burst of
// large artifacts must not be able to grow the Node heap without limit.
const MAX_MEMORY_CACHE_ENTRIES = 200;
const MAX_MEMORY_CACHE_BYTES = 64 * 1024 * 1024;
// Expired rows otherwise live forever; sweep them occasionally on write.
const EXPIRED_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

type MemoryCacheEntry = { value: DrawboardArtifactRecord; expiresAt: number; bytes: number };

const memoryCache = new Map<string, MemoryCacheEntry>();
let memoryCacheBytes = 0;
let lastExpiredSweepAt = 0;

function normalizeGameId(gameId: string | null | undefined): string | null {
  const normalized = gameId?.trim();
  return normalized ? normalized : null;
}

function estimateRecordBytes(value: DrawboardArtifactRecord): number {
  return value.dataUrl.length + (value.pixelBufferBase64?.length ?? 0);
}

function deleteMemoryEntry(key: string): boolean {
  const entry = memoryCache.get(key);
  if (!entry) return false;
  memoryCache.delete(key);
  memoryCacheBytes -= entry.bytes;
  return true;
}

function evictMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) {
      deleteMemoryEntry(key);
    }
  }
  // Map iteration follows insertion order, so the least recently written entries
  // are the ones dropped once either bound is exceeded.
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES || memoryCacheBytes > MAX_MEMORY_CACHE_BYTES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    deleteMemoryEntry(oldestKey);
  }
}

function setMemoryEntry(key: string, value: DrawboardArtifactRecord, expiresAt: number): void {
  deleteMemoryEntry(key);
  const bytes = estimateRecordBytes(value);
  memoryCache.set(key, { value, expiresAt, bytes });
  memoryCacheBytes += bytes;
  evictMemoryCache();
}

async function sweepExpiredArtifacts(db: ReturnType<typeof getDb>): Promise<void> {
  const now = Date.now();
  if (now - lastExpiredSweepAt < EXPIRED_SWEEP_INTERVAL_MS) return;
  lastExpiredSweepAt = now;
  await db.delete(drawboardArtifactCache).where(lt(drawboardArtifactCache.expiresAt, new Date()));
}

export async function purgeGameDrawboardArtifacts(gameId: string): Promise<number> {
  const normalizedGameId = normalizeGameId(gameId);
  if (!normalizedGameId) return 0;

  let deletedMemoryCount = 0;
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.value.gameId === normalizedGameId) {
      deleteMemoryEntry(key);
      deletedMemoryCount += 1;
    }
  }

  try {
    const db = getDb();
    const deletedRows = await db
      .delete(drawboardArtifactCache)
      .where(eq(drawboardArtifactCache.gameId, normalizedGameId))
      .returning();
    return deletedRows.length;
  } catch (error) {
    console.error("[drawboard-artifact-cache] failed to purge game artifacts", error);
    return deletedMemoryCount;
  }
}

export async function getCachedDrawboardArtifact(key: string): Promise<DrawboardArtifactRecord | null> {
  const now = Date.now();
  const memory = memoryCache.get(key);
  if (memory && memory.expiresAt > now) {
    return memory.value;
  }
  if (memory) {
    deleteMemoryEntry(key);
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
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const record = row.data as DrawboardArtifactRecord;
    setMemoryEntry(key, record, now + DEFAULT_TTL_SECONDS * 1000);
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
  setMemoryEntry(key, value, expiresAt.getTime());

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
    await sweepExpiredArtifacts(db);
  } catch (error) {
    console.error("[drawboard-artifact-cache] setCachedDrawboardArtifact failed", error);
  }
}
