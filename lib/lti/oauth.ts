import crypto from "crypto";

export function createOAuthInstance(consumerKey: string, consumerSecret: string) {
  return {
    validateSignature(
      method: string,
      url: string,
      params: Record<string, string>,
      body: Record<string, string>
    ): boolean {
      const consumerKeyFromRequest = params.oauth_consumer_key;
      if (consumerKeyFromRequest !== consumerKey) {
        return false;
      }

      const oauthSignature = params.oauth_signature;
      if (!oauthSignature) {
        return false;
      }

      const baseString = buildBaseString(method, url, params, body);
      const expectedSignature = crypto
        .createHmac("sha1", `${consumerSecret}&`)
        .update(baseString)
        .digest("base64");

      return oauthSignature === expectedSignature;
    },
  };
}

function buildBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
  body: Record<string, string>
): string {
  const allParams: Record<string, string> = { ...params, ...body };
  delete allParams.oauth_signature;

  const encodedParams = Object.entries(allParams)
    .filter(([key]) => key.startsWith("oauth_") || !key.startsWith("oauth_"))
    .map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(value || "")])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const encodedUrl = encodeURIComponent(url.split("?")[0]);
  const encodedParamsStr = encodeURIComponent(encodedParams);

  return `${method.toUpperCase()}&${encodedUrl}&${encodedParamsStr}`;
}

export function verifyLtiRequest(
  method: string,
  url: string,
  headers: Record<string, string | undefined>,
  body: Record<string, string>,
  consumerKey: string,
  consumerSecret: string
): boolean {
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader) {
    return false;
  }

  const params = parseOAuthHeader(authHeader);
  const oauth = createOAuthInstance(consumerKey, consumerSecret);

  return oauth.validateSignature(method, url, params, body);
}

function parseOAuthHeader(authHeader: string): Record<string, string> {
  const params: Record<string, string> = {};
  const oauthMatch = authHeader.match(/OAuth\s+(.+)/i);

  if (!oauthMatch) {
    return params;
  }

  const paramString = oauthMatch[1];
  const regex = /(\w+)="([^"]*)"/g;
  let match;

  while ((match = regex.exec(paramString)) !== null) {
    params[match[1]] = decodeURIComponent(match[2]);
  }

  return params;
}
