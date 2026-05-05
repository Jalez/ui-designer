import { useGameStore } from "@/components/default/games";
import {
  resolveDrawboardCaptureMode,
  resolveDrawboardReloadDebounceMs,
  resolveManualDrawboardCapture,
  resolveRemoteSyncDebounceMs,
} from "@/lib/gameRuntimeConfig";

export type GameRuntimeConfig = {
  drawboardCaptureMode: "browser" | "playwright";
  manualDrawboardCapture: boolean;
  remoteSyncDebounceMs: number;
  drawboardReloadDebounceMs: number;
};

export function useGameRuntimeConfig(): GameRuntimeConfig {
  const game = useGameStore((s) =>
    s.currentGameId ? s.games.find((g) => g.id === s.currentGameId) ?? null : null,
  );

  return {
    drawboardCaptureMode: resolveDrawboardCaptureMode(game ?? undefined),
    manualDrawboardCapture: resolveManualDrawboardCapture(game ?? undefined),
    remoteSyncDebounceMs: resolveRemoteSyncDebounceMs(game ?? undefined),
    drawboardReloadDebounceMs: resolveDrawboardReloadDebounceMs(game ?? undefined),
  };
}
