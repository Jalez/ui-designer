import type { DrawboardArtifactRecord } from "@/lib/drawboard/artifactCache";
import { createClient, type RedisClientType } from "redis";

const DEFAULT_TTL_SECONDS = 60 * 60;
const REDIS_RECORD_PREFIX = "drawboard-artifact:v1:record:";
const REDIS_GAME_INDEX_PREFIX = "drawboard-artifact:v1:game:";
const REDIS_SCAN_COUNT = 100;
const REDIS_INDEX_TTL_BUFFER_SECONDS = 24 * 60 * 60;
const memoryCache = new Map<string, { value: DrawboardArtifactRecord; expiresAt: number }>();
let nativeRedisClientPromise: Promise<RedisClientType | null> | null = null;

function nativeRedisUrl(): string {
  return (
    process.env.REDIS_URL
    || process.env.DRAWBOARD_REDIS_URL
    || ""
  ).trim();
}

function redisBaseUrl(): string {
  return (
    process.env.UPSTASH_REDIS_REST_URL
    || process.env.REDIS_REST_URL
    || ""
  ).trim();
}

function redisToken(): string {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.REDIS_REST_TOKEN
    || ""
  ).trim();
}

function hasRedisConfig(): boolean {
  return nativeRedisUrl().length > 0 || (redisBaseUrl().length > 0 && redisToken().length > 0);
}

function normalizeGameId(gameId: string | null | undefined): string | null {
  const normalized = gameId?.trim();
  return normalized ? normalized : null;
}

function recordStorageKey(key: string): string {
  return `${REDIS_RECORD_PREFIX}${key}`;
}

function gameArtifactIndexKey(gameId: string): string {
  return `${REDIS_GAME_INDEX_PREFIX}${gameId}`;
}

function parseArtifactRecord(raw: string | null | undefined): DrawboardArtifactRecord | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as DrawboardArtifactRecord;
  } catch {
    return null;
  }
}

function chunkStrings(items: Iterable<string>, size = REDIS_SCAN_COUNT): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const item of items) {
    current.push(item);
    if (current.length >= size) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function normalizeScanReply(value: unknown): { cursor: string; keys: string[] } {
  if (!Array.isArray(value) || value.length < 2) {
    return { cursor: "0", keys: [] };
  }
  return {
    cursor: String(value[0] ?? "0"),
    keys: Array.isArray(value[1]) ? value[1].filter((entry): entry is string => typeof entry === "string") : [],
  };
}

function normalizeBulkStrings(value: unknown): Array<string | null> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => (typeof entry === "string" ? entry : null));
}

async function getNativeRedisClient(): Promise<RedisClientType | null> {
  const url = nativeRedisUrl();
  if (!url) {
    return null;
  }
  if (!nativeRedisClientPromise) {
    nativeRedisClientPromise = (async () => {
      const client = createClient({
        url,
      });
      client.on("error", (error) => {
        console.error("[drawboard-artifact-cache] native redis error", error);
      });
      await client.connect();
      return client;
    })().catch((error) => {
      console.error("[drawboard-artifact-cache] failed to connect native redis", error);
      nativeRedisClientPromise = null;
      return null;
    });
  }
  return nativeRedisClientPromise;
}

