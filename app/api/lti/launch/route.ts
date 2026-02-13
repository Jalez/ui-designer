import { NextRequest, NextResponse } from "next/server";
import { isLti10Launch, extractLtiUserInfo, getLtiRole, Lti10Data } from "@/lib/lti/types";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import {
  getOrCreateGroupByLtiContext,
  addGroupMember,
} from "@/app/api/_lib/services/groupService";

const CONSUMER_KEY = process.env.CONSUMER_KEY || "";

export async function POST(request: NextRequest) {
  try {
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

    if (ltiData.oauth_consumer_key !== CONSUMER_KEY) {
      return NextResponse.json({ error: "Consumer key mismatch" }, { status: 401 });
    }

    const userInfo = extractLtiUserInfo(ltiData);

    if (!userInfo.email) {
      return NextResponse.json(
        { error: "No user email provided in LTI launch" },
        { status: 400 }
      );
    }

    const user = await getOrCreateUserByEmail(userInfo.email);

    const groupName = userInfo.contextTitle || userInfo.contextId || `LTI Group ${Date.now()}`;
    const contextId = userInfo.contextId || `lti-${Date.now()}`;

    const group = await getOrCreateGroupByLtiContext(
      contextId,
      groupName,
      userInfo.resourceLinkId
    );

    const role = getLtiRole(userInfo.roles);
    await addGroupMember({
      groupId: group.id,
      userId: user.id,
      role,
    });

    const ltiSession = {
      userId: user.id,
      userEmail: user.email,
      userName: userInfo.name || user.email,
      groupId: group.id,
      groupName: group.name,
      role,
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

    const response = NextResponse.redirect(
      new URL(`/group/${group.id}`, request.url)
    );

    response.cookies.set("lti_session", JSON.stringify(ltiSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("LTI launch error:", error);
    return NextResponse.json(
      { error: "Failed to process LTI launch" },
      { status: 500 }
    );
  }
}
