"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { apiUrl } from "@/lib/apiUrl";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { mergeSavedPoints } from "@/store/slices/points.slice";
import { toast } from "sonner";
import { sanitizeReplayProgressData } from "@/lib/gameplay/sanitizeReplayProgressData";
import {
  selectEventStepRuntimeByStep,
  useEventStepRuntimeStore,
} from "@/events/core/eventStepRuntimeStore";
import { useArtboardReplayRuntimeStore } from "@/events/core/artboardReplayRuntimeStore";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceState";
import {
  buildArtifactKey,
  hashArtifactFingerprint,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import {
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";
import type { EventSequenceStep, Level, scenario as Scenario } from "@/types";

const SAVE_DEBOUNCE_MS = 2000;
const SOLUTION_STEP_ARTIFACTS_KEY = "solutionStepArtifacts";
const DRAWBOARD_IMAGE_PROGRESS_KEYS = [
  "drawingUrls",
  "drawingStepArtifacts",
  "drawingStepUrls",
  "drawboardArtifacts",
  "drawboardStepArtifacts",
  "drawboardStepUrls",
];

type SavedSolutionStepArtifacts = Record<string, Record<string, DrawboardArtifactDescriptor>>;
type ArtifactHydrationStatus = "in-flight" | "done";

function artifactDescriptorToSearchParams(descriptor: DrawboardArtifactDescriptor): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(descriptor).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });
  return params;
}

function getSolutionStepArtifactFingerprint(level: Level, scenario: Scenario, step: EventSequenceStep): string {
  const levelSolution = level.solution ?? { css: "", html: "", js: "" };
  const solutionFingerprint = solutionArtifactFingerprint({
    html: levelSolution.html ?? "",
    css: levelSolution.css ?? "",
    js: levelSolution.js ?? "",
    scenario,
  });

  return step.isInitial
    ? hashArtifactFingerprint(["solution-step", solutionFingerprint, step.id])
    : solutionStepArtifactFingerprint({ solutionFingerprint, step });
}