async function upstashCommand(args: Array<string | number>): Promise<unknown> {
  const response = await fetch(redisBaseUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json().catch(() => null) as { result?: unknown } | null;
  return json?.result ?? null;
}

async function upstashGetRaw(storageKey: string): Promise<DrawboardArtifactRecord | null> {
  const result = await upstashCommand(["GET", storageKey]);
  return parseArtifactRecord(typeof result === "string" ? result : null);
}

async function upstashSet(key: string, value: DrawboardArtifactRecord, ttlSeconds: number): Promise<void> {
  const storageKey = recordStorageKey(key);
  await upstashCommand(["SET", storageKey, JSON.stringify(value), "EX", ttlSeconds]).catch(() => {});
  const gameId = normalizeGameId(value.gameId);
  if (!gameId) {
    return;
  }
  const indexKey = gameArtifactIndexKey(gameId);
  await upstashCommand(["SADD", indexKey, storageKey]).catch(() => {});
  await upstashCommand(["EXPIRE", indexKey, ttlSeconds + REDIS_INDEX_TTL_BUFFER_SECONDS]).catch(() => {});
}

async function upstashDeleteKeys(keys: Iterable<string>): Promise<void> {
  for (const chunk of chunkStrings(new Set(keys))) {
    await upstashCommand(["UNLINK", ...chunk]).catch(async () => {
      await upstashCommand(["DEL", ...chunk]).catch(() => {});
    });
  }
}

async function upstashScanSetMembers(setKey: string): Promise<string[]> {
  const members = new Set<string>();
  let cursor = "0";
  do {
    const result = normalizeScanReply(await upstashCommand(["SSCAN", setKey, cursor, "COUNT", REDIS_SCAN_COUNT]));
    cursor = result.cursor;
    result.keys.forEach((key) => members.add(key));
  } while (cursor !== "0");
  return [...members];
}

async function upstashScanArtifactKeysForGame(gameId: string): Promise<string[]> {
  const matchingKeys = new Set<string>();
  let cursor = "0";
  do {
    const result = normalizeScanReply(await upstashCommand(["SCAN", cursor, "TYPE", "string", "COUNT", REDIS_SCAN_COUNT]));
    cursor = result.cursor;
    if (result.keys.length === 0) {
      continue;
    }
    const values = normalizeBulkStrings(await upstashCommand(["MGET", ...result.keys]));
    result.keys.forEach((key, index) => {
      const record = parseArtifactRecord(values[index]);
      if (record?.gameId === gameId) {
        matchingKeys.add(key);
      }
    });
  } while (cursor !== "0");
  return [...matchingKeys];
}

async function upstashGet(key: string): Promise<DrawboardArtifactRecord | null> {
  return await upstashGetRaw(recordStorageKey(key)) ?? await upstashGetRaw(key);
}

async function nativeRedisGetRaw(storageKey: string): Promise<DrawboardArtifactRecord | null> {
  const client = await getNativeRedisClient();
  if (!client) {
    return null;
  }
  return parseArtifactRecord(await client.get(storageKey));
}

async function nativeRedisGet(key: string): Promise<DrawboardArtifactRecord | null> {
  return await nativeRedisGetRaw(recordStorageKey(key)) ?? await nativeRedisGetRaw(key);
}

async function nativeRedisSet(key: string, value: DrawboardArtifactRecord, ttlSeconds: number): Promise<void> {
  const client = await getNativeRedisClient();
  if (!client) {
    return;
  }
  const storageKey = recordStorageKey(key);
  await client.set(storageKey, JSON.stringify(value), {
    EX: ttlSeconds,
  });
  const gameId = normalizeGameId(value.gameId);
  if (!gameId) {
    return;
  }
  const indexKey = gameArtifactIndexKey(gameId);
  await client.sAdd(indexKey, storageKey);
  await client.expire(indexKey, ttlSeconds + REDIS_INDEX_TTL_BUFFER_SECONDS);
}

async function nativeRedisDeleteKeys(keys: Iterable<string>): Promise<void> {
  const client = await getNativeRedisClient();
  if (!client) {
    return;
  }
  for (const chunk of chunkStrings(new Set(keys))) {
    try {
      await client.sendCommand(["UNLINK", ...chunk]);
    } catch {
      await client.sendCommand(["DEL", ...chunk]);
    }
  }
}

async function nativeRedisScanSetMembers(setKey: string): Promise<string[]> {
  const client = await getNativeRedisClient();
  if (!client) {
    return [];
  }
  const members = new Set<string>();
  let cursor = "0";
  do {
    const result = normalizeScanReply(await client.sendCommand(["SSCAN", setKey, cursor, "COUNT", String(REDIS_SCAN_COUNT)]));
    cursor = result.cursor;
    result.keys.forEach((key) => members.add(key));
  } while (cursor !== "0");
  return [...members];
}

async function nativeRedisScanArtifactKeysForGame(gameId: string): Promise<string[]> {
  const client = await getNativeRedisClient();
  if (!client) {
    return [];
  }
  const matchingKeys = new Set<string>();
  let cursor = "0";
  do {
    const result = normalizeScanReply(await client.sendCommand(["SCAN", cursor, "TYPE", "string", "COUNT", String(REDIS_SCAN_COUNT)]));
    cursor = result.cursor;
    if (result.keys.length === 0) {
      continue;
    }
    const values = normalizeBulkStrings(await client.sendCommand(["MGET", ...result.keys]));
    result.keys.forEach((key, index) => {
      const record = parseArtifactRecord(values[index]);
      if (record?.gameId === gameId) {
        matchingKeys.add(key);
      }
    });
  } while (cursor !== "0");
  return [...matchingKeys];
}

function purgeMemoryArtifactsForGame(gameId: string): void {
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.value.gameId === gameId) {
      memoryCache.delete(key);
    }
  }
}

export async function purgeGameDrawboardArtifacts(gameId: string): Promise<void> {
  const normalizedGameId = normalizeGameId(gameId);
  if (!normalizedGameId) {
    return;
  }
  purgeMemoryArtifactsForGame(normalizedGameId);
  if (!hasRedisConfig()) {
    return;
  }
  try {
    const indexKey = gameArtifactIndexKey(normalizedGameId);
    const indexedKeys = nativeRedisUrl()
      ? await nativeRedisScanSetMembers(indexKey)
      : await upstashScanSetMembers(indexKey);
    const scannedKeys = nativeRedisUrl()
      ? await nativeRedisScanArtifactKeysForGame(normalizedGameId)
      : await upstashScanArtifactKeysForGame(normalizedGameId);
    const keysToDelete = new Set<string>([indexKey, ...indexedKeys, ...scannedKeys]);
    if (nativeRedisUrl()) {
      await nativeRedisDeleteKeys(keysToDelete);
    } else {
      await upstashDeleteKeys(keysToDelete);
    }
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
  if (hasRedisConfig()) {
    const cached = nativeRedisUrl()
      ? await nativeRedisGet(key)
      : await upstashGet(key);
    if (cached) {
      memoryCache.set(key, {
        value: cached,
        expiresAt: now + DEFAULT_TTL_SECONDS * 1000,
      });
      return cached;
    }
  }
  return null;
}

export async function setCachedDrawboardArtifact(
  key: string,
  value: DrawboardArtifactRecord,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  if (hasRedisConfig()) {
    if (nativeRedisUrl()) {
      await nativeRedisSet(key, value, ttlSeconds);
    } else {
      await upstashSet(key, value, ttlSeconds);
    }
  }
}
