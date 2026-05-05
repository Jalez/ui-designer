"use client";

import { useEffect, type MutableRefObject } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";

export function useGameUrlSync({
  currentLevel,
  isRouteWithProgress,
  levelsLength,
  normalizedPathname,
  routeGameId,
  router,
  searchParams,
  restoredRouteProgressScopeRef,
}: {
  currentLevel: number;
  isRouteWithProgress: boolean;
  levelsLength: number;
  normalizedPathname: string;
  routeGameId: string | undefined;
  router: { replace: (href: string) => void };
  searchParams: { get: (key: string) => string | null; toString: () => string };
  restoredRouteProgressScopeRef: MutableRefObject<string | null>;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    restoredRouteProgressScopeRef.current = null;
  }, [restoredRouteProgressScopeRef, routeGameId]);

  useEffect(() => {
    if (!isRouteWithProgress || !routeGameId || levelsLength === 0) {
      return;
    }

    if (restoredRouteProgressScopeRef.current === routeGameId) {
      return;
    }

    const savedLevel = Number(searchParams.get("level"));
    restoredRouteProgressScopeRef.current = routeGameId;

    if (!Number.isFinite(savedLevel) || savedLevel < 1) {
      return;
    }

    const normalizedLevel = Math.min(Math.max(1, savedLevel), levelsLength);
    if (normalizedLevel !== currentLevel) {
      dispatch(setCurrentLevel(normalizedLevel));
    }
  }, [
    currentLevel,
    dispatch,
    isRouteWithProgress,
    levelsLength,
    restoredRouteProgressScopeRef,
    routeGameId,
    searchParams,
  ]);

  useEffect(() => {
    if (!isRouteWithProgress || !routeGameId || levelsLength === 0) {
      return;
    }

    if (restoredRouteProgressScopeRef.current !== routeGameId) {
      return;
    }

    const clampedLevel = Math.min(Math.max(1, currentLevel), levelsLength);
    if (searchParams.get("level") === String(clampedLevel)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("level", String(clampedLevel));
    router.replace(`${normalizedPathname}?${params.toString()}`);
  }, [
    currentLevel,
    isRouteWithProgress,
    levelsLength,
    normalizedPathname,
    restoredRouteProgressScopeRef,
    routeGameId,
    router,
    searchParams,
  ]);
}
