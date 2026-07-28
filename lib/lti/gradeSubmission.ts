import { submitGrade } from "lti-v1.0-node-library";

import { getSql } from "@/app/api/_lib/db";
import { extractRows } from "@/app/api/_lib/db/shared";
import { hasOutcomeService, isInIframe, type LtiSession } from "./session";
import type { LtiOutcomeService } from "./types";

/** Outcome service plus the secret, which only ever exists server-side. */
type SignedOutcomeService = LtiOutcomeService & { consumerSecret: string };

/**
 * The consumer secret is never handed to the browser, so read it back from
 * `lti_credentials` when a grade actually needs to be signed.
 */
async function resolveConsumerSecret(consumerKey: string): Promise<string | null> {
  const sql = await getSql();
  const result = await sql.query(
    "SELECT consumer_secret FROM lti_credentials WHERE consumer_key = $1",
    [consumerKey]
  );
  const rows = extractRows(result) as Array<{ consumer_secret: string }>;
  return rows[0]?.consumer_secret ?? null;
}

function isPrivateIpHostname(hostname: string): boolean {
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (/^127\./.test(hostname)) return true;
  return false;
}

function buildOutcomeUrlCandidates(originalUrl: string): string[] {
  const candidates: string[] = [originalUrl];

  try {
    const parsed = new URL(originalUrl);

    const originOverride = process.env.LTI_OUTCOME_ORIGIN;
    if (originOverride) {
      const overrideOrigin = new URL(originOverride);
      const overridden = new URL(parsed.pathname + parsed.search, overrideOrigin).toString();
      candidates.push(overridden);
    }

    if (isPrivateIpHostname(parsed.hostname)) {
      const hostOverride = process.env.LTI_OUTCOME_HOST || "localhost";
      const fallback = new URL(originalUrl);
      fallback.hostname = hostOverride;
      candidates.push(fallback.toString());
    }

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const dockerFallbackHosts = (
        process.env.LTI_OUTCOME_DOCKER_HOSTS ||
        "host.docker.internal,172.17.0.1"
      )
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean);

      for (const host of dockerFallbackHosts) {
        const fallback = new URL(originalUrl);
        fallback.hostname = host;
        candidates.push(fallback.toString());
      }
    }
  } catch {
    // Keep only original URL when parsing fails.
  }

  return [...new Set(candidates)];
}

export interface GradeSubmissionResult {
  success: boolean;
  message?: string;
  error?: string;
  isInIframe: boolean;
  details?: { attempts: Array<{ url: string; error: string; status?: number; details?: unknown }> };
}

const OUTCOME_SUBMISSION_TIMEOUT_MS = Number.parseInt(
  process.env.LTI_OUTCOME_TIMEOUT_MS || "4000",
  10
);

