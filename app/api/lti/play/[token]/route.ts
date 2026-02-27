import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import {
  isLti10Launch,
  extractLtiUserInfo,
  getLtiRole,
  Lti10Data,
  extractLtiOutcomeService,
} from "@/lib/lti/types";
import { resolveLtiIdentity } from "@/lib/lti/identity";
import { deriveLtiGroupContext } from "@/lib/lti/group-context";
import { getOrCreateUserByEmail, getUserByEmail, updateUserProfile } from "@/app/api/_lib/services/userService";
import {
  getOrCreateGroupByLtiContext,
  addGroupMember,
} from "@/app/api/_lib/services/groupService";
import { getSql } from "@/app/api/_lib/db";
import { logDebug } from "@/lib/debug-logger";
import { authOptions } from "@/lib/auth";

// POST /api/lti/play/[token]
// LTI 1.0 launch endpoint for a specific game (identified by its share token).
// A+ (or any LMS) configures this URL as the launch URL for an embedded exercise.
// After validating credentials and authenticating the user, it redirects to /play/[token].
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: shareToken } = await params;

    logDebug("lti_play_start", { shareToken });

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

    logDebug("lti_play_lti_data", {
      user_id: ltiData.user_id,
      lis_person_contact_email_primary: ltiData.lis_person_contact_email_primary,
      lis_person_sourcedid: ltiData.lis_person_sourcedid,
      lis_person_name_given: ltiData.lis_person_name_given,
      lis_person_name_family: ltiData.lis_person_name_family,
      custom_user_id: ltiData.custom_user_id,
      custom_student_id: ltiData.custom_student_id,
      ext_user_username: ltiData.ext_user_username,
      ext_user_id: ltiData.ext_user_id,
      oauth_nonce: ltiData.oauth_nonce,
      customFields,
      context_id: ltiData.context_id,
      oauth_consumer_key: ltiData.oauth_consumer_key,
    });

    const sql = await getSql();

    // Validate consumer key against per-user credentials in DB
    const credResult = await sql.query(
      "SELECT consumer_key, consumer_secret FROM lti_credentials WHERE consumer_key = $1",
      [ltiData.oauth_consumer_key]
    );
    const credRows = (credResult as any).rows ?? credResult;
    if (!credRows || credRows.length === 0) {
      return NextResponse.json({ error: "Consumer key not found" }, { status: 401 });
    }
    const { consumer_key, consumer_secret } = credRows[0];

    const userInfo = extractLtiUserInfo(ltiData);
    const identity = resolveLtiIdentity(ltiData, consumer_key);
    const requireStrongIdentity = process.env.LTI_REQUIRE_STRONG_IDENTITY_PLAY
      ? process.env.LTI_REQUIRE_STRONG_IDENTITY_PLAY === "true"
      : process.env.LTI_REQUIRE_STRONG_IDENTITY === "true";

    if (
      identity.confidence === "weak" &&
      requireStrongIdentity
    ) {
      logDebug("lti_play_identity_rejected", {
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

    const browserScopedIdentity = process.env.LTI_PLAY_BROWSER_SCOPED_IDENTITY === "true";
    let browserId = request.cookies.get("lti_browser_id")?.value || "";
    let shouldSetBrowserIdCookie = false;

    if (browserScopedIdentity && !browserId) {
      browserId = randomUUID();
      shouldSetBrowserIdCookie = true;
    }

    const ltiUniqueEmail = browserScopedIdentity
      ? `lti-${createHash("sha256").update(`${identity.key}:browser:${browserId}`).digest("hex").slice(0, 24)}@lti.local`
      : identity.email;

    logDebug("lti_play_resolved_email", {
      identitySource: identity.source,
      identityConfidence: identity.confidence,
      browserScopedIdentity,
      userInfoEmail: userInfo.email,
      ltiUniqueEmail,
    });

    const ltiUser = await getOrCreateUserByEmail(ltiUniqueEmail);

    let user = ltiUser;
    const preserveSessionIdentity =
      process.env.LTI_PLAY_PRESERVE_SESSION_IDENTITY !== "false";

    if (preserveSessionIdentity) {
      const existingSession = await getServerSession(authOptions);
      const sessionEmail = existingSession?.user?.email || null;
      if (sessionEmail) {
        const sessionUser = await getUserByEmail(sessionEmail);
        if (sessionUser && sessionUser.id !== ltiUser.id) {
          user = sessionUser;
          logDebug("lti_play_identity_override", {
            strategy: "session_preferred",
            sessionUserId: sessionUser.id,
            sessionUserEmail: sessionUser.email,
            ltiUserId: ltiUser.id,
            ltiUserEmail: ltiUser.email,
            identitySource: identity.source,
          });
        }
      }
    }

    logDebug("lti_play_db_user", {
      dbUserId: user.id,
      dbUserEmail: user.email,
      dbUserName: user.name,
    });

    if (userInfo.name && !user.name) {
      await updateUserProfile(user.id, { name: userInfo.name });
    }

    // Create or find the LTI group (for grade posting context)
    const groupName = userInfo.contextTitle || userInfo.contextId || `LTI Group ${Date.now()}`;
    const ltiGroupContext = deriveLtiGroupContext(ltiData);
    const group = await getOrCreateGroupByLtiContext(
      ltiGroupContext.key,
      groupName,
      userInfo.resourceLinkId
    );
    const role = getLtiRole(userInfo.roles);
    await addGroupMember({ groupId: group.id, userId: user.id, role });

    logDebug("lti_play_group", {
      groupId: group.id,
      groupName: group.name,
      groupContextKey: ltiGroupContext.key,
      groupScopeSource: ltiGroupContext.scopeSource,
      role,
    });

    const outcomeService = extractLtiOutcomeService(ltiData, consumer_key, consumer_secret);
    const documentTarget = ltiData.launch_presentation_document_target || "window";
    const returnUrl = ltiData.launch_presentation_return_url;

    const ltiSession = {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || userInfo.name || user.email,
      groupId: group.id,
      groupName: group.name,
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
      },
    };

    // Look up the game by shareToken and decide routing mode:
    // - group: link to group and redirect to /group/[groupId]
    // - individual: keep users on /play/[token] for solo instances
    let collaborationMode: "individual" | "group" = "individual";
    const gameResult = await sql.query(
      "SELECT id, group_id, collaboration_mode FROM projects WHERE share_token = $1 LIMIT 1",
      [shareToken]
    );
    const gameRows = (gameResult as any).rows ?? gameResult;
    if (gameRows?.length) {
      collaborationMode = gameRows[0].collaboration_mode === "group" ? "group" : "individual";

      if (collaborationMode === "group") {
        const gameGroupId = gameRows[0].group_id;
        if (!gameGroupId) {
          await sql.query(
            "UPDATE projects SET group_id = $1 WHERE id = $2 AND group_id IS NULL",
            [group.id, gameRows[0].id]
          );
        }
      }
    }

    const appBaseUrl =
      process.env.NEXTAUTH_URL ||
      `http://${request.headers.get("host") || "localhost:3000"}`;
    const isSecure = appBaseUrl.startsWith("https");

    // Issue a short-lived JWT so /auth/lti-login can create a real NextAuth session
    const ltiSignInToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name || userInfo.name || user.email },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: "5m", issuer: "lti-launch" }
    );

    logDebug("lti_play_jwt_created", {
      jwtUserId: user.id,
      jwtEmail: user.email,
      jwtName: user.name || userInfo.name || user.email,
      redirectGroupId: group.id,
      collaborationMode,
    });

    const destination =
      collaborationMode === "group" ? `/group/${group.id}?mode=game` : `/play/${shareToken}?mode=game`;

    const loginUrl = new URL("/auth/lti-login", appBaseUrl);
    loginUrl.searchParams.set("token", ltiSignInToken);
    loginUrl.searchParams.set("dest", destination);

    const response = NextResponse.redirect(loginUrl);

    // Set lti_session so the play page and any outcome-service calls have the full LTI context
    response.cookies.set("lti_session", JSON.stringify(ltiSession), {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    if (browserScopedIdentity && shouldSetBrowserIdCookie) {
      response.cookies.set("lti_browser_id", browserId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      });
    }

    logDebug("lti_play_redirect", {
      redirectUrl: loginUrl.toString(),
      cookieSet: true,
    });

    return response;
  } catch (error) {
    logDebug("lti_play_error", { error: String(error) });
    return NextResponse.json({ error: "Failed to process LTI launch" }, { status: 500 });
  }
}
