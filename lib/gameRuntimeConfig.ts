import type { Game } from "@/components/default/games/types";

export const DEFAULT_MANUAL_DRAWBOARD_CAPTURE = false;
export const DEFAULT_REMOTE_SYNC_DEBOUNCE_MS = 500;
export const DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS = 48;

type GameRuntimeSlice = Pick<
  Game,
  "manualDrawboardCapture" | "remoteSyncDebounceMs" | "drawboardReloadDebounceMs"
>;

export function resolveManualDrawboardCapture(game: GameRuntimeSlice | null | undefined): boolean {
  if (typeof game?.manualDrawboardCapture === "boolean") {
    return game.manualDrawboardCapture;
  }
  return DEFAULT_MANUAL_DRAWBOARD_CAPTURE;
}

export function resolveRemoteSyncDebounceMs(game: GameRuntimeSlice | null | undefined): number {
  if (typeof game?.remoteSyncDebounceMs === "number" && Number.isFinite(game.remoteSyncDebounceMs)) {
    return Math.min(10_000, Math.max(0, Math.round(game.remoteSyncDebounceMs)));
  }
  return DEFAULT_REMOTE_SYNC_DEBOUNCE_MS;
}

function envDrawboardReloadDebounceMs(): number {
  const raw = process.env.NEXT_PUBLIC_DRAWBOARD_RELOAD_DEBOUNCE_MS;
  if (raw === undefined || raw === "") {
    return DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS;
  }
  return Math.min(10_000, Math.max(0, Math.round(n)));
}

export function resolveDrawboardReloadDebounceMs(game: GameRuntimeSlice | null | undefined): number {
  if (typeof game?.drawboardReloadDebounceMs === "number" && Number.isFinite(game.drawboardReloadDebounceMs)) {
    return Math.min(10_000, Math.max(0, Math.round(game.drawboardReloadDebounceMs)));
  }
  return envDrawboardReloadDebounceMs();
}
