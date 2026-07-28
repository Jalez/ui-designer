import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { isLti10Launch, extractLtiUserInfo, getLtiRole, Lti10Data, extractLtiOutcomeService } from "@/lib/lti/types";
import { resolveLtiIdentity } from "@/lib/lti/identity";
import { getOrCreateUserByEmail, getUserByEmail, updateUserEmail, updateUserProfile } from "@/app/api/_lib/services/userService";
import { getSql } from "@/app/api/_lib/db";
import { logDebug } from "@/lib/debug-logger";
import { createOneTimeCode } from "@/lib/lti/one-time-code";
import { resolveAppRootUrl, resolveAppRouteUrl } from "@/lib/env/urls";
import { createOAuthInstance } from "@/lib/lti/oauth";
import { consumeLtiNonce } from "@/lib/lti/nonce";
import {
  LTI_SESSION_COOKIE_NAME,
  LTI_SESSION_MAX_AGE_SECONDS,
  signLtiSession,
  type LtiSession,
} from "@/lib/lti/session";

export async function POST(request: NextRequest) {
  try {
    logDebug("lti_launch_start", {});

    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else {
      body = await request.json();
    }

    if (!isLti10Launch(body)) {
      return NextResponse.json({ error: "Not a valid LTI 1.0 launch" }, { status: 400 });
    }

    const ltiData = body as Lti10Data;
    const customFields = Object.fromEntries(
      Object.entries(ltiData).filter(([key, value]) => key.startsWith("custom_") && !!value)
    );

    logDebug("lti_launch_lti_data", {
      user_id: ltiData.user_id,
      lis_person_contact_email_primary: ltiData.lis_person_contact_email_primary,
      lis_person_sourcedid: ltiData.lis_person_sourcedid,
      lis_person_name_given: ltiData.lis_person_name_given,
      lis_person_name_family: ltiData.lis_person_name_family,
      custom_user_id: ltiData.custom_user_id,
      custom_student_id: ltiData.custom_student_id,
      custom_group_id: ltiData.custom_group_id,
      custom_group: ltiData.custom_group,
      custom_group_name: ltiData.custom_group_name,
      ext_user_username: ltiData.ext_user_username,
      ext_user_id: ltiData.ext_user_id,
      customFields,
      context_id: ltiData.context_id,
      oauth_consumer_key: ltiData.oauth_consumer_key,
    });

    const sql = await getSql();
    const credResult = await sql.query(
      "SELECT consumer_key, consumer_secret FROM lti_credentials WHERE consumer_key = $1",
      [ltiData.oauth_consumer_key]
    );
    const credRows = Array.isArray(credResult)
      ? credResult
      : ("rows" in credResult ? credResult.rows : []);
    if (!credRows || credRows.length === 0) {
      return NextResponse.json({ error: "Consumer key not found" }, { status: 401 });
    }
    const { consumer_key, consumer_secret } = credRows[0];

    // Verify the OAuth 1.0 signature before anything can establish a session.
    // A consumer key alone is not a secret, so it must never be enough to sign in.
    const oauthParams: Record<string, string> = {};
    const bodyParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith("oauth_")) {
        oauthParams[key] = value;
      } else {
        bodyParams[key] = value;
      }
    }
    const canonicalUrl = resolveAppRouteUrl(request, "/api/lti/launch");
    const oauth = createOAuthInstance(consumer_key, consumer_secret);
    if (!oauth.validateSignature("POST", canonicalUrl, oauthParams, bodyParams)) {
      logDebug("lti_launch_signature_rejected", { oauth_consumer_key: ltiData.oauth_consumer_key });
      return NextResponse.json({ error: "Invalid LTI signature" }, { status: 401 });
    }

    const nonceCheck = await consumeLtiNonce(consumer_key, ltiData.oauth_nonce, ltiData.oauth_timestamp);
    if (!nonceCheck.ok) {
      logDebug("lti_launch_replay_rejected", { reason: nonceCheck.reason });
      return NextResponse.json({ error: "Stale or replayed LTI launch" }, { status: 401 });
    }

    const userInfo = extractLtiUserInfo(ltiData);
    const identity = resolveLtiIdentity(ltiData, consumer_key);
    const requireStrongIdentity = process.env.LTI_REQUIRE_STRONG_IDENTITY_LAUNCH
      ? process.env.LTI_REQUIRE_STRONG_IDENTITY_LAUNCH === "true"
      : process.env.LTI_REQUIRE_STRONG_IDENTITY === "true";

    if (
      identity.confidence === "weak" &&
      requireStrongIdentity
    ) {
      logDebug("lti_launch_identity_rejected", {
        reason: "weak_identity",
        identitySource: identity.source,
      });
      return NextResponse.json(
        {
          error:
            "LTI launch rejected: LMS did not provide a strong unique user identifier (e.g. lis_person_sourcedid/custom_user_id).",
        },
        { status: 422 }
      );
    }

    const syntheticEmail = identity.email;
    const preferredEmail = userInfo.email?.trim() || syntheticEmail;

    logDebug("lti_launch_resolved_email", {
      identitySource: identity.source,
      identityConfidence: identity.confidence,
      userInfoEmail: userInfo.email,
      preferredEmail,
      syntheticEmail,
    });

    let user = await getUserByEmail(preferredEmail);
    if (!user && preferredEmail !== syntheticEmail) {
      const syntheticUser = await getUserByEmail(syntheticEmail);
      if (syntheticUser) {
        user = await updateUserEmail(syntheticUser.id, preferredEmail);
      }
    }
    if (!user) {
      user = await getOrCreateUserByEmail(preferredEmail);
    }

    logDebug("lti_launch_db_user", {
      dbUserId: user.id,
      dbUserEmail: user.email,
      dbUserName: user.name,
    });

    if (userInfo.name && !user.name) {
      await updateUserProfile(user.id, { name: userInfo.name });
    }

    const role = getLtiRole(userInfo.roles);
    const groupName = userInfo.contextTitle || userInfo.contextId || `LTI Group ${Date.now()}`;

    logDebug("lti_launch_group", {
      groupId: null,
      groupName,
      groupContextKey: null,
      groupScopeSource: "pending",
      role,
    });

    const outcomeService = extractLtiOutcomeService(ltiData, consumer_key);

    const documentTarget = ltiData.launch_presentation_document_target || "window";
    const returnUrl = ltiData.launch_presentation_return_url;

    const ltiSession: LtiSession = {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || userInfo.name || user.email,
      groupId: null,
      groupName,
      groupResolution: "pending" as const,
      role,
      outcomeService,
      documentTarget,
      returnUrl,
      ltiData: {
        context_id: ltiData.context_id,
        context_title: ltiData.context_title,
        resource_link_id: ltiData.resource_link_id,
        user_id: ltiData.user_id,
        roles: ltiData.roles,
        lis_outcome_service_url: ltiData.lis_outcome_service_url,
        lis_result_sourcedid: ltiData.lis_result_sourcedid,
        custom_context_api: ltiData.custom_context_api,
        custom_context_api_id: ltiData.custom_context_api_id,
        custom_user_api_token: ltiData.custom_user_api_token,
        custom_student_id: ltiData.custom_student_id,
        _aplus_group: ltiData._aplus_group,
      },
    };

    // App root URL for redirects (browsers must hit this, not Docker-internal request.url).
    // Prefer APP_ROOT_URL (server-only, never inlined) so prod redirects stay correct behind a proxy.
    const appRootUrl = resolveAppRootUrl(request);
    const isSecure = appRootUrl.startsWith("https");

    // Issue a short-lived signed JWT so the /auth/lti-login page can create
    // a real NextAuth session (via CredentialsProvider), making the user
    // fully authenticated throughout the app (sidebar, games list, etc.)
    const ltiSignInToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name || userInfo.name || user.email },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: "5m", issuer: "lti-launch" }
    );

    logDebug("lti_launch_jwt_created", {
      jwtUserId: user.id,
      jwtEmail: user.email,
      jwtName: user.name || userInfo.name || user.email,
      redirectDest: "/",
    });

    // Redirect with a one-time code instead of the JWT in the URL (code is exchanged server-side for the token).
    const dest = "/";
    const code = createOneTimeCode(ltiSignInToken, dest);
    // Use base path from app root URL so redirect stays under app root (e.g. /hello-ui/auth/lti-login).
    // Derive from appRootUrl so it works even when NEXT_PUBLIC_BASE_PATH is not set at runtime (e.g. Docker).
    const loginUrl = new URL(resolveAppRouteUrl(request, "/auth/lti-login"));
    loginUrl.searchParams.set("code", code);
    loginUrl.searchParams.set("dest", dest);

    const response = NextResponse.redirect(loginUrl);

    // Keep lti_session cookie so gameplay routes can resolve the LTI context
    // (group membership, outcome service, etc.) after redirect.
    response.cookies.set(LTI_SESSION_COOKIE_NAME, signLtiSession(ltiSession), {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: LTI_SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    logDebug("lti_launch_redirect", {
      redirectUrl: loginUrl.origin + loginUrl.pathname + "?code=...&dest=" + encodeURIComponent(dest),
      cookieSet: true,
    });

    return response;
  } catch (error) {
    logDebug("lti_launch_error", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to process LTI launch" },
      { status: 500 }
    );
  }
}
