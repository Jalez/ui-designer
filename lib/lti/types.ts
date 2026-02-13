export interface Lti10Data {
  oauth_consumer_key?: string;
  oauth_signature?: string;
  oauth_signature_method?: string;
  oauth_timestamp?: string;
  oauth_nonce?: string;
  oauth_version?: string;
  lti_version?: string;
  lti_message_type?: string;
  resource_link_id?: string;
  user_id?: string;
  roles?: string;
  lis_person_name_given?: string;
  lis_person_name_family?: string;
  lis_person_contact_email_primary?: string;
  context_id?: string;
  context_label?: string;
  context_title?: string;
  launch_presentation_document_target?: string;
  launch_presentation_return_url?: string;
  lis_outcome_service_url?: string;
  lis_result_sourcedid?: string;
  [key: string]: string | undefined;
}

export interface LtiUserInfo {
  userId?: string;
  name?: string;
  email?: string;
  roles?: string;
  contextId?: string;
  contextLabel?: string;
  contextTitle?: string;
  resourceLinkId?: string;
}

export interface LtiOutcomeService {
  url: string;
  sourcedid: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface LtiSession {
  ltiData: {
    context_id?: string;
    context_title?: string;
    resource_link_id?: string;
    user_id?: string;
    roles?: string;
    lis_outcome_service_url?: string;
    lis_result_sourcedid?: string;
  };
  userInfo: LtiUserInfo;
  outcomeService?: LtiOutcomeService;
  groupId: string;
  returnUrl?: string;
}

export function extractLtiUserInfo(ltiData: Lti10Data): LtiUserInfo {
  return {
    userId: ltiData.user_id,
    name: `${ltiData.lis_person_name_given || ''} ${ltiData.lis_person_name_family || ''}`.trim(),
    email: ltiData.lis_person_contact_email_primary,
    roles: ltiData.roles,
    contextId: ltiData.context_id,
    contextLabel: ltiData.context_label,
    contextTitle: ltiData.context_title,
    resourceLinkId: ltiData.resource_link_id,
  };
}

export function extractLtiOutcomeService(
  ltiData: Lti10Data,
  consumerKey: string,
  consumerSecret: string
): LtiOutcomeService | undefined {
  if (!ltiData.lis_outcome_service_url || !ltiData.lis_result_sourcedid) {
    return undefined;
  }

  return {
    url: ltiData.lis_outcome_service_url,
    sourcedid: ltiData.lis_result_sourcedid,
    consumerKey,
    consumerSecret,
  };
}

export function isLti10Launch(body: unknown): body is Lti10Data {
  return !!(body && typeof body === "object" && (("oauth_consumer_key" in body) || ("lti_version" in body)));
}

export function getLtiRole(roles?: string): "instructor" | "member" {
  if (!roles) return "member";
  const lowerRoles = roles.toLowerCase();
  if (
    lowerRoles.includes("instructor") ||
    lowerRoles.includes("teacher") ||
    lowerRoles.includes("administrator") ||
    lowerRoles.includes("faculty")
  ) {
    return "instructor";
  }
  return "member";
}
