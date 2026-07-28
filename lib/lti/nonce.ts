import { getSql } from "@/app/api/_lib/db";
import { extractRows } from "@/app/api/_lib/db/shared";

/** Launches are accepted only this far from server time (OAuth 1.0 replay window). */
export const LTI_TIMESTAMP_WINDOW_SECONDS = 5 * 60;

/** Nonces are remembered for the whole window on both sides of server time. */
const LTI_NONCE_TTL_SECONDS = LTI_TIMESTAMP_WINDOW_SECONDS * 2;

export interface LtiNonceResult {
  ok: boolean;
  reason?: "missing" | "stale" | "replayed";
}

/**
 * Record an LTI launch nonce, rejecting stale timestamps and nonces already seen
 * for the same consumer key. Call this only after the OAuth signature validates,
 * so unsigned requests cannot burn nonces.
 */
export async function consumeLtiNonce(
  consumerKey: string,
  nonce: string | undefined,
  timestamp: string | undefined
): Promise<LtiNonceResult> {
  if (!nonce || !timestamp) {
    return { ok: false, reason: "missing" };
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "missing" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > LTI_TIMESTAMP_WINDOW_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  const sql = await getSql();

  // Prune opportunistically: rows outside the window can never cause a replay hit.
  await sql.query("DELETE FROM lti_nonces WHERE expires_at < NOW()");

  const expiresAt = new Date((nowSeconds + LTI_NONCE_TTL_SECONDS) * 1000).toISOString();
  const insertResult = await sql.query(
    `INSERT INTO lti_nonces (consumer_key, nonce, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (consumer_key, nonce) DO NOTHING
     RETURNING nonce`,
    [consumerKey, nonce, expiresAt]
  );

  return extractRows(insertResult).length > 0 ? { ok: true } : { ok: false, reason: "replayed" };
}
