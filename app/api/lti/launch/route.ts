import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { isLti10Launch, extractLtiUserInfo, getLtiRole, Lti10Data, extractLtiOutcomeService } from "@/lib/lti/types";
import { resolveLtiIdentity } from "@/lib/lti/identity";
import { deriveLtiGroupContext } from "@/lib/lti/group-context";
import { getOrCreateUserByEmail, updateUserProfile } from "@/app/api/_lib/services/userService";
import {
  getOrCreateGroupByLtiContext,
  addGroupMember,
} from "@/app/api/_lib/services/groupService";
import { getSql } from "@/app/api/_lib/db";
import { logDebug } from "@/lib/debug-logger";

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
    const credRows = (credResult as any).rows ?? credResult;
    if (!credRows || credRows.length === 0) {
      return NextResponse.json({ error: "Consumer key not found" }, { status: 401 });
    }
    const { consumer_key, consumer_secret } = credRows[0];

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

    const ltiUniqueEmail = identity.email;

    logDebug("lti_launch_resolved_email", {
      identitySource: identity.source,
      identityConfidence: identity.confidence,
      userInfoEmail: userInfo.email,
      ltiUniqueEmail,
    });

    const user = await getOrCreateUserByEmail(ltiUniqueEmail);

    logDebug("lti_launch_db_user", {
      dbUserId: user.id,
      dbUserEmail: user.email,
      dbUserName: user.name,
    });

    if (userInfo.name && !user.name) {
      await updateUserProfile(user.id, { name: userInfo.name });
    }

    const groupName = userInfo.contextTitle || userInfo.contextId || `LTI Group ${Date.now()}`;
    const ltiGroupContext = deriveLtiGroupContext(ltiData);

    const group = await getOrCreateGroupByLtiContext(
      ltiGroupContext.key,
      groupName,
      userInfo.resourceLinkId
    );

    const role = getLtiRole(userInfo.roles);
    await addGroupMember({
      groupId: group.id,
      userId: user.id,
      role,
    });

    logDebug("lti_launch_group", {
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

    // Use NEXTAUTH_URL for the redirect base — request.url is the Docker-internal
    // bind address (0.0.0.0) which browsers can't navigate to.
    const appBaseUrl = process.env.NEXTAUTH_URL || `http://${request.headers.get("host") || "localhost:3000"}`;
    const isSecure = appBaseUrl.startsWith("https");

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

    // Build the lti-login redirect URL.
    // dest = home page — the user is logging in, not launching a specific embedded game.
    // (Specific game embedding uses the game's own share/play URL, not LTI launch.)
    const loginUrl = new URL("/auth/lti-login", appBaseUrl);
    loginUrl.searchParams.set("token", ltiSignInToken);
    loginUrl.searchParams.set("dest", "/");

    const response = NextResponse.redirect(loginUrl);

    // Keep lti_session cookie so /group/[groupId] still resolves the LTI context
    // (group membership, outcome service, etc.) when the user navigates there.
    response.cookies.set("lti_session", JSON.stringify(ltiSession), {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    logDebug("lti_launch_redirect", {
      redirectUrl: loginUrl.toString(),
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