function stripDrawboardImageProgressData(progressData: Record<string, unknown>): Record<string, unknown> {
  const next = { ...progressData };
  DRAWBOARD_IMAGE_PROGRESS_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`);

  return `{${entries.join(",")}}`;
}

/**
 * When on a gameplay route, persists non-code progress to the game instance.
 * Code is owned by websocket room state and must not be written through HTTP here.
 */
export function ProgressPersistence() {
  const dispatch = useAppDispatch();
  const params = useParams();
  const searchParams = useSearchParams();
  const levels = useAppSelector((state) => state.levels);
  const points = useAppSelector((state) => state.points);
  const mode = useAppSelector((state) => state.options.mode);
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const addGameToStore = useGameStore((s) => s.addGameToStore);
  const collaboration = useOptionalCollaboration();
  const stepRuntimeByRuntimeKey = useEventStepRuntimeStore((state) => state.runtimeByRuntimeKey);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const inFlightSnapshotRef = useRef<string | null>(null);
  const lastAppliedProgressSyncTsRef = useRef<number | null>(null);
  const lastAppliedLtiGradeRefreshAtRef = useRef<string | null>(null);
  const lastAppliedResetNoticeAtRef = useRef<string | null>(null);
  const artifactHydrationStatusRef = useRef<Record<string, ArtifactHydrationStatus>>({});
  const postedArtifactDataUrlRef = useRef<Record<string, string>>({});

  const gameId = typeof params?.gameId === "string" ? params.gameId : Array.isArray(params?.gameId) ? params.gameId[0] : null;
  const isReplayView = searchParams.get("view") === "play";
  const platformBucket = getBrowserPlatformBucket();
  const captureMode = currentGame?.drawboardCaptureMode === "playwright" ? "playwright" : "browser";

  useEffect(() => {
    if (mode !== "game" || !currentGame?.progressData || levels.length === 0) {
      return;
    }
    const saved = (currentGame.progressData as Record<string, unknown>)[SOLUTION_STEP_ARTIFACTS_KEY];
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return;
    }

    levels.forEach((level, levelIndex) => {
      level.scenarios.forEach((scenario) => {
        const runtimeKey = getEventSequenceScenarioUiKey(levelIndex + 1, scenario.scenarioId);
        const byStep = (saved as SavedSolutionStepArtifacts)[runtimeKey];
        if (!byStep || typeof byStep !== "object" || Array.isArray(byStep)) {
          return;
        }
        const sequence = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
        sequence.forEach((step) => {
          const descriptor = byStep[step.id];
          if (!descriptor || descriptor.fingerprint !== getSolutionStepArtifactFingerprint(level, scenario, step)) {
            return;
          }
          const artifactKey = buildArtifactKey(descriptor);
          if (artifactHydrationStatusRef.current[artifactKey]) {
            return;
          }
          const currentRuntimeUrl = useEventStepRuntimeStore
            .getState()
            .runtimeByRuntimeKey[runtimeKey]?.[step.id]?.solutionUrl
            ?.trim();
          if (currentRuntimeUrl) {
            artifactHydrationStatusRef.current[artifactKey] = "done";
            return;
          }
          artifactHydrationStatusRef.current[artifactKey] = "in-flight";
          fetch(`${apiUrl("/api/drawboard/artifacts")}?${artifactDescriptorToSearchParams(descriptor).toString()}`)
            .then((response) => response.ok ? response.json() : null)
            .then((record) => {
              const url = typeof record?.dataUrl === "string" ? record.dataUrl : "";
              if (!url) {
                delete artifactHydrationStatusRef.current[artifactKey];
                return;
              }
              useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, step.id, {
                solutionUrl: url,
              });
              useArtboardReplayRuntimeStore.getState().setBoardStepFreshness(runtimeKey, "solution", step.id, () => ({
                imageUrl: url,
                capturedAt: Date.now(),
                isReady: true,
                isStale: false,
                lastRunId: null,
              }));
              artifactHydrationStatusRef.current[artifactKey] = "done";
            })
            .catch(() => {
              delete artifactHydrationStatusRef.current[artifactKey];
            });
        });
      });
    });
  }, [currentGame?.progressData, levels, mode]);

  useEffect(() => {
    lastSavedSnapshotRef.current = null;
    inFlightSnapshotRef.current = null;
    lastAppliedProgressSyncTsRef.current = null;
    lastAppliedLtiGradeRefreshAtRef.current = null;
    lastAppliedResetNoticeAtRef.current = null;
    artifactHydrationStatusRef.current = {};
    postedArtifactDataUrlRef.current = {};
  }, [gameId, currentGame?.id]);

  useEffect(() => {
    const syncMessage = collaboration?.lastProgressSync;
    const syncedProgressData = syncMessage?.progressData;
    if (!syncMessage || !syncedProgressData || mode !== "game" || !currentGame) {
      return;
    }

    if (lastAppliedProgressSyncTsRef.current === syncMessage.ts) {
      return;
    }

    const mergedProgressData = sanitizeReplayProgressData({
      ...(typeof currentGame.progressData === "object" && currentGame.progressData !== null ? currentGame.progressData : {}),
      ...syncedProgressData,
    }, isReplayView);

    const currentProgressSnapshot = stableSerialize(currentGame.progressData ?? {});
    const mergedProgressSnapshot = stableSerialize(mergedProgressData);

    lastAppliedProgressSyncTsRef.current = syncMessage.ts;

    if (currentProgressSnapshot !== mergedProgressSnapshot) {
      console.log("[ProgressPersistence] applying remote progress sync", {
        ts: syncMessage.ts,
        isReplayView,
        keys: Object.keys(syncedProgressData),
        mergedKeys: Object.keys(mergedProgressData),
      });
      addGameToStore({
        ...currentGame,
        progressData: mergedProgressData,
      });
    }

    const ltiGradeRefreshAt =
      typeof syncedProgressData.ltiGradeRefreshAt === "string"
        ? syncedProgressData.ltiGradeRefreshAt
        : null;

    if (
      ltiGradeRefreshAt &&
      ltiGradeRefreshAt !== lastAppliedLtiGradeRefreshAtRef.current
    ) {
      lastAppliedLtiGradeRefreshAtRef.current = ltiGradeRefreshAt;
      toast.info(
        "A group member has finished the game. Please click 'Finish game' to save your progress and submit your score to A+.",
      );
    }

    const resetNotice =
      syncedProgressData.resetNotice &&
      typeof syncedProgressData.resetNotice === "object" &&
      !Array.isArray(syncedProgressData.resetNotice)
        ? syncedProgressData.resetNotice as {
            scope?: unknown;
            userId?: unknown;
            userName?: unknown;
            userEmail?: unknown;
            at?: unknown;
          }
        : null;

    if (
      resetNotice?.at &&
      typeof resetNotice.at === "string" &&
      resetNotice.at !== lastAppliedResetNoticeAtRef.current
    ) {
      lastAppliedResetNoticeAtRef.current = resetNotice.at;
      const label =
        (typeof resetNotice.userName === "string" && resetNotice.userName) ||
        (typeof resetNotice.userEmail === "string" && resetNotice.userEmail) ||
        "Someone";
      toast.info(
        resetNotice.scope === "game"
          ? `${label} reset the game back to the template.`
          : `${label} reset this level back to the template.`,
      );
    }

    const pointsByLevel = syncedProgressData.pointsByLevel;
    if (pointsByLevel && typeof pointsByLevel === "object" && !Array.isArray(pointsByLevel)) {
      dispatch(mergeSavedPoints(pointsByLevel as Record<string, {
        points?: number;
        maxPoints?: number;
        accuracy?: number;
        bestTime?: string;
        scenarios?: { scenarioId: string; accuracy: number }[];
      }>));
    }
  }, [addGameToStore, collaboration?.lastProgressSync, currentGame, dispatch, isReplayView, mode]);

  useEffect(() => {
    if (mode !== "game") return;
    if (!gameId || !currentGame?.id || currentGame.id !== gameId || levels.length === 0) return;
    if (collaboration?.roomId && collaboration.isConnected && !collaboration.codeSyncReady) return;

    const baseProgressData =
      typeof currentGame.progressData === "object" && currentGame.progressData !== null
        ? currentGame.progressData
        : {};

    const baseProgressWithoutLevels = stripDrawboardImageProgressData(
      sanitizeReplayProgressData(
        baseProgressData as Record<string, unknown>,
        isReplayView,
      ),
    );

    const progressData: Record<string, unknown> = {
      ...baseProgressWithoutLevels,
      pointsByLevel: Object.fromEntries(
        Object.entries(points.levels).map(([name, data]) => [
          name,
          {
            points: data.points,
            maxPoints: data.maxPoints,
            accuracy: data.accuracy,
            bestTime: data.bestTime,
            scenarios: data.scenarios,
          },
        ])
      ),
    };
    delete progressData[SOLUTION_STEP_ARTIFACTS_KEY];

    const solutionStepArtifacts: SavedSolutionStepArtifacts = {};
    levels.forEach((level, levelIndex) => {
      level.scenarios.forEach((scenario) => {
        const runtimeKey = getEventSequenceScenarioUiKey(levelIndex + 1, scenario.scenarioId);
        const runtimeByStep = selectEventStepRuntimeByStep(stepRuntimeByRuntimeKey, runtimeKey);
        const sequence = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
        sequence.forEach((step) => {
          const url = runtimeByStep[step.id]?.solutionUrl?.trim();
          if (!url) {
            return;
          }
          const fingerprint = getSolutionStepArtifactFingerprint(level, scenario, step);
          const descriptor: DrawboardArtifactDescriptor = {
            version: "v1",
            captureMode,
            artifactType: "solution-step",
            fingerprint,
            gameId,
            levelName: level.name,
            scenarioId: scenario.scenarioId,
            stepId: step.id,
            platformBucket: captureMode === "playwright" ? "server" : platformBucket,
            width: step.snapshot.width,
            height: step.snapshot.height,
          };
          const artifactKey = buildArtifactKey(descriptor);
          solutionStepArtifacts[runtimeKey] ??= {};
          solutionStepArtifacts[runtimeKey][step.id] = descriptor;
          if (postedArtifactDataUrlRef.current[artifactKey] === url) {
            return;
          }
          postedArtifactDataUrlRef.current[artifactKey] = url;
          void fetch(apiUrl("/api/drawboard/artifacts"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...descriptor,
              dataUrl: url,
            }),
          }).catch(() => {
            if (postedArtifactDataUrlRef.current[artifactKey] === url) {
              delete postedArtifactDataUrlRef.current[artifactKey];
            }
          });
        });
      });
    });
    if (Object.keys(solutionStepArtifacts).length > 0) {
      progressData[SOLUTION_STEP_ARTIFACTS_KEY] = solutionStepArtifacts;
    }
    const nextSnapshot = stableSerialize(progressData);
    const currentSnapshot = stableSerialize(baseProgressWithoutLevels);

    if (
      nextSnapshot === currentSnapshot ||
      nextSnapshot === lastSavedSnapshotRef.current ||
      nextSnapshot === inFlightSnapshotRef.current
    ) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      inFlightSnapshotRef.current = nextSnapshot;
      console.log("[ProgressPersistence] persisting progress", {
        gameId,
        isReplayView,
        keys: Object.keys(progressData),
        hasFinishedAt: "finishedAt" in progressData,
        hasFinalScore: "finalScore" in progressData,
      });

      const qs = new URLSearchParams();
      qs.set("accessContext", "game");
      const groupId = searchParams.get("groupId");
      const guestId = searchParams.get("guestId");
      const key = searchParams.get("key");
      if (groupId) qs.set("groupId", groupId);
      if (guestId) qs.set("guestId", guestId);
      if (key) qs.set("key", key);

      fetch(`${apiUrl(`/api/games/${gameId}/instance`)}?${qs.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressData }),
      })
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          lastSavedSnapshotRef.current = nextSnapshot;
          inFlightSnapshotRef.current = null;
          if (currentGame && data?.instance?.progressData) {
            const persistedProgressData = data.instance.progressData as Record<string, unknown>;
            addGameToStore({
              ...currentGame,
              progressData: persistedProgressData,
            });
            collaboration?.syncProgressData(persistedProgressData);
            const savedPointsByLevel = persistedProgressData.pointsByLevel;
            if (
              savedPointsByLevel
              && typeof savedPointsByLevel === "object"
              && !Array.isArray(savedPointsByLevel)
            ) {
              dispatch(mergeSavedPoints(savedPointsByLevel as Record<string, {
                points?: number;
                maxPoints?: number;
                accuracy?: number;
                bestTime?: string;
                scenarios?: { scenarioId: string; accuracy: number }[];
              }>));
            }
          }
          return data;
        })
        .catch(() => {
          inFlightSnapshotRef.current = null;
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [addGameToStore, captureMode, collaboration, currentGame, dispatch, gameId, isReplayView, levels, mode, platformBucket, points.levels, searchParams, stepRuntimeByRuntimeKey]);

  return null;
}
