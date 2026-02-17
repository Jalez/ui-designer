import { NextRequest, NextResponse } from "next/server";
import { getLtiSession, hasOutcomeService, isInIframe } from "@/lib/lti";
import { submitGrade } from "lti-v1.0-node-library";

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

    const result = await submitGrade(session.outcomeService!, normalizedGrade, 1.0);

    if (result.success) {
      console.log("Grade submitted successfully!");
      return NextResponse.json({
        success: true,
        message: `Grade ${points}/${maxPoints} (${Math.round(normalizedGrade * 100)}%) submitted successfully!`,
        isInIframe: isInIframe(session),
      });
    } else {
      console.error("Grade submission failed:", result.error);
      return NextResponse.json({
        success: false,
        error: result.error || "Grade submission failed",
        details: result.details,
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
