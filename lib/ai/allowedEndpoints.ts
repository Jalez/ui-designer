/**
 * AI upstreams are restricted to an operator-controlled allowlist.
 *
 * The client may pass an apiEndpoint, but it can only ever select one of the
 * allowed upstreams: it can never point the server (and the server-side API key)
 * at a host of its own choosing.
 */

export const DEFAULT_AI_ENDPOINT = "https://openrouter.ai/api/v1";

// Always allowed: the providers this app ships support for.
const BUILT_IN_ENDPOINTS = [DEFAULT_AI_ENDPOINT, "https://api.openai.com/v1"];

/**
 * Reduce an endpoint to a stable absolute form so allowlist comparison cannot be
 * fooled by trailing slashes, query strings, or "/.." path traversal.
 */
function canonicalize(endpoint: string): string | null {
  try {
    const url = new URL(endpoint.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");

    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Every upstream base URL the server is permitted to call.
 */
export function getAllowedAiEndpoints(): string[] {
  const configured = [
    ...(process.env.AI_ALLOWED_API_ENDPOINTS || "").split(","),
    process.env.OPENROUTER_BASE_URL || "",
    ...BUILT_IN_ENDPOINTS,
  ];

  const allowed = new Set<string>();

  for (const entry of configured) {
    const canonical = canonicalize(entry);
    if (canonical) {
      allowed.add(canonical.toLowerCase());
    }
  }

  return Array.from(allowed);
}

/**
 * Resolve the upstream base URL for a request, falling back to the server default
 * when the caller supplied none.
 *
 * Returns null when the requested endpoint is not allowlisted; callers must reject
 * the request in that case rather than falling back, so no key is ever sent onward.
 */
export function resolveAllowedAiEndpoint(requestedEndpoint: unknown): string | null {
  const fallback = process.env.OPENROUTER_BASE_URL || DEFAULT_AI_ENDPOINT;
  const requested =
    typeof requestedEndpoint === "string" && requestedEndpoint.trim() ? requestedEndpoint : fallback;

  const canonical = canonicalize(requested);

  if (!canonical) {
    return null;
  }

  return getAllowedAiEndpoints().includes(canonical.toLowerCase()) ? canonical : null;
}

/**
 * fetch that refuses redirects, so an allowlisted upstream cannot bounce the
 * request — and the Authorization header with it — to another host.
 */
export const noRedirectFetch: typeof fetch = (input, init) => fetch(input, { ...init, redirect: "error" });
