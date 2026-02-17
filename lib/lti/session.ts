import { cookies } from "next/headers";
import type { LtiOutcomeService } from "./types";

export interface LtiSession {
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
  role: "instructor" | "member";
  outcomeService?: LtiOutcomeService;
  documentTarget?: string;
  returnUrl?: string;
  ltiData: {
    context_id?: string;
    context_title?: string;
    resource_link_id?: string;
    user_id?: string;
    roles?: string;
    lis_outcome_service_url?: string;
    lis_result_sourcedid?: string;
  };
}

const SESSION_COOKIE_NAME = "lti_session";

export async function getLtiSession(): Promise<LtiSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const parsed = JSON.parse(decodeURIComponent(sessionCookie.value));
    return parsed;
  } catch {
    return null;
  }
}

export function hasOutcomeService(session: LtiSession | null): boolean {
  return !!(session?.outcomeService?.url && session?.outcomeService?.sourcedid);
}

export function isInIframe(session: LtiSession | null): boolean {
  return session?.documentTarget === "iframe" || session?.documentTarget === "embed";
}

export async function clearLtiSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
