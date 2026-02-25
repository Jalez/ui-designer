import { CURSOR_COLORS } from "./constants";

export function generateClientId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
}

export function generateUserColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

export function isCursorValid(cursor: { x: number; y: number; ts: number }): boolean {
  if (typeof cursor.x !== "number" || typeof cursor.y !== "number") {
    return false;
  }
  if (isNaN(cursor.x) || isNaN(cursor.y)) {
    return false;
  }
  return true;
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  }) as T;
}

export function getWebSocketUrl(): string {
  const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3100";
  return wsUrl.replace("ws://", "http://").replace("wss://", "https://");
}
