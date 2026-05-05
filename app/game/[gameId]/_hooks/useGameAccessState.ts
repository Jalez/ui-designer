'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { clearStoredAccessKey, persistAccessKey, readStoredAccessKey } from "@/components/game-access/accessKeyStorage";
import { ACCESS_CLOSE_WARNING_THRESHOLD_MS } from "@/components/game-access/countdownFormat";
import { getCurrentAccessWindowEnd } from "@/lib/gameAccessWindows";

type GameAccessSurface = {
  accessWindowEnabled?: boolean;
  accessWindowTimezone?: string | null;
  accessWindows?: unknown;
  accessStartsAt?: Date | string | null;
  accessEndsAt?: Date | string | null;
} | null;

export function useGameAccessState({
  gameId,
  currentGame,
  isGameplaySurfaceActive,
  setSidebarVisible,
}: {
  gameId: string;
  currentGame: GameAccessSurface;
  isGameplaySurfaceActive: boolean;
  setSidebarVisible: (visible: boolean) => void;
}) {
  const [pendingOpenAt, setPendingOpenAt] = useState<Date | null>(null);
  const [pendingOpenTimeZone, setPendingOpenTimeZone] = useState<string | null>(null);
  const [isOpeningTransitioning, setIsOpeningTransitioning] = useState(false);
  const [requiresAccessKey, setRequiresAccessKey] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [submittedAccessKey, setSubmittedAccessKey] = useState("");
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [accessKeyReady, setAccessKeyReady] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [dismissedAccessWindowKey, setDismissedAccessWindowKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const storedAccessKey = readStoredAccessKey(gameId);
      setAccessKeyInput(storedAccessKey);
      setSubmittedAccessKey(storedAccessKey);
      setAccessKeyReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameId]);

  useEffect(() => {
    if (requiresAccessKey && hideSidebar) {
      setSidebarVisible(false);
    }
  }, [hideSidebar, requiresAccessKey, setSidebarVisible]);

  useEffect(() => {
    if (typeof window === "undefined" || !isGameplaySurfaceActive || !currentGame?.accessWindowEnabled) {
      return;
    }

    const syncTimeoutId = window.setTimeout(() => {
      setClockNow(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(syncTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [currentGame?.accessWindowEnabled, isGameplaySurfaceActive]);

  const currentAccessWindowEnd = useMemo(() => getCurrentAccessWindowEnd({
    enabled: Boolean(currentGame?.accessWindowEnabled),
    timeZone: currentGame?.accessWindowTimezone,
    windows: currentGame?.accessWindows,
    legacyStartsAt: currentGame?.accessStartsAt,
    legacyEndsAt: currentGame?.accessEndsAt,
    now: new Date(clockNow),
  }), [
    clockNow,
    currentGame?.accessEndsAt,
    currentGame?.accessStartsAt,
    currentGame?.accessWindowEnabled,
    currentGame?.accessWindowTimezone,
    currentGame?.accessWindows,
  ]);

  const currentAccessWindowKey = currentAccessWindowEnd?.toISOString() ?? null;
  const remainingAccessWindowMs = currentAccessWindowEnd
    ? currentAccessWindowEnd.getTime() - clockNow
    : null;
  const shouldShowClosingCountdown = Boolean(
    isGameplaySurfaceActive &&
    currentAccessWindowKey &&
    remainingAccessWindowMs &&
    remainingAccessWindowMs > 0 &&
    remainingAccessWindowMs <= ACCESS_CLOSE_WARNING_THRESHOLD_MS &&
    dismissedAccessWindowKey !== currentAccessWindowKey,
  );

  const handleCountdownReady = useCallback(() => {
    setIsOpeningTransitioning(true);
    setAccessKeyError(null);
    setReloadNonce((value) => value + 1);
  }, []);

  const continueWithAccessKey = useCallback(() => {
    setSubmittedAccessKey(accessKeyInput);
    setAccessKeyError(null);
    setReloadNonce((value) => value + 1);
  }, [accessKeyInput]);

  const showPendingOpenCountdown = useCallback((opensAt: Date | null, timeZone: string | null) => {
    setPendingOpenAt(opensAt);
    setPendingOpenTimeZone(timeZone);
    setIsOpeningTransitioning(false);
    setRequiresAccessKey(false);
  }, []);

  const clearPendingOpenCountdown = useCallback(() => {
    setPendingOpenAt(null);
    setPendingOpenTimeZone(null);
    setIsOpeningTransitioning(false);
  }, []);

  const showAccessKeyPrompt = useCallback((error: string, nextHideSidebar = false) => {
    clearStoredAccessKey(gameId);
    setSubmittedAccessKey("");
    setRequiresAccessKey(true);
    setAccessKeyError(error);
    setHideSidebar(nextHideSidebar);
    setPendingOpenAt(null);
    setPendingOpenTimeZone(null);
    setIsOpeningTransitioning(false);
  }, [gameId]);

  const clearAccessKeyPrompt = useCallback(() => {
    setRequiresAccessKey(false);
    setAccessKeyError(null);
  }, []);

  const persistSubmittedAccessKey = useCallback(() => {
    const normalizedAccessKey = submittedAccessKey.trim();
    if (normalizedAccessKey) {
      persistAccessKey(gameId, normalizedAccessKey);
    }
  }, [gameId, submittedAccessKey]);

  const dismissClosingCountdown = useCallback(() => {
    if (currentAccessWindowKey) {
      setDismissedAccessWindowKey(currentAccessWindowKey);
    }
  }, [currentAccessWindowKey]);

  return {
    pendingOpenAt,
    pendingOpenTimeZone,
    isOpeningTransitioning,
    requiresAccessKey,
    accessKeyInput,
    submittedAccessKey,
    accessKeyError,
    hideSidebar,
    accessKeyReady,
    reloadNonce,
    remainingAccessWindowMs,
    shouldShowClosingCountdown,
    setAccessKeyInput,
    setHideSidebar,
    setAccessKeyError,
    setIsOpeningTransitioning,
    handleCountdownReady,
    continueWithAccessKey,
    showPendingOpenCountdown,
    clearPendingOpenCountdown,
    showAccessKeyPrompt,
    clearAccessKeyPrompt,
    persistSubmittedAccessKey,
    dismissClosingCountdown,
  };
}
