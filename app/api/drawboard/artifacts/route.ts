import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";

import {
  buildArtifactKey,
  type DrawboardArtifactRecord,
} from "@/lib/drawboard/artifactCache";
import { withAuth } from "@/app/api/_lib/middleware/auth";
import {
  getCachedDrawboardArtifact,
  setCachedDrawboardArtifact,
} from "@/app/api/_lib/services/drawboardArtifactCacheService";

// Captured boards are base64 PNG data URIs. Cap them so a single POST cannot
// inflate the cache, and keep the limit aligned with the websocket payload cap.
const MAX_DATA_URL_LENGTH = 6 * 1024 * 1024;
const IMAGE_DATA_URL_PREFIX = /^data:image\/(png|jpeg|webp);base64,/;
const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

const jsonSafeString = z.string().refine((value) => !value.includes("\0"), {
  message: "String fields cannot contain null bytes",
});

function isImageDataUrl(value: string): boolean {
  const prefix = IMAGE_DATA_URL_PREFIX.exec(value);
  if (!prefix) {
    return false;
  }
  return BASE64_BODY.test(value.slice(prefix[0].length));
}

const descriptorSchema = z.object({
  version: z.literal("v1"),
  captureMode: z.enum(["browser", "playwright"]),
  artifactType: z.enum(["solution", "solution-step"]),
  fingerprint: jsonSafeString.min(1),
  gameId: jsonSafeString.optional().nullable(),
  levelIdentifier: jsonSafeString.optional().nullable(),
  levelName: jsonSafeString.optional().nullable(),
  scenarioId: jsonSafeString.min(1),
  stepId: jsonSafeString.optional().nullable(),
  platformBucket: jsonSafeString.optional().nullable(),
  width: z.coerce.number().int().min(1).max(2000),
  height: z.coerce.number().int().min(1).max(2000),
});

const recordSchema = descriptorSchema.extend({
  key: z.string().optional(),
  dataUrl: z
    .string()
    .min(1)
    .max(MAX_DATA_URL_LENGTH)
    .refine(isImageDataUrl, { message: "dataUrl must be a base64 image data URI" }),
  pixelBufferBase64: z.string().max(MAX_DATA_URL_LENGTH).optional(),
  createdAt: z.string().optional(),
});

function resolveOwnerId(session?: Session): string {
  return session?.userId || session?.user?.email || "";
}

/** The owning account is server-side bookkeeping and never leaves the API. */
function toPublicRecord(record: DrawboardArtifactRecord): DrawboardArtifactRecord {
  const publicRecord = { ...record };
  delete publicRecord.ownerId;
  return publicRecord;
}

export const GET = withAuth(async (request: NextRequest) => {
  const parsed = descriptorSchema.safeParse({
    version: request.nextUrl.searchParams.get("version"),
    captureMode: request.nextUrl.searchParams.get("captureMode"),
    artifactType: request.nextUrl.searchParams.get("artifactType"),
    fingerprint: request.nextUrl.searchParams.get("fingerprint"),
    gameId: request.nextUrl.searchParams.get("gameId"),
    levelIdentifier: request.nextUrl.searchParams.get("levelIdentifier"),
    levelName: request.nextUrl.searchParams.get("levelName"),
    scenarioId: request.nextUrl.searchParams.get("scenarioId"),
    stepId: request.nextUrl.searchParams.get("stepId"),
    platformBucket: request.nextUrl.searchParams.get("platformBucket"),
    width: request.nextUrl.searchParams.get("width"),
    height: request.nextUrl.searchParams.get("height"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid artifact descriptor" }, { status: 400 });
  }
  const cached = await getCachedDrawboardArtifact(buildArtifactKey(parsed.data));
  if (!cached) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicRecord(cached));
});

export const POST = withAuth(async (request: NextRequest, _context: unknown, session?: Session) => {
  const raw = await request.json().catch(() => null);
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid artifact record" }, { status: 400 });
  }
  const ownerId = resolveOwnerId(session);
  if (!ownerId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const descriptor = parsed.data;
  const key = buildArtifactKey(descriptor);

  // The key is a content fingerprint any browser can recompute, so an entry stays
  // with the first account that wrote it: everyone may read it, but nobody else
  // may overwrite it while it is live.
  const existing = await getCachedDrawboardArtifact(key);
  if (existing?.ownerId && existing.ownerId !== ownerId) {
    return NextResponse.json({ ok: true, key, stored: false });
  }

  const record: DrawboardArtifactRecord = {
    ...descriptor,
    key,
    ownerId,
    createdAt: parsed.data.createdAt ?? new Date().toISOString(),
  };
  await setCachedDrawboardArtifact(key, record);
  return NextResponse.json({ ok: true, key, stored: true });
});
