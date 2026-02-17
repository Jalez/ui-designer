import { NextResponse } from "next/server";
import { getLtiSession, hasOutcomeService, isInIframe } from "@/lib/lti";

export async function GET() {
  const session = await getLtiSession();

  if (!session) {
    return NextResponse.json({
      isLtiMode: false,
      hasOutcomeService: false,
      isInIframe: false,
      courseName: null,
      returnUrl: null,
    });
  }

  return NextResponse.json({
    isLtiMode: true,
    hasOutcomeService: hasOutcomeService(session),
    isInIframe: isInIframe(session),
    courseName: session.groupName || session.ltiData.context_title || null,
    returnUrl: session.returnUrl || null,
    role: session.role,
  });
}
