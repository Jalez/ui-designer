const ACCESS_KEY_STORAGE_PREFIX = "ui-designer-game-access-key:";

function getAccessKeyStorageKey(gameId: string): string {
  return `${ACCESS_KEY_STORAGE_PREFIX}${gameId}`;
}

export function readStoredAccessKey(gameId: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  const storageKey = getAccessKeyStorageKey(gameId);
  try {
    const sessionValue = window.sessionStorage.getItem(storageKey);
    if (sessionValue) {
      return sessionValue;
    }
  } catch {
    // Ignore storage failures in restricted environments.
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

export function persistAccessKey(gameId: string, accessKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getAccessKeyStorageKey(gameId);
  try {
    window.sessionStorage.setItem(storageKey, accessKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }

  try {
    window.localStorage.setItem(storageKey, accessKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function clearStoredAccessKey(gameId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getAccessKeyStorageKey(gameId);
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }
}
