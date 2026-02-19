import { NextRequest, NextResponse } from "next/server";
import { getLtiSession, hasOutcomeService, isInIframe } from "@/lib/lti";
import { submitGrade } from "lti-v1.0-node-library";

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

    // Explicit override wins when provided (e.g. http://localhost:8000).
    const originOverride = process.env.LTI_OUTCOME_ORIGIN;
    if (originOverride) {
      const overrideOrigin = new URL(originOverride);
      const overridden = new URL(parsed.pathname + parsed.search, overrideOrigin).toString();
      candidates.push(overridden);
    }

    // Dev fallback: Plussa can pass a Docker-internal IP that host-side Next.js can't reach.
    if (isPrivateIpHostname(parsed.hostname)) {
      const hostOverride = process.env.LTI_OUTCOME_HOST || "localhost";
      const fallback = new URL(originalUrl);
      fallback.hostname = hostOverride;
      candidates.push(fallback.toString());
    }

    // When ui-designer runs in Docker, "localhost" points to the app container itself.
    // Try common host->container bridge hostnames as fallbacks.
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

export async function POST(request: NextRequest) {
  try {
    const session = await getLtiSession();

    if (!session) {
      return NextResponse.json({
        success: false,
        error: "No LTI session found. Please launch from A+.",
      }, { status: 401 });
    }

    if (!hasOutcomeService(session)) {
      return NextResponse.json({
        success: false,
        error: "Grade submission is not available. The LTI launch did not include outcome service information.",
      }, { status: 400 });
    }

    const body = await request.json();
    const points = parseFloat(body.points) || 0;
    const maxPoints = parseFloat(body.maxPoints) || 100;

    if (points < 0 || maxPoints <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid points values.",
      }, { status: 400 });
    }

    const normalizedGrade = points / maxPoints;

    console.log("=== LTI Grade Submission ===");
    console.log("Points:", points, "/", maxPoints);
    console.log("Normalized grade:", normalizedGrade.toFixed(4));
    console.log("Outcome URL:", session.outcomeService?.url);

    const outcomeUrlCandidates = buildOutcomeUrlCandidates(session.outcomeService!.url);
    const attempts: Array<{ url: string; error: string; status?: number; details?: unknown }> = [];
    let successResult: Awaited<ReturnType<typeof submitGrade>> | null = null;

    for (const candidateUrl of outcomeUrlCandidates) {
      try {
        const result = await submitGrade(
          { ...session.outcomeService!, url: candidateUrl },
          normalizedGrade,
          1.0
        );

        if (result.success) {
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
      return NextResponse.json({
        success: true,
        message: `Grade ${points}/${maxPoints} (${Math.round(normalizedGrade * 100)}%) submitted successfully!`,
        isInIframe: isInIframe(session),
      });
    } else {
      console.error("Grade submission failed:", attempts);
      return NextResponse.json({
        success: false,
        error: attempts[0]?.error || "Grade submission failed",
        details: { attempts },
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error submitting grade:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
