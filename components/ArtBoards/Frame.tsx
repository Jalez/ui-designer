/** @format */
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks/hooks";
import { EventSequenceStep, InteractionTrigger, VerifiedInteraction, scenario } from "@/types";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import { appendEventSequenceStep, recordVerifiedInteraction } from "@/store/slices/levels.slice";
import { cn } from "@/lib/utils/cn";
import { apiUrl } from "@/lib/apiUrl";
import { serializeLevelForPersistence } from "@/lib/levels/variants";
import { dataUrlFromRawRgba, imageDataFromRawRgba } from "@/lib/utils/drawboardSnapshot";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { eventSequenceSolutionStorageKey } from "@/events/core/eventSequenceSolutionUrls";
import { getEventSequenceScenarioUiKey, markReplayJourneyCompleted } from "@/events/core/eventSequenceState";
import { useEventSequenceReplayBatchStore } from "@/events/core/eventSequenceReplayBatchStore";
import { useEventSequenceReplayUiStore } from "@/events/core/eventSequenceReplayUiStore";
import {
  buildArtifactKey,
  persistLocalArtifact,
  removeLocalArtifactsMatching,
  type DrawboardArtifactDescriptor,
  uploadRemoteArtifact,
} from "@/lib/drawboard/artifactCache";
import { notifySessionStepDrawingCapture } from "@/lib/drawboard/drawboardPixelsStore";

/**
 * Module-level capture dedup. SidebySideArt renders each content element multiple times
 * (probes + layout modes), creating several Frame instances for the same name+scenarioId.
 * The event.source guard handles per-message isolation, but all instances still process
 * their own iframe independently. This content-aware dedup ensures only one API call per
 * unique snapshot, collapsing duplicates from the redundant instances.
 */
const _lastCapture = new Map<string, { time: number; contentKey: string }>();
const _lastVerifiedInteraction = new Map<string, number>();
const _uploadedArtifactFingerprints = new Map<string, string>();
const CAPTURE_DEDUP_MS = 100;
/** Below Playwright layout follow-up interval so a second identical snapshot can refresh captures after fonts settle. */
const CAPTURE_SAME_CONTENT_WINDOW_MS = 320;
/** Debounce PUTs so recording many steps does not spam the API; keyed by level identifier. */
const _eventSequencePersistTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

type PendingReplayBatchRequest = {
  replaySequence: EventSequenceStep[];
  runId: number;
  visibleStepIds: string[];
};

function shouldCapture(key: string, contentKey: string): boolean {
  const now = Date.now();
  const last = _lastCapture.get(key);
  if (last) {
    if (last.contentKey === contentKey && now - last.time < CAPTURE_SAME_CONTENT_WINDOW_MS) return false;
    if (now - last.time < CAPTURE_DEDUP_MS) return false;
  }
  _lastCapture.set(key, { time: now, contentKey });
  return true;
}

function shouldStoreVerifiedInteraction(key: string): boolean {
  const now = Date.now();
  const last = _lastVerifiedInteraction.get(key);
  if (last && now - last < 250) return false;
  _lastVerifiedInteraction.set(key, now);
  return true;
}

export type FrameJsError = {
  message: string;
  lineno: number;
  colno: number;
};

export type FrameRuntimeWarning = {
  type: "form-submit-without-prevent-default";
  message: string;
};

export type FrameHandle = {
  requestCapture: () => void;
  requestReplayBatch: (input: {
    replaySequence: EventSequenceStep[];
    runId: number;
    visibleStepIds: string[];
  }) => void;
  cancelReplayBatch: (runId: number) => void;
};

export type ReplayBatchCheckpoint = {
  imageData: ImageData;
  dataUrl: string;
  height: number;
  replaySignature: string | null;
  runId: number;
  stepId: string;
  width: number;
};

export type ReplayBatchStatusEvent = {
  error?: string | null;
  runId: number;
  status: "started" | "completed" | "cancelled" | "failed";
};

interface FrameProps {
  newHtml: string;
  newCss: string;
  newJs: string;
  events: InteractionTrigger[];
  id: string;
  name: string;
  frameUrl?: string;
  scenario: scenario;
  hiddenFromView?: boolean;
  onCaptureBusyChange?: (busy: boolean) => void;
  interactiveOverride?: boolean;
  recordingSequence?: boolean;
  onVerifiedInteraction?: (interaction: VerifiedInteraction) => void;
  persistRecordedSequenceStep?: boolean;
  replaySequence?: EventSequenceStep[];
  forceEmptyReplaySequence?: boolean;
  /** Skip iframe reload/options-patch storms for SidebySideArt probes and hidden layout clones. */
  suppressHeavyLayoutEffects?: boolean;
  /** Stable selector for E2E (omit on probe/hidden clones). */
  dataTestId?: string;
  /** Game + event sequence: tag captures so Redux can store one image per timeline step. */
  eventSequenceSolutionStepId?: string | null;
  /** Semantic selected step for baseline reset even when replay prefix is empty. */
  selectedReplayStepId?: string | null;
  artifactCache?: DrawboardArtifactDescriptor;
  /** Called when the iframe reports a JS error (or clears it). `null` means the error was cleared. */
  onJsError?: (error: FrameJsError | null) => void;
  /** Called when runtime behavior is recovered but user should be informed. */
  onRuntimeWarning?: (warning: FrameRuntimeWarning) => void;
  onReplayBatchCheckpoint?: (checkpoint: ReplayBatchCheckpoint) => void;
  onReplayBatchStatus?: (event: ReplayBatchStatusEvent) => void;
  sessionStepCaptureCacheKey?: string | null;
}

