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

export function resolveAppUrl(request: Request, path: string): string {
  const appRoot = new URL(resolveAppRootUrl(request));
  const basePath = appRoot.pathname.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  appRoot.pathname = `${basePath}${normalizedPath}`.replace(/\/+/g, "/");
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
