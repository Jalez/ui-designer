/** @format */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScenarioModel } from "@/components/ArtBoards/ModelBoard/ScenarioModel";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceReplayTypes";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import { defaultTimelineStepIdForSolutionCapture } from "@/events/core/eventSequenceSolutionUrls";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "@/events/core/eventSequenceReplayTypes";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import { useScenarioArtifacts } from "@/events/hooks/useScenarioArtifacts";
import { useBrowserSolutionPreflightStore } from "@/events/core/browserSolutionPreflightStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventState } from "@/events/components/EventContext";
import { useAppDispatch } from "@/store/hooks/hooks";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { buildArtifactKey, hashArtifactFingerprint } from "@/lib/drawboard/artifactCache";
import { solutionStepArtifactFingerprint } from "@/lib/drawboard/artifactFingerprint";
import type { FrameHandle, ReplayBatchCheckpoint } from "@/components/ArtBoards/Frame";
import type { scenario } from "@/types";
import { useGameContext } from "@/components/ArtBoards/GameContext";

type EventsBoundScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
  creatorPreviewInteractive?: boolean;

  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId?: string | null;
  /** Drives solution iframe while filling per-step Redux URLs (browser prewarm). */
  solutionStepIdOverride?: string | null;
  onSolutionStepPrewarmChange?: (stepId: string | null) => void;
  eventSequenceScopedTriggers?: boolean;
  forceEmptyReplaySequence?: boolean;
};