export const Frame = forwardRef<FrameHandle, FrameProps>(function Frame(
  {
    id,
    newHtml,
    newCss,
    newJs,
    name,
    events,
    scenario,
    frameUrl = process.env.NEXT_PUBLIC_DRAWBOARD_URL || "http://localhost:3500",
    hiddenFromView = false,
    onCaptureBusyChange,
    interactiveOverride,
    recordingSequence = false,
    onVerifiedInteraction,
    persistRecordedSequenceStep = false,
    replaySequence = [],
    forceEmptyReplaySequence = false,
    suppressHeavyLayoutEffects = false,
    dataTestId,
    eventSequenceSolutionStepId = null,
    selectedReplayStepId = null,
    artifactCache,
    onJsError,
    onRuntimeWarning,
    onReplayBatchCheckpoint,
    onReplayBatchStatus,
    sessionStepCaptureCacheKey = null,
  },
  ref,
) {
  const shouldDebugReplayStart = process.env.NODE_ENV !== "production";
  const { drawboardCaptureMode, manualDrawboardCapture, remoteSyncDebounceMs, drawboardReloadDebounceMs } = useGameRuntimeConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoadGeneration, setIframeLoadGeneration] = useState(0);
  const renderReadyCaptureTimeoutRef = useRef<number | null>(null);
  const iframeReloadDebounceRef = useRef<number | null>(null);
  const hasSkippedInitialReloadRef = useRef(false);
  const iframeMountedRef = useRef(false);
  const pendingReplayBatchRef = useRef<PendingReplayBatchRequest | null>(null);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { syncLevelFields } = useLevelMetaSync();
  const { currentLevel } = useAppSelector((state: { currentLevel: { currentLevel: number } }) => state.currentLevel);
  const isCreator = useAppSelector((state) => state.options.mode === "creator");
  const runtimeKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
  const level = useAppSelector((state: { levels: Array<{ interactive: boolean }> }) => state.levels[currentLevel - 1]);
  const existingImageUrl = useAppSelector((state) => {
    const artifactStorageKey = artifactCache ? buildArtifactKey(artifactCache) : null;
    if (name === "solutionUrl") {
      const raw = state.solutionUrls as Record<string, string | undefined>;
      if (artifactStorageKey) {
        return raw[artifactStorageKey];
      }
      if (eventSequenceSolutionStepId) {
        // Per-step game capture: do not fall back to legacy scenarioId — that blocks capture and
        // shows one stale image for every step when only the legacy key is populated.
        return raw[eventSequenceSolutionStorageKey(scenario.scenarioId, eventSequenceSolutionStepId)];
      }
      return raw[scenario.scenarioId];
    }
    if (name === "drawingUrl") {
      const raw = state.drawingUrls as Record<string, string | undefined>;
      if (artifactStorageKey) {
        return raw[artifactStorageKey];
      }
      return raw[scenario.scenarioId];
    }
    return undefined;
  });
  const interactive = interactiveOverride ?? level.interactive;
  const outboundReplaySequence = forceEmptyReplaySequence ? [] : replaySequence;

  useEffect(() => {
    if (name !== "solutionUrl") {
      return;
    }
    const storageKey = artifactCache ? buildArtifactKey(artifactCache) : null;

  }, [
    artifactCache,
    currentLevel,
    drawboardCaptureMode,
    eventSequenceSolutionStepId,
    hiddenFromView,
    interactive,
    name,
    outboundReplaySequence,
    scenario.scenarioId,
  ]);

  const persistArtifactRecord = useCallback((input: {
    dataUrl: string;
    pixelBufferBase64?: string;
  }) => {
    if (!artifactCache || !input.dataUrl) {
      return;
    }
    const key = buildArtifactKey(artifactCache);
    const record = {
      ...artifactCache,
      key,
      dataUrl: input.dataUrl,
      pixelBufferBase64: input.pixelBufferBase64,
      createdAt: new Date().toISOString(),
    };
    if (artifactCache.artifactType === "solution" || artifactCache.artifactType === "solution-step") {
      removeLocalArtifactsMatching((candidate) => {
        if (candidate.key === key) {
          return false;
        }
        if (candidate.captureMode !== artifactCache.captureMode) {
          return false;
        }
        if (candidate.artifactType !== artifactCache.artifactType) {
          return false;
        }
        if (candidate.gameId !== artifactCache.gameId) {
          return false;
        }
        if (candidate.levelIdentifier !== artifactCache.levelIdentifier) {
          return false;
        }
        if (candidate.scenarioId !== artifactCache.scenarioId) {
          return false;
        }
        if ((candidate.stepId ?? null) !== (artifactCache.stepId ?? null)) {
          return false;
        }
        return true;
      });
    }
    persistLocalArtifact(record);
    if (artifactCache.artifactType === "solution" || artifactCache.artifactType === "solution-step") {
      const uploadedFingerprint = _uploadedArtifactFingerprints.get(key);
      if (uploadedFingerprint === artifactCache.fingerprint) {
        return;
      }
      _uploadedArtifactFingerprints.set(key, artifactCache.fingerprint);
      void uploadRemoteArtifact(record).catch(() => {
        if (_uploadedArtifactFingerprints.get(key) === artifactCache.fingerprint) {
          _uploadedArtifactFingerprints.delete(key);
        }
      });
    }
  }, [artifactCache]);

  const notifyCaptureBusy = useCallback(
    (busy: boolean) => {
      onCaptureBusyChange?.(busy);
    },
    [onCaptureBusyChange],
  );

  const captureFrame = useCallback(
    async (
      snapshot: { css: string; snapshotHtml: string },
      /** Always ask for HiDPI PNG so solution vs drawing static images use the same asset (browser scales identically). Game mode used to omit this for drawingUrl only, which made the two boards look different despite identical Playwright input. */
      includeDataUrl = true,
    ) => {
      const dedupKey = `${name}:${scenario.scenarioId}:${eventSequenceSolutionStepId ?? ""}`;
      const contentKey = `${snapshot.snapshotHtml.length}:${snapshot.css.length}:${snapshot.snapshotHtml.slice(0, 64)}`;
      if (!shouldCapture(dedupKey, contentKey)) return;
      notifyCaptureBusy(true);
      try {
        const response = await fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            css: snapshot.css,
            snapshotHtml: snapshot.snapshotHtml,
            width: scenario.dimensions.width,
            height: scenario.dimensions.height,
            scenarioId: scenario.scenarioId,
            urlName: name,
            includeDataUrl,
            artifactCache,
          }),
        });

        if (!response.ok) {
          throw new Error(`Drawboard render failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          scenarioId: string;
          urlName: string;
          width: number;
          height: number;
          pixelBufferBase64: string;
          dataUrl?: string;
        };

        const binary = atob(payload.pixelBufferBase64);
        const pixelBuffer = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          pixelBuffer[index] = binary.charCodeAt(index);
        }

        const displayDataUrl =
          payload.dataUrl || dataUrlFromRawRgba(pixelBuffer, payload.width, payload.height);

        window.postMessage(
          {
            message: "pixels",
            dataURL: pixelBuffer.buffer,
            urlName: payload.urlName,
            scenarioId: payload.scenarioId,
            width: payload.width,
            height: payload.height,
          },
          "*",
          [pixelBuffer.buffer],
        );

        if (payload.urlName === "solutionUrl") {
          const storageKey = artifactCache ? buildArtifactKey(artifactCache) : undefined;
      
          dispatch(
            addSolutionUrl({
              solutionUrl: displayDataUrl,
              scenarioId: payload.scenarioId,
              storageKey,
              eventSequenceStepId: eventSequenceSolutionStepId ?? undefined,
            }),
          );
        }

        if (payload.urlName === "drawingUrl") {
          const storageKey = artifactCache ? buildArtifactKey(artifactCache) : undefined;
          dispatch(
            addDrawingUrl({
              drawingUrl: displayDataUrl,
              scenarioId: payload.scenarioId,
              storageKey,
            }),
          );
        }
        if (displayDataUrl) {
          persistArtifactRecord({
            dataUrl: displayDataUrl,
            pixelBufferBase64: payload.pixelBufferBase64,
          });
        }
      } catch (error) {
        console.error(`[Frame:${name}] Failed to capture frame`, error);
      } finally {
        notifyCaptureBusy(false);
      }
    },
    [
      dispatch,
      eventSequenceSolutionStepId,
      name,
      notifyCaptureBusy,
      scenario.dimensions.height,
      scenario.dimensions.width,
      scenario.scenarioId,
      artifactCache,
      persistArtifactRecord,
    ],
  );

  const renderSnapshotCapture = useCallback(
    async (
      snapshot: { css: string; snapshotHtml: string },
      includeDataUrl = true,
      artifactDescriptor?: DrawboardArtifactDescriptor,
    ) => {
      const response = await fetch(apiUrl("/api/drawboard/render"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          css: snapshot.css,
          snapshotHtml: snapshot.snapshotHtml,
          width: scenario.dimensions.width,
          height: scenario.dimensions.height,
          scenarioId: scenario.scenarioId,
          urlName: name,
          includeDataUrl,
          artifactCache: artifactDescriptor,
        }),
      });

      if (!response.ok) {
        throw new Error(`Drawboard render failed with status ${response.status}`);
      }

      return (await response.json()) as {
        scenarioId: string;
        urlName: string;
        width: number;
        height: number;
        pixelBufferBase64: string;
        dataUrl?: string;
      };
    },
    [name, scenario.dimensions.height, scenario.dimensions.width, scenario.scenarioId],
  );

  const eventSequenceSolutionStepIdRef = useRef(eventSequenceSolutionStepId);
  eventSequenceSolutionStepIdRef.current = eventSequenceSolutionStepId;

  const clearPendingRenderReadyCapture = useCallback(() => {
    if (renderReadyCaptureTimeoutRef.current) {
      window.clearTimeout(renderReadyCaptureTimeoutRef.current);
      renderReadyCaptureTimeoutRef.current = null;
    }
  }, []);
  const flushPendingReplayBatch = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    const pending = pendingReplayBatchRef.current;
    if (!win || !iframeMountedRef.current || !pending) {
      return;
    }
    pendingReplayBatchRef.current = null;
    notifyCaptureBusy(true);
    win.postMessage(
      {
        message: "request-replay-batch",
        name,
        replaySequence: pending.replaySequence,
        runId: pending.runId,
        scenarioId: scenario.scenarioId,
        visibleStepIds: pending.visibleStepIds,
      },
      "*",
    );
  }, [name, notifyCaptureBusy, scenario.scenarioId]);

  useImperativeHandle(
    ref,
    () => ({
      requestCapture: () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) {
          return;
        }
        if (drawboardCaptureMode === "browser") {
          notifyCaptureBusy(true);
        }
        win.postMessage(
          {
            message: "request-capture",
            name,
            scenarioId: scenario.scenarioId,
          },
          "*",
        );
      },
      requestReplayBatch: ({ replaySequence: replayBatchSequence, runId, visibleStepIds }) => {
        const win = iframeRef.current?.contentWindow;
        pendingReplayBatchRef.current = {
          replaySequence: replayBatchSequence,
          runId,
          visibleStepIds,
        };
        if (!win || !iframeMountedRef.current) {
          return;
        }
        flushPendingReplayBatch();
      },
      cancelReplayBatch: (runId) => {
        const win = iframeRef.current?.contentWindow;
        if (pendingReplayBatchRef.current?.runId === runId) {
          pendingReplayBatchRef.current = null;
        }
        if (!win) {
          return;
        }
        notifyCaptureBusy(false);
        win.postMessage(
          {
            message: "cancel-replay-batch",
            name,
            runId,
            scenarioId: scenario.scenarioId,
          },
          "*",
        );
      },
    }),
    [drawboardCaptureMode, flushPendingReplayBatch, name, notifyCaptureBusy, scenario.scenarioId],
  );

  const lastMountedHandshakeWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const resendDataAfterMount = (event: MessageEvent) => {
      const mountedPayload =
        typeof event.data === "object" && event.data !== null ? event.data : null;
      const isStructuredMounted =
        mountedPayload?.message === "mounted"
        && typeof mountedPayload.name === "string"
        && typeof mountedPayload.scenarioId === "string";
      const isLegacyMountedString = event.data === "mounted";

      if (isStructuredMounted || isLegacyMountedString) {
        const childWin = iframeRef.current?.contentWindow;
        if (!childWin || event.source !== childWin) {
          return;
        }
        if (lastMountedHandshakeWindowRef.current === childWin) {
          if (name === "solutionUrl") {
            const storageKey = artifactCache ? buildArtifactKey(artifactCache) : null;
        
          }
          return;
        }
        lastMountedHandshakeWindowRef.current = childWin;
        iframeMountedRef.current = true;
        if (name === "solutionUrl") {
          const storageKey = artifactCache ? buildArtifactKey(artifactCache) : null;
        
        }
        if (shouldDebugReplayStart && outboundReplaySequence.length > 0) {
          console.log("[frame:mounted-payload]", {
            name,
            scenarioId: scenario.scenarioId,
            hiddenFromView,
            interactive,
            recordingSequence,
            replaySequenceIds: outboundReplaySequence.map((step) => step.id),
          });
        }
        iframeRef.current?.contentWindow?.postMessage(
          {
            html: newHtml,
            css: newCss,
            js: newJs,
            events: JSON.stringify(events),
            scenarioId: scenario.scenarioId,
            name,
            interactive,
            isCreator,
            recordingSequence,
            replaySequence: outboundReplaySequence,
          },
          "*",
        );
        flushPendingReplayBatch();
        return;
      }

      if (
        event.source === iframeRef.current?.contentWindow
        && event.data?.name === name
        && event.data?.scenarioId === scenario.scenarioId
        && event.data?.message === "unhandled-form-submit-detected"
      ) {
        const action = typeof event.data?.action === "string" ? event.data.action : "";
        onRuntimeWarning?.({
          type: "form-submit-without-prevent-default",
          message: action
            ? `Submit was prevented by the drawboard safety guard (action: ${action || "default"}). Add event.preventDefault() in your own submit handler to remove this warning.`
            : "Submit was prevented by the drawboard safety guard. Add event.preventDefault() in your own submit handler to remove this warning.",
        });
        return;
      }

      if (
        event.source === iframeRef.current?.contentWindow
        && event.data?.name === name
        && event.data?.scenarioId === scenario.scenarioId
        && (event.data?.message === "render-ready" || event.data?.message === "capture-request")
        && typeof event.data?.css === "string"
        && typeof event.data?.snapshotHtml === "string"
      ) {
        if (drawboardCaptureMode === "browser") {
          return;
        }

        // Manual mode still needs the first render-ready snapshot to bootstrap the static board image.
        // After a scenario already has a stored image URL, later updates stay behind the manual button.
        if (manualDrawboardCapture && event.data.message === "render-ready" && existingImageUrl) {
          return;
        }

        const snapshot = {
          css: event.data.css,
          snapshotHtml: event.data.snapshotHtml,
        };

        if (event.data.message === "capture-request") {
          clearPendingRenderReadyCapture();
          void captureFrame(snapshot);
          return;
        }

        clearPendingRenderReadyCapture();
        renderReadyCaptureTimeoutRef.current = window.setTimeout(() => {
          renderReadyCaptureTimeoutRef.current = null;
          void captureFrame(snapshot);
        }, remoteSyncDebounceMs);
      }
    };

    window.addEventListener("message", resendDataAfterMount);

    return () => {
      clearPendingRenderReadyCapture();
      window.removeEventListener("message", resendDataAfterMount);
    };
  }, [
    captureFrame,
    clearPendingRenderReadyCapture,
    events,
    flushPendingReplayBatch,
    interactive,
    iframeLoadGeneration,
    isCreator,
    drawboardCaptureMode,
    existingImageUrl,
    manualDrawboardCapture,
    name,
    newCss,
    newHtml,
    newJs,
    recordingSequence,
    onRuntimeWarning,
    replaySequence,
    remoteSyncDebounceMs,
    scenario.scenarioId,
  ]);

  useEffect(() => {
    const handleVerifiedInteraction = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.message !== "verified-interaction") {
        return;
      }
      if (event.data?.urlName !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (name !== "drawingUrl") {
        return;
      }

      const interaction = event.data?.interaction as VerifiedInteraction | undefined;
      if (!interaction?.id) {
        return;
      }

      if (!isCreator) {
        onVerifiedInteraction?.(interaction);
        return;
      }

      const dedupKey = `${scenario.scenarioId}:${interaction.id}`;
      if (!shouldStoreVerifiedInteraction(dedupKey)) {
        return;
      }

      onVerifiedInteraction?.(interaction);

      dispatch(
        recordVerifiedInteraction({
          levelId: currentLevel,
          scenarioId: scenario.scenarioId,
          interaction,
        }),
      );
      syncLevelFields(currentLevel - 1, ["interactionArtifacts"]);
    };

    window.addEventListener("message", handleVerifiedInteraction);
    return () => {
      window.removeEventListener("message", handleVerifiedInteraction);
    };
  }, [currentLevel, dispatch, isCreator, name, onVerifiedInteraction, scenario.scenarioId, syncLevelFields]);

  useEffect(() => {
    const handleRecordedSequenceStep = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.message !== "recorded-event-sequence-step") {
        return;
      }
      if (event.data?.urlName !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (!isCreator || !persistRecordedSequenceStep) {
        return;
      }

      const step = event.data?.step as EventSequenceStep | undefined;
      if (!step?.id) {
        return;
      }

      dispatch(
        appendEventSequenceStep({
          levelId: currentLevel,
          scenarioId: scenario.scenarioId,
          step,
        }),
      );
      syncLevelFields(currentLevel - 1, ["eventSequence"]);

      const levelIndex = currentLevel - 1;
      const levelAfter = store.getState().levels[levelIndex];
      if (!levelAfter?.identifier) {
        return;
      }
      const persistKey = levelAfter.identifier;
      const prevTimeout = _eventSequencePersistTimeouts.get(persistKey);
      if (prevTimeout) {
        clearTimeout(prevTimeout);
      }
      const timeout = setTimeout(() => {
        _eventSequencePersistTimeouts.delete(persistKey);
        const fresh = store.getState().levels[levelIndex];
        if (!fresh?.identifier || !fresh.eventSequence) {
          return;
        }
        const by = fresh.eventSequence.byScenarioId;
        if (!by || Object.keys(by).length === 0) {
          return;
        }
        const serializedLevel = serializeLevelForPersistence({
          ...fresh,
          eventSequence: fresh.eventSequence,
        });
        const { name, ...json } = serializedLevel;
        fetch(apiUrl(`/api/levels/${fresh.identifier}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ...json }),
        }).catch(() => {});
      }, 500);
      _eventSequencePersistTimeouts.set(persistKey, timeout);
    };

    window.addEventListener("message", handleRecordedSequenceStep);
    return () => {
      window.removeEventListener("message", handleRecordedSequenceStep);
    };
  }, [currentLevel, dispatch, isCreator, name, persistRecordedSequenceStep, scenario.scenarioId, store, syncLevelFields]);

  useEffect(() => {
    const handleDisplayUrlFromIframe = (event: MessageEvent) => {
      if (event.data?.message !== "data" || typeof event.data?.dataURL !== "string") {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (name !== "solutionUrl" && name !== "drawingUrl") {
        return;
      }
      if (name === "solutionUrl") {
        const stepId = eventSequenceSolutionStepIdRef.current;
        const storageKey = artifactCache ? buildArtifactKey(artifactCache) : undefined;
        // #region agent log
        fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',runId:'post-fix-h28',hypothesisId:'H28',location:'Frame.tsx:handleDisplayUrlFromIframe:liveIframeDispatch',message:'live iframe solution URL dispatched (always overwrites)',data:{storageKey,stepId,newLen:typeof event.data.dataURL==='string'?event.data.dataURL.length:0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        dispatch(
          addSolutionUrl({
            solutionUrl: event.data.dataURL,
            scenarioId: scenario.scenarioId,
            storageKey,
            eventSequenceStepId: stepId ?? undefined,
          }),
        );
      }
      if (name === "drawingUrl") {
        const storageKey = artifactCache ? buildArtifactKey(artifactCache) : undefined;
        dispatch(
          addDrawingUrl({
            drawingUrl: event.data.dataURL,
            scenarioId: scenario.scenarioId,
            storageKey,
          }),
        );
      }
      persistArtifactRecord({
        dataUrl: event.data.dataURL,
      });
      if (drawboardCaptureMode === "browser") {
        notifyCaptureBusy(false);
      }
    };

    window.addEventListener("message", handleDisplayUrlFromIframe);
    return () => {
      window.removeEventListener("message", handleDisplayUrlFromIframe);
    };
  }, [dispatch, drawboardCaptureMode, name, notifyCaptureBusy, persistArtifactRecord, scenario.scenarioId]);

  useEffect(() => {
    if (drawboardCaptureMode !== "browser") {
      return;
    }
    const onPixels = (event: MessageEvent) => {
      if (event.data?.message !== "pixels") {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenario.scenarioId) {
        return;
      }
      notifyCaptureBusy(false);
    };
    window.addEventListener("message", onPixels);
    return () => {
      window.removeEventListener("message", onPixels);
    };
  }, [drawboardCaptureMode, name, notifyCaptureBusy, scenario.scenarioId]);

  useEffect(() => {
    if (!onJsError) {
      return;
    }
    const handleJsErrorMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (event.data?.message === "js-error" && event.data?.error) {
        onJsError({
          message: String(event.data.error.message ?? "Unknown error"),
          lineno: Number(event.data.error.lineno) || 0,
          colno: Number(event.data.error.colno) || 0,
        });
      } else if (event.data?.message === "js-error-cleared") {
        onJsError(null);
      }
    };
    window.addEventListener("message", handleJsErrorMessage);
    return () => {
      window.removeEventListener("message", handleJsErrorMessage);
    };
  }, [name, onJsError, scenario.scenarioId]);

  /**
   * Patch iframe options (incl. replaySequence) without reloading. Uses last-posted key dedup:
   * the previous "first run stores key only" approach skipped the initial patch when contentWindow
   * was null and never re-ran, and also skipped the first successful run (no postMessage).
   * iframeLoadGeneration re-runs the effect after the iframe fires onLoad so we post once win exists.
   */
  const lastPostedOptionsPatchKeyRef = useRef<string | null>(null);
  const optionsPatchScenarioIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Always patch replay/events (lightweight postMessage). Skipping when `suppressHeavyLayoutEffects`
    // left hidden SidebySideArt slides / probes with stale replay while the visible drawing iframe
    // advanced — diff and per-step solution captures disagreed. Reload debouncing below stays suppressed.
    if (!scenario) {
      return;
    }
    if (optionsPatchScenarioIdRef.current !== scenario.scenarioId) {
      optionsPatchScenarioIdRef.current = scenario.scenarioId;
      lastPostedOptionsPatchKeyRef.current = null;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return;
    }
    const key = `${interactive}:${isCreator}:${recordingSequence}:${selectedReplayStepId ?? ""}:${JSON.stringify(events)}:${JSON.stringify(outboundReplaySequence.map((step) => step.id))}`;
    if (lastPostedOptionsPatchKeyRef.current === key) {
      return;
    }
    lastPostedOptionsPatchKeyRef.current = key;
    if (name === "drawingUrl" && outboundReplaySequence.length === 0) {
      useEventSequenceReplayUiStore.getState().clearReplayDiagnostics(runtimeKey);
    }
    if (shouldDebugReplayStart && outboundReplaySequence.length > 0) {
      console.log("[frame:options-patch]", {
        name,
        scenarioId: scenario.scenarioId,
        hiddenFromView,
        interactive,
        recordingSequence,
        selectedReplayStepId,
        replaySequenceIds: outboundReplaySequence.map((step) => step.id),
        events: events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          selector: event.selector,
        })),
      });
    }
    win.postMessage(
      {
        message: "options-patch",
        name,
        scenarioId: scenario.scenarioId,
        interactive,
        isCreator,
        recordingSequence,
        selectedReplayStepId,
        events: JSON.stringify(events),
        replaySequence: outboundReplaySequence,
      },
      "*",
    );
  }, [
    scenario,
    scenario.scenarioId,
    hiddenFromView,
    interactive,
    isCreator,
    iframeLoadGeneration,
    name,
    recordingSequence,
    runtimeKey,
    selectedReplayStepId,
    events,
    outboundReplaySequence,
    shouldDebugReplayStart,
  ]);

  useEffect(() => {
    const handleReplayBatchStatus = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (event.data?.message !== "event-sequence-replay-batch-status") {
        return;
      }
      if (name !== "drawingUrl") {
        return;
      }

      const runId = typeof event.data?.runId === "number" ? event.data.runId : null;
      const status = typeof event.data?.status === "string" ? event.data.status : null;
      if (
        runId === null
        || (status !== "started" && status !== "completed" && status !== "cancelled" && status !== "failed")
      ) {
        return;
      }
      if (status !== "started") {
        notifyCaptureBusy(false);
      }
      onReplayBatchStatus?.({
        error: typeof event.data?.error === "string" ? event.data.error : null,
        runId,
        status,
      });
    };

    const handleReplayBatchCheckpoint = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (event.data?.message !== "event-sequence-replay-batch-checkpoint") {
        return;
      }
      if (name !== "drawingUrl") {
        return;
      }

      const runId = typeof event.data?.runId === "number" ? event.data.runId : null;
      const stepId = typeof event.data?.stepId === "string" ? event.data.stepId : null;
      const replaySignature = typeof event.data?.replaySignature === "string"
        ? event.data.replaySignature
        : null;
      if (runId === null || !stepId) {
        return;
      }

      try {
        let imageData: ImageData | null = null;
        let dataUrl = "";
        let width = 0;
        let height = 0;

        if (event.data?.pixels instanceof ArrayBuffer) {
          width = typeof event.data?.width === "number" ? event.data.width : scenario.dimensions.width;
          height = typeof event.data?.height === "number" ? event.data.height : scenario.dimensions.height;
          imageData = imageDataFromRawRgba(event.data.pixels, width, height);
          dataUrl = typeof event.data?.dataUrl === "string" && event.data.dataUrl
            ? event.data.dataUrl
            : dataUrlFromRawRgba(event.data.pixels, width, height);
        } else if (typeof event.data?.css === "string" && typeof event.data?.snapshotHtml === "string") {
          const payload = await renderSnapshotCapture({
            css: event.data.css,
            snapshotHtml: event.data.snapshotHtml,
          }, true);
          const binary = atob(payload.pixelBufferBase64);
          const pixelBuffer = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) {
            pixelBuffer[index] = binary.charCodeAt(index);
          }
          width = payload.width;
          height = payload.height;
          imageData = imageDataFromRawRgba(pixelBuffer.buffer.slice(0), width, height);
          dataUrl = payload.dataUrl || dataUrlFromRawRgba(pixelBuffer, width, height);
        }

        if (!imageData || !dataUrl) {
          return;
        }

        if (sessionStepCaptureCacheKey) {
          notifySessionStepDrawingCapture(sessionStepCaptureCacheKey, {
            capturedAt: Date.now(),
            dataUrl,
            height,
            imageData,
            replaySignature,
            runId,
            stepId,
            width,
          });
        }

        onReplayBatchCheckpoint?.({
          dataUrl,
          height,
          imageData,
          replaySignature,
          runId,
          stepId,
          width,
        });
      } catch (error) {
        console.error(`[Frame:${name}] Failed to handle replay batch checkpoint`, error);
        onReplayBatchStatus?.({
          error: error instanceof Error ? error.message : "Failed to process replay batch checkpoint",
          runId,
          status: "failed",
        });
        notifyCaptureBusy(false);
      }
    };

    window.addEventListener("message", handleReplayBatchStatus);
    window.addEventListener("message", handleReplayBatchCheckpoint);
    return () => {
      window.removeEventListener("message", handleReplayBatchStatus);
      window.removeEventListener("message", handleReplayBatchCheckpoint);
    };
  }, [
    name,
    notifyCaptureBusy,
    onReplayBatchCheckpoint,
    onReplayBatchStatus,
    renderSnapshotCapture,
    scenario.dimensions.height,
    scenario.dimensions.width,
    scenario.scenarioId,
    sessionStepCaptureCacheKey,
  ]);

  useEffect(() => {
    const handleReplayStatus = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (event.data?.message !== "event-sequence-replay-status") {
        return;
      }
      /**
       * Only the drawing iframe feeds replay diagnostics. The solution iframe replays the same
       * sequence in parallel for capture/compare; writing both streams into one runtime key
       * interleaves step-started/step-completed and makes the event strip jump out of order.
       */
      if (name !== "drawingUrl") {
        return;
      }

      const batchStore = useEventSequenceReplayBatchStore.getState();
      const uiStore = useEventSequenceReplayUiStore.getState();
      const stepId = typeof event.data?.stepId === "string" ? event.data.stepId : null;
      const selector = typeof event.data?.selector === "string" ? event.data.selector : null;
      const signature = typeof event.data?.signature === "string" ? event.data.signature : "";
      const reason = typeof event.data?.reason === "string" ? event.data.reason : null;
      const index = typeof event.data?.index === "number" ? event.data.index : null;
      const totalSteps = typeof event.data?.totalSteps === "number" ? event.data.totalSteps : 0;
      const replayJourneyTotal = totalSteps > 0 ? totalSteps + 1 : 0;

      switch (event.data?.status) {
        case "run-started":
          if (totalSteps > 0) {
            batchStore.setReplayBatchSessionProgress(runtimeKey, 0, totalSteps);
          }
          if (replayJourneyTotal > 0) {
            uiStore.setReplayJourneyProgress(runtimeKey, 0, replayJourneyTotal);
          }
          if (signature) {
            uiStore.startReplayDiagnostics(runtimeKey, signature, totalSteps);
          }
          break;
        case "step-started":
          if (stepId) {
            uiStore.markReplayStepRunning(runtimeKey, stepId, selector, index);
          }
          if (typeof index === "number" && totalSteps > 0) {
            batchStore.setReplayBatchSessionProgress(runtimeKey, Math.min(index + 0.5, totalSteps), totalSteps);
          }
          if (typeof index === "number" && replayJourneyTotal > 0) {
            uiStore.setReplayJourneyProgress(
              runtimeKey,
              Math.min(index + 1.5, replayJourneyTotal),
              replayJourneyTotal,
            );
          }
          break;
        case "step-completed":
          if (stepId) {
            uiStore.markReplayStepCompleted(runtimeKey, stepId, selector, index);
          }
          if (typeof index === "number" && totalSteps > 0) {
            batchStore.setReplayBatchSessionProgress(runtimeKey, Math.min(index + 1, totalSteps), totalSteps);
          }
          if (typeof index === "number" && replayJourneyTotal > 0) {
            uiStore.setReplayJourneyProgress(
              runtimeKey,
              Math.min(index + 2, replayJourneyTotal),
              replayJourneyTotal,
            );
          }
          break;
        case "step-skipped":
          if (stepId) {
            uiStore.markReplayStepSkipped(runtimeKey, stepId, selector, index, reason);
          }
          if (typeof index === "number" && totalSteps > 0) {
            batchStore.setReplayBatchSessionProgress(runtimeKey, Math.min(index + 1, totalSteps), totalSteps);
          }
          if (typeof index === "number" && replayJourneyTotal > 0) {
            uiStore.setReplayJourneyProgress(
              runtimeKey,
              Math.min(index + 2, replayJourneyTotal),
              replayJourneyTotal,
            );
          }
          break;
        case "run-completed":
          if (totalSteps > 0) {
            batchStore.setReplayBatchSessionProgress(runtimeKey, totalSteps, totalSteps);
          }
          if (replayJourneyTotal > 0) {
            markReplayJourneyCompleted(runtimeKey, replayJourneyTotal);
          }
          if (signature) {
            uiStore.finishReplayDiagnostics(runtimeKey, signature);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handleReplayStatus);
    return () => {
      window.removeEventListener("message", handleReplayStatus);
    };
  }, [name, runtimeKey, scenario.scenarioId]);

  useEffect(() => {
    if (suppressHeavyLayoutEffects) {
      if (iframeReloadDebounceRef.current) {
        window.clearTimeout(iframeReloadDebounceRef.current);
        iframeReloadDebounceRef.current = null;
      }
      return;
    }
    if (!hasSkippedInitialReloadRef.current) {
      hasSkippedInitialReloadRef.current = true;
      return;
    }
    if (iframeReloadDebounceRef.current) {
      window.clearTimeout(iframeReloadDebounceRef.current);
      iframeReloadDebounceRef.current = null;
    }
    iframeReloadDebounceRef.current = window.setTimeout(() => {
      iframeReloadDebounceRef.current = null;
      const iframe = iframeRef.current;
      clearPendingRenderReadyCapture();
      if (iframe) {
        iframeMountedRef.current = false;
        lastMountedHandshakeWindowRef.current = null;
        iframeRef.current?.contentWindow?.postMessage(
          {
            message: "reload",
            name,
          },
          "*",
        );
      }
    }, drawboardReloadDebounceMs);
    return () => {
      if (iframeReloadDebounceRef.current) {
        window.clearTimeout(iframeReloadDebounceRef.current);
        iframeReloadDebounceRef.current = null;
      }
    };
  }, [
    clearPendingRenderReadyCapture,
    drawboardReloadDebounceMs,
    newHtml,
    newCss,
    iframeRef,
    newJs,
    name,
    suppressHeavyLayoutEffects,
  ]);

  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  if (suppressHeavyLayoutEffects) {
    return null;
  }

  const iframeSearch = new URLSearchParams({
    name,
    scenarioId: scenario.scenarioId,
    width: String(scenario.dimensions.width),
    height: String(scenario.dimensions.height),
    captureMode: drawboardCaptureMode,
  });
  if (manualDrawboardCapture) {
    iframeSearch.set("manualCapture", "1");
  }
  const iframeSrc = `${frameUrl}?${iframeSearch.toString()}`;

  return (
    <iframe
      id={id}
      ref={iframeRef}
      data-testid={dataTestId}
      src={iframeSrc}
      onLoad={() => {
        const currentWin = iframeRef.current?.contentWindow ?? null;
        const isPhantomLoad =
          currentWin !== null
          && lastMountedHandshakeWindowRef.current === currentWin;
        if (!isPhantomLoad) {
          iframeMountedRef.current = false;
          lastMountedHandshakeWindowRef.current = null;
        }
        setIframeLoadGeneration((g) => g + 1);
      }}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
      className={cn(
        "overflow-hidden m-0 p-0 border-none bg-secondary absolute top-0 left-0 z-0 transition-[opacity] duration-300 ease-in-out",
        hiddenFromView && "pointer-events-none",
        hiddenFromView && "opacity-0",
      )}
      aria-hidden={hiddenFromView}
      style={{
        width: `${scenario.dimensions.width}px`,
        height: `${scenario.dimensions.height}px`,
        visibility: "visible",
      }}
    />
  );
});

Frame.displayName = "Frame";
