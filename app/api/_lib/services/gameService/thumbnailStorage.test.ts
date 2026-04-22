import { describe, expect, test } from "bun:test";
import {
  isManagedGameThumbnailUrl,
  resolveManagedGameThumbnailPath,
} from "./thumbnailStorage";

describe("thumbnailStorage managed URL helpers", () => {
  test("identifies relative managed URLs", () => {
    expect(isManagedGameThumbnailUrl("/uploads/game-thumbnails/game-1/file.webp")).toBe(true);
  });

  test("identifies absolute managed URLs by path", () => {
    expect(isManagedGameThumbnailUrl("https://example.com/uploads/game-thumbnails/game-1/file.webp")).toBe(true);
  });

  test("rejects non-managed URLs", () => {
    expect(isManagedGameThumbnailUrl("https://cdn.example.com/image.png")).toBe(false);
    expect(isManagedGameThumbnailUrl("/api/thumbnails/foo")).toBe(false);
  });

  test("rejects traversal paths outside managed directory", () => {
    expect(resolveManagedGameThumbnailPath("/uploads/game-thumbnails/../../etc/passwd")).toBeNull();
  });

  test("resolves managed relative path to absolute", () => {
    const resolved = resolveManagedGameThumbnailPath("/uploads/game-thumbnails/game-1/file.webp");
    expect(resolved).toBeString();
    expect(resolved?.endsWith("public/uploads/game-thumbnails/game-1/file.webp")).toBe(true);
  });
});
