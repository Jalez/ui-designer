let currentUserScope: string | null = null;
let currentGroupScope: string | null = null;

function safeSegment(value?: string | null): string {
  if (!value) return "unknown";
  return value.trim() || "unknown";
}

function getGroupIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/group\/([^/?#]+)/);
  return match?.[1] || null;
}

export function setClientStorageScope(scope: { userId?: string | null; groupId?: string | null }) {
  if (scope.userId) {
    currentUserScope = scope.userId;
  }

  if (scope.groupId) {
    currentGroupScope = scope.groupId;
  }
}

export function getClientStorageScope(): string {
  const userId = currentUserScope;
  const pathGroupId = typeof window !== "undefined" ? getGroupIdFromPathname(window.location.pathname) : null;
  const storedGroupId = currentGroupScope;
  const groupId = storedGroupId || pathGroupId;

  return `${safeSegment(groupId)}::${safeSegment(userId)}`;
}