async function submitGradeWithTimeout(
  outcomeService: SignedOutcomeService,
  grade: number,
  maxScore: number
) {
  return await Promise.race([
    submitGrade(outcomeService, grade, maxScore),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Outcome request timed out after ${OUTCOME_SUBMISSION_TIMEOUT_MS}ms`));
      }, OUTCOME_SUBMISSION_TIMEOUT_MS);
    }),
  ]);
}

function extractOutcomeResponseCode(response: unknown): string | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const root = response as Record<string, unknown>;
  const envelope =
    (root.imsx_POXEnvelopeResponse as Record<string, unknown> | undefined) ??
    (root["imsx_POXEnvelopeResponse"] as Record<string, unknown> | undefined);
  const header = Array.isArray(envelope?.imsx_POXHeader)
    ? envelope?.imsx_POXHeader?.[0]
    : envelope?.imsx_POXHeader;
  const info = Array.isArray((header as Record<string, unknown> | undefined)?.imsx_POXResponseHeaderInfo)
    ? (header as Record<string, unknown>).imsx_POXResponseHeaderInfo?.[0]
    : (header as Record<string, unknown> | undefined)?.imsx_POXResponseHeaderInfo;
  const statusInfo = Array.isArray((info as Record<string, unknown> | undefined)?.imsx_statusInfo)
    ? (info as Record<string, unknown>).imsx_statusInfo?.[0]
    : (info as Record<string, unknown> | undefined)?.imsx_statusInfo;
  const codeMajor = Array.isArray((statusInfo as Record<string, unknown> | undefined)?.imsx_codeMajor)
    ? (statusInfo as Record<string, unknown>).imsx_codeMajor?.[0]
    : (statusInfo as Record<string, unknown> | undefined)?.imsx_codeMajor;

  return typeof codeMajor === "string" ? codeMajor : null;
}

function extractOutcomeStatusInfo(response: unknown): string | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const root = response as Record<string, unknown>;
  const envelope =
    (root.imsx_POXEnvelopeResponse as Record<string, unknown> | undefined) ??
    (root["imsx_POXEnvelopeResponse"] as Record<string, unknown> | undefined);
  const header = Array.isArray(envelope?.imsx_POXHeader)
    ? envelope?.imsx_POXHeader?.[0]
    : envelope?.imsx_POXHeader;
  const info = Array.isArray((header as Record<string, unknown> | undefined)?.imsx_POXResponseHeaderInfo)
    ? (header as Record<string, unknown>).imsx_POXResponseHeaderInfo?.[0]
    : (header as Record<string, unknown> | undefined)?.imsx_POXResponseHeaderInfo;
  const statusInfo = Array.isArray((info as Record<string, unknown> | undefined)?.imsx_statusInfo)
    ? (info as Record<string, unknown>).imsx_statusInfo?.[0]
    : (info as Record<string, unknown> | undefined)?.imsx_statusInfo;
  const description = Array.isArray((statusInfo as Record<string, unknown> | undefined)?.imsx_description)
    ? (statusInfo as Record<string, unknown>).imsx_description?.[0]
    : (statusInfo as Record<string, unknown> | undefined)?.imsx_description;

  return typeof description === "string" ? description : null;
}

export async function submitOutcomeServiceGrade(
  outcomeService: LtiOutcomeService,
  points: number,
  maxPoints: number,
  options?: { isInIframe?: boolean },
): Promise<GradeSubmissionResult> {
  const iframe = options?.isInIframe ?? false;

  if (points < 0 || maxPoints <= 0) {
    return {
      success: false,
      error: "Invalid points values.",
      isInIframe: iframe,
    };
  }

  const consumerSecret = await resolveConsumerSecret(outcomeService.consumerKey);
  if (!consumerSecret) {
    return {
      success: false,
      error: "LTI consumer credentials are no longer available for grade submission.",
      isInIframe: iframe,
    };
  }
  const signedOutcomeService: SignedOutcomeService = { ...outcomeService, consumerSecret };

  const normalizedGrade = points / maxPoints;

  console.log("=== LTI Grade Submission ===");
  console.log("Points:", points, "/", maxPoints);
  console.log("Normalized grade:", normalizedGrade.toFixed(4));
  console.log("Outcome URL:", outcomeService.url);
  console.log("Sourced ID:", outcomeService.sourcedid);

  const outcomeUrlCandidates = buildOutcomeUrlCandidates(outcomeService.url);
  const attempts: Array<{ url: string; error: string; status?: number; details?: unknown }> = [];
  let successResult: Awaited<ReturnType<typeof submitGrade>> | null = null;

  for (const candidateUrl of outcomeUrlCandidates) {
    try {
      console.log("Trying outcome URL candidate:", candidateUrl);
      const result = await submitGradeWithTimeout(
        { ...signedOutcomeService, url: candidateUrl },
        normalizedGrade,
        1.0
      );

      if (result.success) {
        const responseCode = extractOutcomeResponseCode(result.response);
        const responseStatusInfo = extractOutcomeStatusInfo(result.response);
        console.log("Outcome response status code:", result.status ?? null);
        console.log("Outcome response code:", responseCode);
        if (responseStatusInfo) {
          console.log("Outcome response status:", responseStatusInfo);
        }
        if (responseCode == null) {
          try {
            console.log("Outcome response payload:", JSON.stringify(result.response));
          } catch {
            console.log("Outcome response payload could not be stringified");
          }
        }

        if (responseCode && responseCode.toLowerCase() !== "success") {
          attempts.push({
            url: candidateUrl,
            error: responseStatusInfo || `Outcome response code was ${responseCode}`,
            status: result.status,
            details: result.response,
          });
          continue;
        }

        successResult = result;
        break;
      }

      attempts.push({
        url: candidateUrl,
        error: result.error || "Grade submission failed",
        status: result.status,
        details: result.details,
      });
    } catch (error) {
      attempts.push({
        url: candidateUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (successResult?.success) {
    console.log("Grade submitted successfully!");
    return {
      success: true,
      message: `Grade ${points}/${maxPoints} (${Math.round(normalizedGrade * 100)}%) submitted successfully!`,
      isInIframe: iframe,
    };
  }

  console.error("Grade submission failed:", attempts);
  return {
    success: false,
    error: attempts[0]?.error || "Grade submission failed",
    details: { attempts },
    isInIframe: iframe,
  };
}

export async function submitLtiGrade(
  session: LtiSession | null,
  points: number,
  maxPoints: number,
): Promise<GradeSubmissionResult> {
  if (!session) {
    return {
      success: false,
      error: "No LTI session found. Please launch from A+.",
      isInIframe: false,
    };
  }

  if (!hasOutcomeService(session)) {
    return {
      success: false,
      error: "Grade submission is not available. The LTI launch did not include outcome service information.",
      isInIframe: isInIframe(session),
    };
  }

  return submitOutcomeServiceGrade(session.outcomeService, points, maxPoints, {
    isInIframe: isInIframe(session),
  });
}
