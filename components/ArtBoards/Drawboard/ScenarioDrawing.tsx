'use client';

import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { Image } from "@/components/General/Image/Image";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import type { FrameJsError } from "../Frame";
import type { FrameRuntimeWarning } from "../Frame";
import { FrameJsErrorOverlay } from "../FrameJsErrorOverlay";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { Button } from "@/components/ui/button";
import { scenario, VerifiedInteraction, type EventSequenceStep } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { Camera, Loader2 } from "lucide-react";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { ScenarioDimensionsWrapper } from "./ScenarioDimensionsWrapper";
import { ScenarioHoverContainer } from "./ScenarioHoverContainer";
import { apiUrl } from "@/lib/apiUrl";
import {
  getEventSequenceRuntimeKey,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import {
  getDrawboardPixelsPair,
  getDrawboardReplaySignatures,
  getDrawboardPixelsSerial,
  getDrawboardPixelsSideSerials,
  subscribeDrawboardPixelsForScenario,
} from "@/lib/drawboard/drawboardPixelsStore";
import {
  defaultTimelineStepIdForSolutionCapture,
} from "@/events/core/eventSequenceSolutionUrls";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import {
  buildArtifactKey,
  fetchRemoteArtifact,
  hashArtifactFingerprint,
  readLocalArtifact,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import {
  drawingArtifactFingerprint,
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";

/**
 * /api/drawboard/render returns a retina PNG in dataUrl but the logical-size RGBA buffer
 * in pixelBufferBase64 (same downscale as server-side scoring). Comparing via dataUrl
 * re-downscales in the browser and can disagree with iframe pixel diff + step truth.
 */
type DrawboardRenderPreviewPayload = {
  dataUrl: string;
  pixelBufferBase64: string;
  width: number;
  height: number;
};

function parseDrawboardRenderPreview(json: unknown): DrawboardRenderPreviewPayload | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const o = json as Record<string, unknown>;
  const pixelBufferBase64 = typeof o.pixelBufferBase64 === "string" ? o.pixelBufferBase64 : "";
  const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
  const width = typeof o.width === "number" ? o.width : 0;
  const height = typeof o.height === "number" ? o.height : 0;
  if (!pixelBufferBase64 || width < 1 || height < 1) {
    return null;
  }
  return { pixelBufferBase64, dataUrl, width, height };
}

function imageDataFromScoringRgba(
  base64: string,
  width: number,
  height: number,
): ImageData | null {
  try {
    const binary = atob(base64);
    const expected = width * height * 4;
    if (binary.length !== expected) {
      return null;
    }
    const bytes = new Uint8Array(expected);
    for (let i = 0; i < expected; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new ImageData(new Uint8ClampedArray(bytes.buffer), width, height);
  } catch {
    return null;
  }
}

type LegacySolution = {
  SCSS: string;
  SHTML: string;
  SJS: string;
  drawn: boolean;
};

type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
  creatorPreviewInteractive?: boolean;
  creatorMode?: boolean;
  selectedEventSequenceStepId?: string | null;
  /**
   * Game + event sequence: live gameplay step for per-step solution URL / compare target only.
   */
  gameplaySolutionStepId?: string | null;
  /**
   * When true (ArtBoards with an event sequence), interaction triggers match the replay depth only.
   * When false (e.g. DrawBoard), all sequence triggers stay registered.
   */
  eventSequenceScopedTriggers?: boolean;
};

export const ScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorPreviewInteractive,
  creatorMode,
  selectedEventSequenceStepId,
  gameplaySolutionStepId = null,
  eventSequenceScopedTriggers = false,
}: ScenarioDrawingProps): React.ReactNode => {
  const { getRuntimeState, updateRuntimeState } = useEventSequenceStore.getState();
  const shouldDebugEventSequenceCompare = process.env.NODE_ENV !== "production";
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string>);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const currentGameId = useGameStore((state) => state.currentGameId);
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.creator;
  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const [stepPreviews, setStepPreviews] = useState<Record<string, DrawboardRenderPreviewPayload>>({});
  const stepPreviewsRef = useRef<Record<string, DrawboardRenderPreviewPayload>>({});
  const drawingFrameRef = useRef<FrameHandle | null>(null);
  /** Last timeline step id we showed a loading sentinel for; avoids -1 on every effect dep churn. */
  const prevCompareStepSelectionRef = useRef<string | null>(null);
  /** Last replay signature we armed the compare gate for. */
  const prevCompareReplaySignatureRef = useRef<string>("");
  const prevCompareRuntimeKeyRef = useRef<string | null>(null);
  const compareInvocationRef = useRef(0);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const runtimeWarningTimeoutRef = useRef<number | null>(null);
  const handleJsError = useCallback((error: FrameJsError | null) => setJsError(error), []);
  const handleRuntimeWarning = useCallback((warning: FrameRuntimeWarning) => {
    setRuntimeWarning(warning.message);
    if (runtimeWarningTimeoutRef.current) {
      window.clearTimeout(runtimeWarningTimeoutRef.current);
      runtimeWarningTimeoutRef.current = null;
    }
    runtimeWarningTimeoutRef.current = window.setTimeout(() => {
      setRuntimeWarning(null);
      runtimeWarningTimeoutRef.current = null;
    }, 8000);
  }, []);
  const replayPixelGateRef = useRef<{
    stepId: string;
    expectedReplaySignature: string;
    drawingSerial: number;
    solutionSerial: number;
  } | null>(null);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { drawboardCaptureMode, manualDrawboardCapture } = useGameRuntimeConfig();
  const platformBucket = useMemo(
    () => (drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null),
    [drawboardCaptureMode],
  );

  const bindDrawingFrame = useCallback(
    (instance: FrameHandle | null) => {
      drawingFrameRef.current = instance;
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(instance);
      }
    },
    [registerForNavbarCapture, captureNav],
  );

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(null);
      }
      if (runtimeWarningTimeoutRef.current) {
        window.clearTimeout(runtimeWarningTimeoutRef.current);
        runtimeWarningTimeoutRef.current = null;
      }
    };
  }, [registerForNavbarCapture, captureNav]);

  const handleDrawingCaptureBusy = useCallback(
    (busy: boolean) => {
      setDrawingCaptureBusy(busy);
      if (registerForNavbarCapture) {
        captureNav?.notifyDrawingBusy(busy);
      }
    },
    [captureNav, registerForNavbarCapture],
  );
  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const solutions = useAppSelector((state) => state.solutions as unknown as Record<string, LegacySolution>);
  const resolvedSolution = useMemo(() => {
    if (!level) {
      return { css: "", html: "" };
    }
    const defaultLevelSolutions = solutions[level.name]
      ? {
        css: solutions[level.name].SCSS,
        html: solutions[level.name].SHTML,
      }
      : null;
    const levelSolution = level.solution || { css: "", html: "", js: "" };
    return {
      css: levelSolution.css || defaultLevelSolutions?.css || "",
      html: levelSolution.html || defaultLevelSolutions?.html || "",
    };
  }, [level, solutions]);
  const resolvedSolutionCss = resolvedSolution.css;
  const resolvedSolutionHtml = resolvedSolution.html;
  const resolvedSolutionJs = level?.solution?.js || solutions[level?.name ?? ""]?.SJS || "";
  const interactive = level?.interactive ?? false;
  const runtimeKey = useMemo(
    () => getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, isCreator),
    [currentLevel, isCreator, scenario.scenarioId],
  );
  const sequenceRuntime = useEventSequenceStore((state) => (
    selectRuntimeState(state.runtimeByKey, runtimeKey)
  ));
  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence, scenario.scenarioId],
  );
  const usePerStepSolutionKeys = scenarioSequence.length > 0;
  const drawingFingerprint = useMemo(
    () =>
      drawingArtifactFingerprint({
        html,
        css,
        js,
        scenario,
      }),
    [css, html, js, scenario],
  );
  const solutionFingerprint = useMemo(
    () =>
      solutionArtifactFingerprint({
        html: resolvedSolutionHtml,
        css: resolvedSolutionCss,
        js: resolvedSolutionJs,
        scenario,
      }),
    [resolvedSolutionCss, resolvedSolutionHtml, resolvedSolutionJs, scenario],
  );
  const drawingArtifactDescriptor = useMemo<DrawboardArtifactDescriptor>(
    () => ({
      version: "v1",
      captureMode: drawboardCaptureMode,
      artifactType: "drawing",
      fingerprint: drawingFingerprint,
      gameId: currentGameId,
      levelIdentifier: level?.identifier ?? null,
      levelName: level?.name ?? null,
      scenarioId: scenario.scenarioId,
      stepId: null,
      platformBucket,
      width: scenario.dimensions.width,
      height: scenario.dimensions.height,
    }),
    [
      currentGameId,
      drawboardCaptureMode,
      drawingFingerprint,
      level?.identifier,
      level?.name,
      platformBucket,
      scenario.dimensions.height,
      scenario.dimensions.width,
      scenario.scenarioId,
    ],
  );
  const drawingArtifactKey = useMemo(
    () => buildArtifactKey(drawingArtifactDescriptor),
    [drawingArtifactDescriptor],
  );
  const drawingUrl = drawingUrls[drawingArtifactKey];
  /**
   * Solution preview fetch + step accuracy compare: skip probes and hidden carousel clones
   * (suppressHeavyLayoutEffects). Do not couple event-sequence progression to navbar
   * capture ownership: in single-artboard layouts the drawing board can be mounted
   * off-screen, and it still must keep replay/step advancement running normally.
   */
  const allowSequenceMetrics = !suppressHeavyLayoutEffects;
  const suppressSequenceMetrics = !allowSequenceMetrics;

  useEffect(() => {
    if (drawingUrl?.trim()) {
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      const local = readLocalArtifact(drawingArtifactDescriptor);
      if (local?.dataUrl) {
        dispatch(addDrawingUrl({
          drawingUrl: local.dataUrl,
          scenarioId: scenario.scenarioId,
          storageKey: drawingArtifactKey,
        }));
        return;
      }
      try {
        const remote = await fetchRemoteArtifact(drawingArtifactDescriptor);
        if (!cancelled && remote?.dataUrl) {
          dispatch(addDrawingUrl({
            drawingUrl: remote.dataUrl,
            scenarioId: scenario.scenarioId,
            storageKey: drawingArtifactKey,
          }));
        }
      } catch {
        // Ignore cache misses/network failures; live capture will populate.
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatch, drawingArtifactDescriptor, drawingArtifactKey, drawingUrl, scenario.scenarioId]);

  const normalizedActiveSequenceIndex = sequenceRuntime.activeIndex >= scenarioSequence.length ? 0 : sequenceRuntime.activeIndex;
  /** Gameplay progression (not timeline scrub) — used for grading advance + verified interactions. */
  const gameplayActiveSequenceStep = scenarioSequence[normalizedActiveSequenceIndex] ?? null;
  const fallbackEvents = useMemo(() => level?.events || [], [level?.events]);
  const {
    selectedSequenceIndex,
    replaySequence,
    interactionTriggers: frameEvents,
    shouldShowInteractivePreview,
    frameNeedsInteractive,
    isSequenceRecording,
  } = useEventSequencePreview({
    isCreator,
    scenarioSequence,
    selectedEventSequenceStepId,
    eventSequenceScopedTriggers,
    recordingMode: sequenceRuntime.recordingMode,
    creatorPreviewInteractive,
    hasCapture: Boolean(drawingUrl),
    fallbackEvents,
  });
  const solutionStepIdForCapture = useMemo(() => {
    if (scenarioSequence.length > 0) {
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed) {
        return defaultTimelineStepIdForSolutionCapture(scrubbed);
      }
      if (!isCreator && gameplaySolutionStepId != null) {
        return defaultTimelineStepIdForSolutionCapture(gameplaySolutionStepId);
      }
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence.length, selectedEventSequenceStepId]);
  const selectedSolutionStep = useMemo(
    () => scenarioSequence.find((step) => step.id === solutionStepIdForCapture) ?? null,
    [scenarioSequence, solutionStepIdForCapture],
  );
  const activeSolutionFingerprint = useMemo(() => {
    if (!usePerStepSolutionKeys) {
      return solutionFingerprint;
    }
    if (solutionStepIdForCapture === INITIAL_EVENT_SEQUENCE_STEP_ID) {
      return hashArtifactFingerprint(["solution-step", solutionFingerprint, INITIAL_EVENT_SEQUENCE_STEP_ID]);
    }
    if (selectedSolutionStep) {
      return solutionStepArtifactFingerprint({ solutionFingerprint, step: selectedSolutionStep });
    }
    return solutionFingerprint;
  }, [selectedSolutionStep, solutionFingerprint, usePerStepSolutionKeys, solutionStepIdForCapture]);
  const solutionArtifactDescriptor = useMemo<DrawboardArtifactDescriptor>(
    () => ({
      version: "v1",
      captureMode: drawboardCaptureMode,
      artifactType: usePerStepSolutionKeys ? "solution-step" : "solution",
      fingerprint: activeSolutionFingerprint,
      gameId: currentGameId,
      levelIdentifier: level?.identifier ?? null,
      levelName: level?.name ?? null,
      scenarioId: scenario.scenarioId,
      stepId: usePerStepSolutionKeys ? solutionStepIdForCapture : null,
      platformBucket,
      width: scenario.dimensions.width,
      height: scenario.dimensions.height,
    }),
    [
      activeSolutionFingerprint,
      currentGameId,
      drawboardCaptureMode,
      level?.identifier,
      level?.name,
      platformBucket,
      scenario.dimensions.height,
      scenario.dimensions.width,
      scenario.scenarioId,
      solutionStepIdForCapture,
      usePerStepSolutionKeys,
    ],
  );
  const solutionArtifactKey = useMemo(
    () => buildArtifactKey(solutionArtifactDescriptor),
    [solutionArtifactDescriptor],
  );
  const solutionUrl = solutionUrls[solutionArtifactKey] ?? "";

  useEffect(() => {
    if (solutionUrl?.trim()) {
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      const local = readLocalArtifact(solutionArtifactDescriptor);
      if (local?.dataUrl) {
       
        dispatch(addSolutionUrl({
          solutionUrl: local.dataUrl,
          scenarioId: scenario.scenarioId,
          storageKey: solutionArtifactKey,
          eventSequenceStepId: usePerStepSolutionKeys ? solutionStepIdForCapture ?? undefined : undefined,
        }));
        return;
      }
      try {
        const remote = await fetchRemoteArtifact(solutionArtifactDescriptor);
        if (!cancelled && remote?.dataUrl) {
         
          dispatch(addSolutionUrl({
            solutionUrl: remote.dataUrl,
            scenarioId: scenario.scenarioId,
            storageKey: solutionArtifactKey,
            eventSequenceStepId: usePerStepSolutionKeys ? solutionStepIdForCapture ?? undefined : undefined,
          }));
        }
      } catch {
        // Ignore cache misses/network failures; live capture or Playwright mode can populate.
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    scenario.scenarioId,
    solutionArtifactDescriptor,
    solutionArtifactKey,
    solutionStepIdForCapture,
    solutionUrl,
    store,
    usePerStepSolutionKeys,
    currentLevel,
    level?.identifier,
    level?.name,
  ]);

  useEffect(() => {
    stepPreviewsRef.current = stepPreviews;
  }, [stepPreviews]);

  /** Track solution CSS+HTML used for the last render batch (incl. baseline “initial” preview). */
  const lastRenderedSolutionSourceRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const renderPreviews = async () => {
      if (suppressSequenceMetrics) {
        return;
      }
      if (drawboardCaptureMode === "browser") {
        setStepPreviews({});
        return;
      }
      if (!scenarioSequence.length) {
        setStepPreviews({});
        return;
      }
      // Browser capture: compare prefers iframe pixels when drawing+solution buffers exist, but the
      // solution side is often missing briefly (or never posted in some layouts). Keep server-rendered
      // step targets so compareOne can fall back — same path for creator and game.

      const renderSourceKey = `${resolvedSolutionCss}\0${resolvedSolutionHtml}`;
      const sourceChanged = lastRenderedSolutionSourceRef.current !== renderSourceKey;
      const missingSteps = sourceChanged
        ? scenarioSequence
        : scenarioSequence.filter((step) => !stepPreviewsRef.current[step.id]);
      const needInitialPreview =
        sourceChanged || !stepPreviewsRef.current[INITIAL_EVENT_SEQUENCE_STEP_ID];

      const pruneStale = (current: Record<string, DrawboardRenderPreviewPayload>) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => {
            if (id === INITIAL_EVENT_SEQUENCE_STEP_ID) {
              return true;
            }
            return scenarioSequence.some((step) => step.id === id);
          }),
        );

      if (missingSteps.length === 0 && !needInitialPreview) {
        setStepPreviews((current) => pruneStale(current));
        return;
      }

      lastRenderedSolutionSourceRef.current = renderSourceKey;

      const first = scenarioSequence[0];
      const renderBody = (
        snapshotHtml: string,
        width: number,
        height: number,
        artifactCache: DrawboardArtifactDescriptor,
        /** Pair with snapshotHtml: per-step HTML was captured with `#user-styles` from the drawboard at record time. */
        cssForRender = resolvedSolutionCss,
      ) =>
        fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            css: cssForRender,
            snapshotHtml,
            width,
            height,
            scenarioId: scenario.scenarioId,
            urlName: "solutionUrl",
            includeDataUrl: true,
            artifactCache,
          }),
        });

      const requests: Promise<readonly [string, DrawboardRenderPreviewPayload | null]>[] = [];

      const initialDescriptor: DrawboardArtifactDescriptor = {
        ...solutionArtifactDescriptor,
        artifactType: "solution-step",
        stepId: INITIAL_EVENT_SEQUENCE_STEP_ID,
        fingerprint: hashArtifactFingerprint([
          "solution-step",
          solutionFingerprint,
          INITIAL_EVENT_SEQUENCE_STEP_ID,
        ]),
        width: first.snapshot.width,
        height: first.snapshot.height,
      };
      if (needInitialPreview) {
        requests.push(
          (async (): Promise<readonly [string, DrawboardRenderPreviewPayload | null]> => {
            const response = await renderBody(
              resolvedSolutionHtml,
              first.snapshot.width,
              first.snapshot.height,
              initialDescriptor,
            );
            if (!response.ok) {
              return [INITIAL_EVENT_SEQUENCE_STEP_ID, null] as const;
            }
            const payload = parseDrawboardRenderPreview(await response.json());
            return [INITIAL_EVENT_SEQUENCE_STEP_ID, payload] as const;
          })(),
        );
      }

      missingSteps.forEach((step) => {
        const stepDescriptor: DrawboardArtifactDescriptor = {
          ...solutionArtifactDescriptor,
          artifactType: "solution-step",
          stepId: step.id,
          fingerprint: solutionStepArtifactFingerprint({
            solutionFingerprint,
            step,
          }),
          width: step.snapshot.width,
          height: step.snapshot.height,
        };
        requests.push(
          (async (): Promise<readonly [string, DrawboardRenderPreviewPayload | null]> => {
            const response = await renderBody(
              step.snapshot.snapshotHtml,
              step.snapshot.width,
              step.snapshot.height,
              stepDescriptor,
              step.snapshot.css || resolvedSolutionCss,
            );
            if (!response.ok) {
              return [step.id, null] as const;
            }
            const payload = parseDrawboardRenderPreview(await response.json());
            return [step.id, payload] as const;
          })(),
        );
      });

      const nextEntries = await Promise.all(requests);

      if (cancelled) {
        return;
      }

      setStepPreviews((current) => {
        const next = sourceChanged ? {} : { ...current };
        nextEntries.forEach(([id, entry]) => {
          if (entry) {
            next[id] = entry;
          }
        });
        return pruneStale(next);
      });
    };

    void renderPreviews();

    return () => {
      cancelled = true;
    };
  }, [
    drawboardCaptureMode,
    scenarioSequence,
    resolvedSolutionCss,
    resolvedSolutionHtml,
    scenario.scenarioId,
    solutionArtifactDescriptor,
    solutionFingerprint,
    suppressSequenceMetrics,
  ]);

  useEffect(() => {
    if (suppressSequenceMetrics) {
      return;
    }
    let cancelled = false;

    if (prevCompareRuntimeKeyRef.current !== runtimeKey) {
      prevCompareRuntimeKeyRef.current = runtimeKey;
      prevCompareStepSelectionRef.current = null;
    }

    const loadImageDataForSnapshot = async (url: string, width: number, height: number) => {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.src = url;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 32)}`));
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    const runWorkerCompare = async (
      drawingData: ImageData,
      targetData: ImageData,
    ): Promise<number> => {
      const worker = new Worker(
        new URL("../../../lib/utils/workers/imageComparisonWorker.ts", import.meta.url),
        { type: "module" },
      );
      try {
        return await new Promise<number>((resolve, reject) => {
          worker.onmessage = ({ data }) => resolve(data.accuracy as number);
          worker.onerror = reject;
          const drawingBuffer = drawingData.data.buffer.slice(0);
          const targetBuffer = targetData.data.buffer.slice(0);
          worker.postMessage(
            {
              drawingBuffer,
              solutionBuffer: targetBuffer,
              width: drawingData.width,
              height: drawingData.height,
            },
            [drawingBuffer, targetBuffer],
          );
        });
      } finally {
        worker.terminate();
      }
    };

    /**
     * Compare the drawing only to the timeline-focused step (selectedEventSequenceStepId).
     * In game mode, also compare the active gameplay step when it is pending verification
     * and the player is scrubbed to a different step, so advancement still sees a fresh score.
     */
    type CompareFocusedOutcome = {
      accuracies: Record<string, number> | null;
      /** True only when drawing+solution buffers came from getDrawboardPixelsPair (serial guard applies). */
      comparedViaIframePixelPair: boolean;
    };

    const compareFocusedStepsToDrawing = async (): Promise<CompareFocusedOutcome> => {
      if (!drawingUrl || !scenarioSequence.length) {
        return { accuracies: null, comparedViaIframePixelPair: false };
      }

      const ids = new Set<string>();
      const focus = selectedEventSequenceStepId?.trim();
      if (focus) {
        ids.add(focus);
      }

      const runtimeState = getRuntimeState(runtimeKey);
      const pendingId = runtimeState.pendingStepId;
      const autoReplayRunning = Boolean(runtimeState.autoReplay?.running);
      if (
        !autoReplayRunning
        &&
        !isCreator
        && gameplayActiveSequenceStep
        && pendingId === gameplayActiveSequenceStep.id
        && !ids.has(gameplayActiveSequenceStep.id)
      ) {
        ids.add(gameplayActiveSequenceStep.id);
      }

      if (ids.size === 0) {
        return { accuracies: null, comparedViaIframePixelPair: false };
      }

      const targetIds = [...ids];
      const currentTargetId = solutionStepIdForCapture;
      if (shouldDebugEventSequenceCompare) {
        const replaySignatures = getDrawboardReplaySignatures(scenario.scenarioId);
        console.log("[event-sequence:compare:start]", {
          scenarioId: scenario.scenarioId,
          runtimeKey,
          isCreator,
          selectedEventSequenceStepId: selectedEventSequenceStepId?.trim() ?? null,
          solutionStepIdForCapture,
          targetIds,
          pendingStepId: runtimeState.pendingStepId,
          activeGameplayStepId: gameplayActiveSequenceStep?.id ?? null,
          autoReplayRunning: Boolean(runtimeState.autoReplay?.running),
          replaySequenceIds: replaySequence.map((step) => step.id),
          replaySignatures,
        });
      }

      if (drawboardCaptureMode === "browser" && isCreator) {
        const { drawing, solution } = getDrawboardPixelsPair(scenario.scenarioId);
        if (
          targetIds.length === 1
          && targetIds[0] === currentTargetId
          &&
          drawing
          && solution
          && drawing.width === solution.width
          && drawing.height === solution.height
        ) {
          const comparison = await runWorkerCompare(drawing, solution);
          if (cancelled) {
            return { accuracies: null, comparedViaIframePixelPair: true };
          }
          return {
            accuracies: { [targetIds[0]]: comparison },
            comparedViaIframePixelPair: true,
          };
        }
        const w = scenario.dimensions.width;
        const h = scenario.dimensions.height;
        if (
          targetIds.length === 1
          && targetIds[0] === currentTargetId
          && solutionUrl?.trim()
          && w > 0
          && h > 0
        ) {
          try {
            const targetData = await loadImageDataForSnapshot(solutionUrl, w, h);
            const drawingData = await loadImageDataForSnapshot(drawingUrl, w, h);
            if (
              targetData
              && drawingData
              && !cancelled
              && targetData.width === drawingData.width
              && targetData.height === drawingData.height
            ) {
              const comparison = await runWorkerCompare(drawingData, targetData);
              if (cancelled) {
                return { accuracies: null, comparedViaIframePixelPair: false };
              }
              return {
                accuracies: { [targetIds[0]]: comparison },
                comparedViaIframePixelPair: false,
              };
            }
          } catch {
            /* fall through to server-render path */
          }
        }
      }

      const compareOne = async (stepId: string): Promise<readonly [string, number | null]> => {
        if (drawboardCaptureMode === "browser") {
          const comparisonStep = scenarioSequence.find((step) => step.id === stepId) ?? null;
          const targetFingerprint =
            usePerStepSolutionKeys && stepId === INITIAL_EVENT_SEQUENCE_STEP_ID
              ? hashArtifactFingerprint(["solution-step", solutionFingerprint, INITIAL_EVENT_SEQUENCE_STEP_ID])
              : usePerStepSolutionKeys && comparisonStep
                ? solutionStepArtifactFingerprint({
                  solutionFingerprint,
                  step: comparisonStep,
                })
                : solutionFingerprint;
          const targetImageUrl = solutionUrls[buildArtifactKey({
            version: "v1",
            captureMode: drawboardCaptureMode,
            artifactType: usePerStepSolutionKeys ? "solution-step" : "solution",
            fingerprint: targetFingerprint,
            gameId: currentGameId,
            levelIdentifier: level?.identifier ?? null,
            levelName: level?.name ?? null,
            scenarioId: scenario.scenarioId,
            stepId: usePerStepSolutionKeys ? stepId : null,
            platformBucket,
            width: scenario.dimensions.width,
            height: scenario.dimensions.height,
          })]?.trim();
          if (!targetImageUrl) {
            return [stepId, null] as const;
          }
          const targetData = await loadImageDataForSnapshot(
            targetImageUrl,
            scenario.dimensions.width,
            scenario.dimensions.height,
          );
          const drawingData = await loadImageDataForSnapshot(
            drawingUrl,
            scenario.dimensions.width,
            scenario.dimensions.height,
          );
          if (!drawingData || !targetData || cancelled) {
            return [stepId, null] as const;
          }
          const comparison = await runWorkerCompare(drawingData, targetData);
          return [stepId, comparison] as const;
        }

        if (stepId === INITIAL_EVENT_SEQUENCE_STEP_ID) {
          const targetPreview = stepPreviews[INITIAL_EVENT_SEQUENCE_STEP_ID];
          if (!targetPreview) {
            return [stepId, null] as const;
          }
          const targetData = imageDataFromScoringRgba(
            targetPreview.pixelBufferBase64,
            targetPreview.width,
            targetPreview.height,
          );
          const drawingData = await loadImageDataForSnapshot(
            drawingUrl,
            targetPreview.width,
            targetPreview.height,
          );
          if (!drawingData || !targetData || cancelled) {
            return [stepId, null] as const;
          }
          const comparison = await runWorkerCompare(drawingData, targetData);
          return [stepId, comparison] as const;
        }

        const step = scenarioSequence.find((s) => s.id === stepId);
        if (!step) {
          return [stepId, null] as const;
        }
        const targetPreview = stepPreviews[step.id];
        if (!targetPreview) {
          return [stepId, null] as const;
        }
        const targetData = imageDataFromScoringRgba(
          targetPreview.pixelBufferBase64,
          targetPreview.width,
          targetPreview.height,
        );
        const drawingData = await loadImageDataForSnapshot(
          drawingUrl,
          targetPreview.width,
          targetPreview.height,
        );
        if (!drawingData || !targetData || cancelled) {
          return [stepId, null] as const;
        }
        const comparison = await runWorkerCompare(drawingData, targetData);
        return [stepId, comparison] as const;
      };

      const results = await Promise.all([...ids].map((id) => compareOne(id)));
      if (cancelled) {
        return { accuracies: null, comparedViaIframePixelPair: false };
      }
      const nextAccuracies: Record<string, number> = {};
      results.forEach(([id, value]) => {
        if (value !== null) {
          nextAccuracies[id] = value;
        }
      });
      const mergedKeys = Object.keys(nextAccuracies);
      const out = mergedKeys.length > 0 ? nextAccuracies : null;
      return { accuracies: out, comparedViaIframePixelPair: false };
    };

    /** Write -2 for the focused step when comparison produces no result. */
    const markFocusedStepComparisonFailed = (source: string) => {
      const focus = selectedEventSequenceStepId?.trim();
      if (!focus) return;
      updateRuntimeState(runtimeKey, (current) => {
        if (current.stepAccuracies[focus] !== -1) return current;
        return { ...current, stepAccuracies: { ...current.stepAccuracies, [focus]: -2 } };
      });
    };

    const runCreatorComparisons = async () => {
      const compareInvocationId = ++compareInvocationRef.current;
      const pixelsSerialAtCompareStart =
        drawboardCaptureMode === "browser" ? getDrawboardPixelsSerial(scenario.scenarioId) : null;
      const { accuracies: nextAccuracies, comparedViaIframePixelPair } =
        await compareFocusedStepsToDrawing();
      if (cancelled || compareInvocationRef.current !== compareInvocationId) return;
      if (
        comparedViaIframePixelPair
        && pixelsSerialAtCompareStart !== null
        && getDrawboardPixelsSerial(scenario.scenarioId) !== pixelsSerialAtCompareStart
      ) {
        return;
      }
      if (!nextAccuracies) {
        if (shouldDebugEventSequenceCompare) {
          console.log("[event-sequence:compare:null-result]", {
            scenarioId: scenario.scenarioId,
            runtimeKey,
            mode: "creator",
            selectedEventSequenceStepId: selectedEventSequenceStepId?.trim() ?? null,
          });
        }
        if (!drawingUrl?.trim()) {
          return;
        }
        if (drawboardCaptureMode === "browser" && !solutionUrl?.trim()) {
          return;
        }
        markFocusedStepComparisonFailed("creator_null_result");
        return;
      }
      updateRuntimeState(runtimeKey, (current) => {
        if (shouldDebugEventSequenceCompare) {
          console.log("[event-sequence:compare:merge]", {
            scenarioId: scenario.scenarioId,
            runtimeKey,
            mode: "creator",
            selectedEventSequenceStepId: selectedEventSequenceStepId?.trim() ?? null,
            nextAccuracies,
            before: current.stepAccuracies,
          });
        }
        const mergedSnapshot = { ...current.stepAccuracies, ...nextAccuracies };
        const mergedVersions = { ...current.stepAccuracyVersions };
        for (const id of Object.keys(nextAccuracies)) {
          mergedVersions[id] = current.drawingVersion;
        }
        return {
          ...current,
          stepAccuracies: mergedSnapshot,
          stepAccuracyVersions: mergedVersions,
        };
      });
    };

    const runGameComparisons = async () => {
      if (!scenarioSequence.length) {
        return;
      }
      const compareInvocationId = ++compareInvocationRef.current;
      const pixelsSerialAtCompareStart =
        drawboardCaptureMode === "browser" ? getDrawboardPixelsSerial(scenario.scenarioId) : null;
      const { accuracies: nextAccuracies, comparedViaIframePixelPair } =
        await compareFocusedStepsToDrawing();
      if (cancelled || compareInvocationRef.current !== compareInvocationId) return;
      if (
        comparedViaIframePixelPair
        && pixelsSerialAtCompareStart !== null
        && getDrawboardPixelsSerial(scenario.scenarioId) !== pixelsSerialAtCompareStart
      ) {
        return;
      }
      if (!nextAccuracies) {
        if (shouldDebugEventSequenceCompare) {
          console.log("[event-sequence:compare:null-result]", {
            scenarioId: scenario.scenarioId,
            runtimeKey,
            mode: "game",
            selectedEventSequenceStepId: selectedEventSequenceStepId?.trim() ?? null,
            pendingStepId: getRuntimeState(runtimeKey).pendingStepId,
          });
        }
        if (!drawingUrl?.trim()) {
          return;
        }
        if (drawboardCaptureMode === "browser" && !solutionUrl?.trim()) {
          return;
        }
        markFocusedStepComparisonFailed("game_null_result");
        return;
      }
      updateRuntimeState(runtimeKey, (current) => {
        if (shouldDebugEventSequenceCompare) {
          console.log("[event-sequence:compare:merge]", {
            scenarioId: scenario.scenarioId,
            runtimeKey,
            mode: "game",
            selectedEventSequenceStepId: selectedEventSequenceStepId?.trim() ?? null,
            pendingStepId: current.pendingStepId,
            activeGameplayStepId: gameplayActiveSequenceStep?.id ?? null,
            autoReplayRunning: Boolean(current.autoReplay?.running),
            nextAccuracies,
            before: current.stepAccuracies,
          });
        }
        const mergedSnapshot = { ...current.stepAccuracies, ...nextAccuracies };
        const mergedVersions = { ...current.stepAccuracyVersions };
        for (const id of Object.keys(nextAccuracies)) {
          mergedVersions[id] = current.drawingVersion;
        }
        const step = gameplayActiveSequenceStep;
        if (!current.autoReplay?.running && step && current.pendingStepId === step.id) {
          const comparison = nextAccuracies[step.id] ?? 0;
          if (comparison >= 99.5) {
            return {
              ...current,
              stepAccuracies: mergedSnapshot,
              stepAccuracyVersions: mergedVersions,
              pendingStepId: null,
              activeIndex: Math.min(current.activeIndex + 1, scenarioSequence.length),
            };
          }
        }
        return {
          ...current,
          stepAccuracies: mergedSnapshot,
          stepAccuracyVersions: mergedVersions,
        };
      });
    };

    const runComparisons = () => {
      if (isCreator) {
        void runCreatorComparisons().catch((error) => {
          console.error("EventSequence: failed to compare events (creator)", error);
          markFocusedStepComparisonFailed("creator_exception");
        });
      } else {
        void runGameComparisons().catch((error) => {
          console.error("EventSequence: failed to compare events (game)", error);
          markFocusedStepComparisonFailed("game_exception");
        });
      }
    };

    // Loading (-1) only when the user selects a different timeline step — not on every effect
    // re-run (drawingUrl / solutionUrl churn caused constant flicker).
    const focusedId = selectedEventSequenceStepId?.trim() ?? null;
    const replaySequenceSignature = replaySequence.map((step) => step.id).join("|");
    const prevSel = prevCompareStepSelectionRef.current;
    if (focusedId !== prevSel) {
      prevCompareStepSelectionRef.current = focusedId;
      if (focusedId) {
        updateRuntimeState(runtimeKey, (current) => ({
          ...current,
          stepAccuracies: { ...current.stepAccuracies, [focusedId]: -1 },
        }));
      } else {
        replayPixelGateRef.current = null;
      }
    }

    const shouldArmReplayGate =
      Boolean(focusedId)
      && drawboardCaptureMode === "browser"
      && replaySequence.length > 0;
    const prevReplaySignature = prevCompareReplaySignatureRef.current;
    if (focusedId) {
      if (shouldArmReplayGate && (focusedId !== prevSel || replaySequenceSignature !== prevReplaySignature)) {
        const sideSerials = getDrawboardPixelsSideSerials(scenario.scenarioId);
        replayPixelGateRef.current = {
          stepId: focusedId,
          expectedReplaySignature: replaySequenceSignature,
          drawingSerial: sideSerials.drawing,
          solutionSerial: sideSerials.solution,
        };
      } else if (!shouldArmReplayGate) {
        replayPixelGateRef.current = null;
      }
      prevCompareReplaySignatureRef.current = replaySequenceSignature;
    } else {
      prevCompareReplaySignatureRef.current = "";
    }

    const replayPixelGate = replayPixelGateRef.current;
    if (replayPixelGate && replayPixelGate.stepId === focusedId) {
      const sideSerials = getDrawboardPixelsSideSerials(scenario.scenarioId);
      const replaySignatures = getDrawboardReplaySignatures(scenario.scenarioId);
      const requireSolutionReplayFresh = isCreator;
      const drawingReady = sideSerials.drawing > replayPixelGate.drawingSerial;
      const solutionReady = !requireSolutionReplayFresh || sideSerials.solution > replayPixelGate.solutionSerial;
      const drawingSignatureReady = replaySignatures.drawing === replayPixelGate.expectedReplaySignature;
      const solutionSignatureReady =
        !requireSolutionReplayFresh || replaySignatures.solution === replayPixelGate.expectedReplaySignature;
      if (shouldDebugEventSequenceCompare) {
        console.log("[event-sequence:compare:gate]", {
          scenarioId: scenario.scenarioId,
          runtimeKey,
          focusedId,
          expectedReplaySignature: replayPixelGate.expectedReplaySignature,
          replaySignatures,
          sideSerials,
          baselineSerials: {
            drawing: replayPixelGate.drawingSerial,
            solution: replayPixelGate.solutionSerial,
          },
          requireSolutionReplayFresh,
          drawingReady,
          solutionReady,
          drawingSignatureReady,
          solutionSignatureReady,
        });
      }
      if (!drawingReady || !solutionReady || !drawingSignatureReady || !solutionSignatureReady) {
        const unsubIframePixels =
          drawboardCaptureMode === "browser"
            ? subscribeDrawboardPixelsForScenario(scenario.scenarioId, () => {
              if (!cancelled) {
                runComparisons();
              }
            })
            : null;
        return () => {
          cancelled = true;
          unsubIframePixels?.();
        };
      }
      replayPixelGateRef.current = null;
    }

    // Always run once when deps change. Stale async results are skipped when the drawboard
    // pixel serial advances mid-compare (browser capture).
    runComparisons();

    const unsubIframePixels =
      drawboardCaptureMode === "browser"
        ? subscribeDrawboardPixelsForScenario(scenario.scenarioId, () => {
          if (!cancelled) {
            runComparisons();
          }
        })
        : null;

    return () => {
      cancelled = true;
      unsubIframePixels?.();
    };
  }, [
    currentLevel,
    dispatch,
    drawboardCaptureMode,
    drawingUrl,
    gameplayActiveSequenceStep,
    isCreator,
    runtimeKey,
    scenario.dimensions.height,
    scenario.dimensions.width,
    scenario.scenarioId,
    scenarioSequence,
    replaySequence,
    selectedEventSequenceStepId,
    sequenceRuntime.autoReplay?.running,
    sequenceRuntime.autoReplay?.stepIndex,
    sequenceRuntime.pendingStepId,
    solutionUrl,
    solutionStepIdForCapture,
    stepPreviews,
    suppressSequenceMetrics,
    usePerStepSolutionKeys,
    solutionUrls,
  ]);

  const handleVerifiedInteraction = useCallback((interaction: VerifiedInteraction) => {
    if (isCreator || !gameplayActiveSequenceStep) {
      return;
    }
    if (interaction.triggerId !== gameplayActiveSequenceStep.id) {
      return;
    }
    updateRuntimeState(runtimeKey, (current) => ({
      ...current,
      pendingStepId: gameplayActiveSequenceStep.id,
    }));
  }, [gameplayActiveSequenceStep, isCreator, runtimeKey]);

  if (!level) return null;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        {/* <BoardTitle>Your version</BoardTitle> */}
        <Board>
          {" "}
          <ArtContainer>
            <div className="relative">
              {isCreator && (
                <ScenarioHoverContainer enabled={!shouldShowInteractivePreview}>
                  <div className="relative h-full w-full min-h-[1px]">
                    <ScenarioDimensionsWrapper
                      scenario={scenario}
                      levelId={currentLevel}
                      showDimensions={true}
                      setShowDimensions={() => { }}
                    />
                  </div>
                </ScenarioHoverContainer>
              )}
              {!isCreator && (
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                  {manualDrawboardCapture && interactive && (
                    <PoppingTitle topTitle="Capture picture from your preview">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-background/90 shadow-sm"
                        disabled={drawingCaptureBusy}
                        aria-label="Capture picture from your preview"
                        onClick={() => drawingFrameRef.current?.requestCapture()}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </PoppingTitle>
                  )}
                </div>
              )}
              <SlideShower
                sliderHeight={scenario.dimensions.height}
                showStatic={!interactive && !isCreator}
                staticComponent={
                  <Image
                    imageUrl={solutionUrl}
                    alt="Reference image"
                    height={scenario.dimensions.height}
                    width={scenario.dimensions.width}
                    loadingMessage="Loading reference image…"
                  />
                }
                slidingComponent={
                  <div
                    className="overflow-hidden relative"
                    style={{
                      height: `${scenario.dimensions.height}px`,
                      width: `${scenario.dimensions.width}px`,
                    }}
                  >
                    {isCreator ? (
                      <>
                        <Frame
                          ref={bindDrawingFrame}
                          id="DrawBoard"
                          events={frameEvents}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!shouldShowInteractivePreview}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                          interactiveOverride={frameNeedsInteractive}
                          recordingSequence={isSequenceRecording}
                          persistRecordedSequenceStep={isSequenceRecording}
                          replaySequence={replaySequence}
                          suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
                          dataTestId={suppressHeavyLayoutEffects ? undefined : "creator-template-drawboard-frame"}
                          onVerifiedInteraction={handleVerifiedInteraction}
                          artifactCache={drawingArtifactDescriptor}
                          onJsError={handleJsError}
                          onRuntimeWarning={handleRuntimeWarning}
                        />
                        {!shouldShowInteractivePreview && (
                          <div className="relative z-[1]">
                            <Image
                              name="drawing"
                              imageUrl={drawingUrl}
                              alt="Creator static preview"
                              height={scenario.dimensions.height}
                              width={scenario.dimensions.width}
                              loadingMessage="Loading your design…"
                            />
                          </div>
                        )}
                        {!shouldShowInteractivePreview && jsError && (
                          <FrameJsErrorOverlay
                            error={jsError}
                            width={scenario.dimensions.width}
                            height={scenario.dimensions.height}
                          />
                        )}
                        {manualDrawboardCapture && !shouldShowInteractivePreview && (
                          <div className="absolute top-2 right-2 z-30">
                            <PoppingTitle topTitle="Capture picture from your design">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/90 shadow-sm"
                                disabled={drawingCaptureBusy}
                                aria-label="Capture picture from your design"
                                onClick={() => drawingFrameRef.current?.requestCapture()}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </PoppingTitle>
                          </div>
                        )}
                        {manualDrawboardCapture && shouldShowInteractivePreview && (
                          <div className="absolute top-2 right-2 z-30">
                            <PoppingTitle topTitle="Capture picture from your preview">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/90 shadow-sm"
                                disabled={drawingCaptureBusy}
                                aria-label="Capture picture from your preview"
                                onClick={() => drawingFrameRef.current?.requestCapture()}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </PoppingTitle>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Frame
                          ref={bindDrawingFrame}
                          id="DrawBoard"
                          events={frameEvents}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!interactive && !frameNeedsInteractive}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                          interactiveOverride={frameNeedsInteractive}
                          recordingSequence={isSequenceRecording}
                          persistRecordedSequenceStep={isSequenceRecording}
                          replaySequence={replaySequence}
                          suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
                          onVerifiedInteraction={handleVerifiedInteraction}
                          artifactCache={drawingArtifactDescriptor}
                          onJsError={handleJsError}
                          onRuntimeWarning={handleRuntimeWarning}
                        />
                        {!interactive && !frameNeedsInteractive && (
                          <div className="relative z-[1]">
                            <Image
                              name="drawing"
                              imageUrl={drawingUrl}
                              alt="Player static preview"
                              height={scenario.dimensions.height}
                              width={scenario.dimensions.width}
                              loadingMessage="Loading your design…"
                            />
                          </div>
                        )}
                        {!interactive && !frameNeedsInteractive && jsError && (
                          <FrameJsErrorOverlay
                            error={jsError}
                            width={scenario.dimensions.width}
                            height={scenario.dimensions.height}
                          />
                        )}
                      </>
                    )}
                    {drawingCaptureBusy
                      && (!isCreator || shouldShowInteractivePreview) && (
                        <div
                          className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
                          aria-busy
                          aria-label="Generating picture"
                        >
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    {runtimeWarning && (
                      <div
                        className="absolute bottom-2 left-2 right-2 z-30 rounded-md border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm"
                        role="status"
                        aria-live="polite"
                      >
                        {runtimeWarning}
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </ArtContainer>
        </Board>
      </BoardContainer>
    </div>
  );
};
