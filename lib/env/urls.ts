function toValidAbsoluteUrl(raw: string, varName: string): string {
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`Invalid ${varName}: expected an absolute URL, got "${raw}"`);
  }
}

function trimToUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function nextAuthToAppRoot(nextAuthUrl: string | undefined): string | undefined {
  const raw = trimToUndefined(nextAuthUrl);
  if (!raw) return undefined;
  return raw.replace(/\/api\/auth\/?$/, "");
}

function hostFallback(request: Request): string {
  const host = request.headers.get("host") || "localhost:3000";
  return `http://${host}`;
}

export function resolveAppRootUrl(request: Request): string {
  const appRootRaw =
    trimToUndefined(process.env.APP_ROOT_URL)
    || trimToUndefined(process.env.NEXT_PUBLIC_APP_URL)
    || nextAuthToAppRoot(process.env.NEXTAUTH_URL)
    || hostFallback(request);

  return toValidAbsoluteUrl(appRootRaw, "APP_ROOT_URL / NEXT_PUBLIC_APP_URL / NEXTAUTH_URL");
}

function joinAppPath(basePath: string, routePath: string): string {
  const normalizedBase = basePath === "/" ? "" : basePath.replace(/\/+$/, "");
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${normalizedBase}${normalizedRoute}` || "/";
}

export function resolveAppRouteUrl(request: Request, path: string): string {
  const appRoot = new URL(resolveAppRootUrl(request));
  appRoot.pathname = joinAppPath(appRoot.pathname, path);
  appRoot.search = "";
  appRoot.hash = "";
  return appRoot.toString();
}

export function resolvePublicSiteUrl(): string | undefined {
  const appRoot = trimToUndefined(process.env.APP_ROOT_URL);
  if (appRoot) return toValidAbsoluteUrl(appRoot, "APP_ROOT_URL");

  const publicApp = trimToUndefined(process.env.NEXT_PUBLIC_APP_URL);
  if (publicApp) return toValidAbsoluteUrl(publicApp, "NEXT_PUBLIC_APP_URL");

  return undefined;
}
