import { createHash } from "crypto";
import type { Lti10Data } from "./types";

export type LtiIdentitySource =
  | "lis_person_sourcedid"
  | "custom_user_id"
  | "custom_student_id"
  | "ext_user_username"
  | "ext_user_id"
  | "user_id"
  | "lis_person_contact_email_primary";

export interface ResolvedLtiIdentity {
  source: LtiIdentitySource;
  rawValue: string;
  key: string;
  email: string;
  confidence: "strong" | "weak";
}

function firstNonEmpty(ltiData: Lti10Data, keys: string[]): { key: string; value: string } | null {
  for (const key of keys) {
    const raw = ltiData[key];
    if (!raw) continue;
    const value = raw.trim();
    if (!value) continue;
    return { key, value };
  }
  return null;
}

export function resolveLtiIdentity(ltiData: Lti10Data, consumerKey: string): ResolvedLtiIdentity {
  const strong = firstNonEmpty(ltiData, [
    "lis_person_sourcedid",
    "custom_user_id",
    "custom_student_id",
    "ext_user_username",
    "ext_user_id",
  ]);

  const weak = firstNonEmpty(ltiData, [
    "user_id",
    "lis_person_contact_email_primary",
  ]);

  const picked = strong ?? weak;
  if (!picked) {
    throw new Error("No LTI identity fields present");
  }

  const source = picked.key as LtiIdentitySource;
  const confidence = strong ? "strong" : "weak";
  const key = `${consumerKey}:${source}:${picked.value}`;

  const digest = createHash("sha256").update(key).digest("hex").slice(0, 24);
  const email = `lti-${digest}@lti.local`;

  return {
    source,
    rawValue: picked.value,
    key,
    email,
    confidence,
  };
}
