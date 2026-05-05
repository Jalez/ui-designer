import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { getGameById } from "@/app/api/_lib/services/gameService";
import {
  isManagedGameThumbnailUrl,
  writeManagedGameThumbnail,
} from "@/app/api/_lib/services/gameService/thumbnailStorage";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isForbiddenPrivateIpAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }

  if (normalized.includes(":")) {
    if (
      normalized === "::1" ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd")
    ) {
      return true;
    }
  }

  return false;
}

function validateSourceUrl(raw: unknown): URL {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("sourceUrl is required");
  }

  const url = new URL(raw.trim());
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error("Only http(s) thumbnail URLs are allowed");
  }
  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase()) || url.hostname.toLowerCase().endsWith(".local")) {
    throw new Error("Private or local network thumbnail URLs are not allowed");
  }
  return url;
}

async function assertPublicRemoteHost(url: URL): Promise<void> {
  const ipType = isIP(url.hostname);
  if (ipType > 0) {
    if (isForbiddenPrivateIpAddress(url.hostname)) {
      throw new Error("Private or local network thumbnail URLs are not allowed");
    }
    return;
  }

  const resolved = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => {
    throw new Error("Failed to resolve thumbnail host");
  });
  if (!resolved || resolved.length === 0) {
    throw new Error("Failed to resolve thumbnail host");
  }
  if (resolved.some((entry) => isForbiddenPrivateIpAddress(entry.address))) {
    throw new Error("Private or local network thumbnail URLs are not allowed");
  }
}

async function downloadSourceBuffer(url: URL): Promise<Buffer> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch thumbnail URL (${response.status})`);
  }

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const bytes = Number(lengthHeader);
    if (Number.isFinite(bytes) && bytes > MAX_SOURCE_BYTES) {
      throw new Error("Thumbnail file is too large");
    }
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Thumbnail file is too large");
  }

  return buffer;
}

async function convertToWebp(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { limitInputPixels: 16_000_000 })
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("Unsupported or invalid image format");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const game = await getGameById(id, actorIdentifiers);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (!game.can_edit) {
      return NextResponse.json({ error: "No edit access for this game" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const rawSourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    if (!rawSourceUrl) {
      return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
    }

    // Already managed by this app; no duplicate file write needed.
    if (isManagedGameThumbnailUrl(rawSourceUrl)) {
      const managedPath = rawSourceUrl.startsWith("http")
        ? new URL(rawSourceUrl).pathname
        : rawSourceUrl;
      return NextResponse.json({ thumbnailUrl: managedPath, managed: true });
    }

    const sourceUrl = validateSourceUrl(rawSourceUrl);
    await assertPublicRemoteHost(sourceUrl);

    const sourceBuffer = await downloadSourceBuffer(sourceUrl);
    const webpBuffer = await convertToWebp(sourceBuffer);
    const thumbnailUrl = await writeManagedGameThumbnail(game.id, webpBuffer);

    return NextResponse.json({ thumbnailUrl, managed: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save thumbnail";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