export const EventsBoundScenarioModel = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorPreviewInteractive,
  selectedEventSequenceStepId,
  gameplaySolutionStepId = null,
  solutionStepIdOverride = null,
  onSolutionStepPrewarmChange,
  eventSequenceScopedTriggers = false,
  forceEmptyReplaySequence = false,
}: EventsBoundScenarioModelProps) => {
  const dispatch = useAppDispatch();
  const { currentLevel, level } = useLevelContext();
  const { isCreatorContext, drawboardCaptureMode } = useGameContext();
  const isCreator = isCreatorContext;

  const scenarioSequence = level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];

  const solutionStepIdForCapture = useMemo(() => {
    if (scenarioSequence.length > 0) {
      const override = solutionStepIdOverride?.trim();
      if (override) return defaultTimelineStepIdForSolutionCapture(override);
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed && scrubbed !== INITIAL_EVENT_SEQUENCE_STEP_ID) {
        return defaultTimelineStepIdForSolutionCapture(scrubbed);
      }
      if (!isCreator && gameplaySolutionStepId != null) {
        return defaultTimelineStepIdForSolutionCapture(gameplaySolutionStepId);
      }
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence.length, selectedEventSequenceStepId, solutionStepIdOverride]);
  const replayDrivingStepId = solutionStepIdOverride?.trim() || selectedEventSequenceStepId || null;

  const runtimeKey = useMemo(
    () => getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId),
    [currentLevel, scenario.scenarioId],
  );

  const recordingMode = useEventSequenceRecordingStore(
    (state) => state.recordingModeByKey[runtimeKey] ?? "idle",
  );

  const eventSequenceRunActive = useSequenceReplayStore((state) => state.isRunning);
  const replayBatchSession = useSequenceReplayStore(
    (state) => state.batchByKey[runtimeKey] ?? null,
  );
  const autoReplayRunning = eventSequenceRunActive && Boolean(replayBatchSession);

  const fallbackEvents = useMemo(() => level?.events ?? [], [level]);

  const artifacts = useScenarioArtifacts({
    scenario,
    isCreator,
    selectedEventSequenceStepId,
    gameplaySolutionStepId,
    solutionStepIdOverride,
    scenarioSequence,
  });
  const getStepSolutionUrl = artifacts.getStepSolutionUrl;

  const buildStepSolutionDescriptor = useCallback(
    (stepId: string) => {
      const comparisonStep = scenarioSequence.find((s) => s.id === stepId) ?? null;
      const fp =
        stepId === INITIAL_EVENT_SEQUENCE_STEP_ID
          ? hashArtifactFingerprint([
              "solution-step",
              artifacts.solutionFingerprint,
              INITIAL_EVENT_SEQUENCE_STEP_ID,
            ])
          : comparisonStep
            ? solutionStepArtifactFingerprint({
                solutionFingerprint: artifacts.solutionFingerprint,
                step: comparisonStep,
              })
            : artifacts.solutionFingerprint;
      return artifacts.buildDescriptor(
        artifacts.usePerStepSolutionKeys ? "solution-step" : "solution",
        fp,
        artifacts.usePerStepSolutionKeys ? stepId : null,
      );
    },
    [
      artifacts.buildDescriptor,
      artifacts.solutionFingerprint,
      artifacts.usePerStepSolutionKeys,
      scenarioSequence,
    ],
  );

  const handleSolutionReplayBatchCheckpoint = useCallback(
    (checkpoint: ReplayBatchCheckpoint) => {
      if (!scenarioSequence.length) return;
      const descriptor = buildStepSolutionDescriptor(checkpoint.stepId);
      const storageKey = buildArtifactKey(descriptor);
      dispatch(
        addSolutionUrl({
          solutionUrl: checkpoint.dataUrl,
          scenarioId: scenario.scenarioId,
          storageKey,
          eventSequenceStepId: checkpoint.stepId,
        }),
      );
    },
    [buildStepSolutionDescriptor, dispatch, scenario.scenarioId, scenarioSequence.length],
  );

  const batchVisibleStepIds = useMemo(
    () => [INITIAL_EVENT_SEQUENCE_STEP_ID, ...scenarioSequence.map((step) => step.id)],
    [scenarioSequence],
  );

  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const [solutionFrameReadyVersion, setSolutionFrameReadyVersion] = useState(0);
  const [captureRequest, setCaptureRequest] = useState<{
    stepId: string;
    resolve: (url: string | null) => void;
  } | null>(null);
  const captureResolveRef = useRef<((url: string | null) => void) | null>(null);
  const requestedCaptureStepRef = useRef<string | null>(null);

  useEffect(() => {
    if (!captureRequest) return;
    captureResolveRef.current = captureRequest.resolve;
    if (drawboardCaptureMode !== "browser") {
      requestedCaptureStepRef.current = null;
      onSolutionStepPrewarmChange?.(null);
      captureRequest.resolve(getStepSolutionUrl(captureRequest.stepId).trim() || null);
      captureResolveRef.current = null;
      queueMicrotask(() => setCaptureRequest(null));
      return;
    }
    const targetUrl = getStepSolutionUrl(captureRequest.stepId).trim();
    if (targetUrl) {
      requestedCaptureStepRef.current = null;
      onSolutionStepPrewarmChange?.(null);
      captureRequest.resolve(targetUrl);
      captureResolveRef.current = null;
      queueMicrotask(() => setCaptureRequest(null));
      return;
    }
    if (solutionStepIdOverride !== captureRequest.stepId) {
      requestedCaptureStepRef.current = null;
      onSolutionStepPrewarmChange?.(captureRequest.stepId);
      return;
    }
    if (solutionStepIdForCapture !== captureRequest.stepId) {
      return;
    }
    if (!solutionFrameRef.current) {
      return;
    }
    if (requestedCaptureStepRef.current !== captureRequest.stepId) {
      requestedCaptureStepRef.current = captureRequest.stepId;
      solutionFrameRef.current.requestCapture();
    }
  }, [
    captureRequest,
    drawboardCaptureMode,
    getStepSolutionUrl,
    onSolutionStepPrewarmChange,
    solutionStepIdForCapture,
    solutionStepIdOverride,
  ]);

  const captureStepSolution = useCallback(
    (stepId: string): Promise<string | null> =>
      new Promise<string | null>((resolve) => {
        setCaptureRequest((current) => {
          current?.resolve(null);
          captureResolveRef.current = resolve;
          requestedCaptureStepRef.current = null;
          return { stepId, resolve };
        });
      }),
    [],
  );

  useEffect(() => {
    if (!runtimeKey) return;
    useBrowserSolutionPreflightStore.getState().registerRunner(runtimeKey, captureStepSolution);
    return () => {
      useBrowserSolutionPreflightStore.getState().registerRunner(runtimeKey, null);
    };
  }, [captureStepSolution, runtimeKey]);

  useEffect(() => () => {
    requestedCaptureStepRef.current = null;
    captureResolveRef.current?.(null);
    captureResolveRef.current = null;
  }, []);

  // Paired with `forceEmptyReplaySequence={autoReplayRunning}` below so options-patch baseline
  // resets do not race with the batch animation.
  const requestedSolutionBatchRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!scenarioSequence.length) return;
    if (!eventSequenceRunActive || !replayBatchSession) {
      if (requestedSolutionBatchRunIdRef.current != null) {
        solutionFrameRef.current?.cancelReplayBatch(requestedSolutionBatchRunIdRef.current);
      }
      requestedSolutionBatchRunIdRef.current = null;
      return;
    }
    if (requestedSolutionBatchRunIdRef.current === replayBatchSession.runId) return;
    if (!solutionFrameRef.current) return;

    requestedSolutionBatchRunIdRef.current = replayBatchSession.runId;
    solutionFrameRef.current.requestReplayBatch({
      replaySequence: scenarioSequence,
      runId: replayBatchSession.runId,
      visibleStepIds: batchVisibleStepIds,
    });
  }, [batchVisibleStepIds, eventSequenceRunActive, replayBatchSession, scenarioSequence, solutionFrameReadyVersion]);

  const handleSolutionFrameReady = useCallback((handle: FrameHandle | null) => {
    solutionFrameRef.current = handle;
    setSolutionFrameReadyVersion((v) => v + 1);
  }, []);

  /**
   * Mirror `EventsBoundScenarioDrawing`: drawing uses `hasCapture: Boolean(artifacts.drawingUrl)` so
   * `useEventSequencePreview` toggles interactive preview consistently. Model uses solution URL presence.
   */
  const hasCapture = Boolean(artifacts.solutionUrl?.trim());

  const {
    replaySequence,
    shouldShowInteractivePreview,
    isSequenceRecording,
  } = useEventSequencePreview({
    isCreator,
    scenarioSequence,
    selectedEventSequenceStepId: replayDrivingStepId,
    eventSequenceScopedTriggers,
    recordingMode,
    creatorPreviewInteractive,
    hasCapture,
    fallbackEvents,
  });
  const { currentInteractionTriggers } = useEventState();

  return (
    <ScenarioModel
      scenario={scenario}
      allowScaling={allowScaling}
      registerForNavbarCapture={registerForNavbarCapture}
      suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
      creatorPreviewInteractive={creatorPreviewInteractive}
      creatorMode={isCreator}
      activeSolutionStepId={solutionStepIdForCapture}
      showInteractivePreview={shouldShowInteractivePreview}
      interactiveSnapshotOverride={null}
      replaySequence={replaySequence}
      interactionTriggers={currentInteractionTriggers}
      isSequenceRecording={isSequenceRecording || recordingMode !== "idle"}
      forceEmptyReplaySequence={forceEmptyReplaySequence || autoReplayRunning}
      scenarioSequenceLength={scenarioSequence.length}
      onSolutionFrameReady={handleSolutionFrameReady}
      onSolutionReplayBatchCheckpoint={handleSolutionReplayBatchCheckpoint}
    />
  );
};
