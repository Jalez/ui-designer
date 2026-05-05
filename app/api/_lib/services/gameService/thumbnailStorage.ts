import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";

export const MANAGED_GAME_THUMBNAIL_PREFIX = "/uploads/game-thumbnails";
const MANAGED_GAME_THUMBNAIL_ROOT = path.join(
  process.cwd(),
  "public",
  MANAGED_GAME_THUMBNAIL_PREFIX.replace(/^\//, ""),
);

function normalizeSourcePath(value: string): string {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    return parsed.pathname || "";
  } catch {
    return value;
  }
}

export function isManagedGameThumbnailUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  const pathname = normalizeSourcePath(url).trim();
  return pathname.startsWith(`${MANAGED_GAME_THUMBNAIL_PREFIX}/`);
}

function sanitizeGameIdForPath(gameId: string): string {
  return gameId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function resolveManagedGameThumbnailPath(url: string): string | null {
  if (!isManagedGameThumbnailUrl(url)) {
    return null;
  }

  const pathname = normalizeSourcePath(url).split("?")[0]?.split("#")[0] ?? "";
  const relativePath = pathname.slice(MANAGED_GAME_THUMBNAIL_PREFIX.length + 1);
  const absolutePath = path.resolve(MANAGED_GAME_THUMBNAIL_ROOT, relativePath);

  if (!absolutePath.startsWith(`${MANAGED_GAME_THUMBNAIL_ROOT}${path.sep}`)) {
    return null;
  }

  return absolutePath;
}

export async function writeManagedGameThumbnail(gameId: string, buffer: Buffer): Promise<string> {
  const safeGameId = sanitizeGameIdForPath(gameId);
  const relativeDir = path.join(safeGameId);
  const absoluteDir = path.join(MANAGED_GAME_THUMBNAIL_ROOT, relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.webp`;
  const absolutePath = path.join(absoluteDir, filename);
  await writeFile(absolutePath, buffer);

  return `${MANAGED_GAME_THUMBNAIL_PREFIX}/${relativeDir}/${filename}`;
}

export async function deleteManagedGameThumbnailByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !isManagedGameThumbnailUrl(url)) {
    return;
  }

  const absolutePath = resolveManagedGameThumbnailPath(url);
  if (!absolutePath) {
    return;
  }

  await rm(absolutePath, { force: true });
}
