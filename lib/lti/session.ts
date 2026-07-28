import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { LtiOutcomeService } from "./types";

export interface LtiSession {
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string | null;
  groupName: string | null;
  groupResolution?: "resolved" | "pending";
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
    custom_context_api?: string;
    custom_context_api_id?: string;
    custom_user_api_token?: string;
    custom_student_id?: string;
    _aplus_group?: string;
  };
}

export const LTI_SESSION_COOKIE_NAME = "lti_session";
export const LTI_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

const SESSION_ISSUER = "lti-session";

function getSessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign the lti_session cookie");
  }
  return secret;
}

/**
 * Sign the LTI session for the cookie. The cookie is authentication for the
 * LTI-gated routes, so it must be a MAC'd token the browser cannot forge.
 */
export function signLtiSession(session: LtiSession): string {
  return jwt.sign(session, getSessionSecret(), {
    expiresIn: LTI_SESSION_MAX_AGE_SECONDS,
    issuer: SESSION_ISSUER,
  });
}

export async function getLtiSession(): Promise<LtiSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(LTI_SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    // Unsigned/tampered cookies (including pre-signing ones) throw and resolve to null.
    return jwt.verify(sessionCookie.value, getSessionSecret(), {
      issuer: SESSION_ISSUER,
    }) as LtiSession;
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
  cookieStore.delete(LTI_SESSION_COOKIE_NAME);
}
