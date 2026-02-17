import { createHash } from "crypto";
import type { Lti10Data } from "./types";
import { getLtiRole } from "./types";

export interface LtiGroupContext {
  key: string;
  baseContextId: string;
  scopeSource:
    | "custom_group_id"
    | "custom_group"
    | "custom_group_name"
    | "role_isolated"
    | "resource_link_and_sourcedid"
    | "resource_link_id"
    | "context_id"
    | "fallback";
}

function pickScope(ltiData: Lti10Data): { source: LtiGroupContext["scopeSource"]; value: string } {
  const includeSourcedid = process.env.LTI_GROUP_SCOPE_USE_SOURCEDID === "true";

  const candidates: Array<{ source: LtiGroupContext["scopeSource"]; value?: string }> = [
    { source: "custom_group_id", value: ltiData.custom_group_id },
    { source: "custom_group", value: ltiData.custom_group },
    { source: "custom_group_name", value: ltiData.custom_group_name },
    { source: "custom_group_id", value: ltiData.custom_submission_group_id },
    { source: "custom_group_id", value: ltiData.custom_aplus_group_id },
    {
      source: "resource_link_and_sourcedid",
      value:
        includeSourcedid && ltiData.resource_link_id && ltiData.lis_result_sourcedid
          ? `${ltiData.resource_link_id}::${ltiData.lis_result_sourcedid}`
          : undefined,
    },
    { source: "resource_link_id", value: ltiData.resource_link_id },
    { source: "context_id", value: ltiData.context_id },
  ];

  for (const candidate of candidates) {
    const value = candidate.value?.trim();
    if (value) {
      return { source: candidate.source, value };
    }
  }

  return {
    source: "fallback",
    value: `fallback-${Date.now()}`,
  };
}

export function deriveLtiGroupContext(ltiData: Lti10Data): LtiGroupContext {
  const baseContextId = ltiData.context_id?.trim() || "lti-context";
  const scope = pickScope(ltiData);
  let effectiveScopeSource = scope.source;
  let effectiveScopeValue = scope.value;

  const hasExplicitGroupScope =
    scope.source === "custom_group_id" ||
    scope.source === "custom_group" ||
    scope.source === "custom_group_name";

  if (getLtiRole(ltiData.roles) === "instructor" && !hasExplicitGroupScope) {
    const instructorId = ltiData.user_id?.trim() || "unknown-instructor";
    effectiveScopeSource = "role_isolated";
    effectiveScopeValue = `${scope.value}::instructor::${instructorId}`;
  }

  const scopeHash = createHash("sha256").update(effectiveScopeValue).digest("hex").slice(0, 16);

  return {
    key: `${baseContextId}::${scopeHash}`,
    baseContextId,
    scopeSource: effectiveScopeSource,
  };
}
