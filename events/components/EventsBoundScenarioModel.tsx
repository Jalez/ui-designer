'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { useArtboardActionBar } from "@/components/ArtBoards/ArtboardActionBarContext";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { ScenarioFrameBoard } from "@/components/ArtBoards/ScenarioFrameBoard";
import { Diff } from "@/components/ArtBoards/ModelBoard/Diff/Diff";
import { Image } from "@/components/General/Image/Image";
import { DiffModelToggleContent } from "@/components/General/DiffModelToggleContent";
import {
  hashArtifactFingerprint,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import {
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { announceLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import { clearStoredSolutionSide } from "@/lib/drawboard/drawboardPixelsStore";
import type { scenario } from "@/types";
import type { FrameHandle, FrameJsError } from "@/components/ArtBoards/Frame";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { ManualCaptureButton } from "@/components/General/ManualCaptureButton";

type EventsBoundScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
};



export const EventsBoundScenarioModel = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
}: EventsBoundScenarioModelProps) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const levelIdentifier = level?.identifier ?? null;
  const levelName = level?.name ?? null;
  const showModel = level?.showSolutionImageInsteadOfDiff ?? true;
  const currentGameId = useGameStore((state) => state.currentGameId);
  const { runtime, solutionBoard } = useArtboardContext();
  const { canEditCurrentGame, showLive } = useGameContext();
  const solutionReplayBatchCheckpoint = solutionBoard.onReplayBatchCheckpoint;
  const solutionReplayBatchStatus = solutionBoard.onReplayBatchStatus;
  const solutionCurrentStepId = solutionBoard.currentStepId;
  const solutionReplayBatchVisibleStepIds = solutionBoard.replayBatchVisibleStepIds;
  const solutionReplaySequence = solutionBoard.replaySequence;
  const solutionForceEmptyReplaySequence = solutionBoard.forceEmptyReplaySequence;
  const solutionInteractionTriggers = solutionBoard.interactionTriggers;
  const solutionCurrentImageUrl = solutionBoard.currentImageUrl;
  const { manualDrawboardCapture } = useGameRuntimeConfig();
  const { setModelActions } = useArtboardActionBar();
  const captureNav = useOptionalDrawboardNavbarCapture();
  const [solutionCaptureBusy, setSolutionCaptureBusy] = useState(false);
  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);

  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence?.byScenarioId, scenario.scenarioId],
  );
  const selectedSolutionStep = useMemo(
    () => (
      solutionCurrentStepId
        ? scenarioSequence.find((step) => step.id === solutionCurrentStepId) ?? null
        : null
    ),
    [scenarioSequence, solutionCurrentStepId],
  );
  const solutionFingerprint = useMemo(
    () => solutionArtifactFingerprint({
      html: level?.solution?.html || "",
      css: level?.solution?.css || "",
      js: level?.solution?.js || "",
      scenario,
    }),
    [level?.solution?.css, level?.solution?.html, level?.solution?.js, scenario],
  );
  const usePerStepSolutionKeys = runtime.sequenceLength > 0;
  const activeSolutionFingerprint = useMemo(() => {
    if (!usePerStepSolutionKeys) {
      return solutionFingerprint;
    }
    if (selectedSolutionStep) {
      if (selectedSolutionStep.isInitial) {
        return hashArtifactFingerprint(["solution-step", solutionFingerprint, selectedSolutionStep.id]);
      }
      return solutionStepArtifactFingerprint({ solutionFingerprint, step: selectedSolutionStep });
    }
    return solutionFingerprint;
  }, [selectedSolutionStep, solutionFingerprint, usePerStepSolutionKeys]);
  const solutionArtifactDescriptor = useMemo<DrawboardArtifactDescriptor>(
    () => ({
      version: "v1",
      artifactType: usePerStepSolutionKeys ? "solution-step" : "solution",
      fingerprint: activeSolutionFingerprint,
      gameId: currentGameId,
      levelIdentifier,
      levelName,
      scenarioId: scenario.scenarioId,
      stepId: usePerStepSolutionKeys ? solutionCurrentStepId : null,
      width: scenario.dimensions.width,
      height: scenario.dimensions.height,
    }),
    [
      activeSolutionFingerprint,
      currentGameId,
      levelIdentifier,
      levelName,
      scenario.dimensions.height,
      scenario.dimensions.width,
      scenario.scenarioId,
      solutionCurrentStepId,
      usePerStepSolutionKeys,
    ],
  );


  const solutionUrl = solutionCurrentImageUrl


  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  const shouldForceHiddenCaptureRemount = usePerStepSolutionKeys
    && !showLive
    && !canEditCurrentGame;
  const solutionFrameInstanceKey = shouldForceHiddenCaptureRemount
    ? `solution-${solutionArtifactDescriptor.fingerprint}-${solutionCurrentStepId ?? "none"}`
    : undefined;

  const prevSolutionFrameKeyRef = useRef(solutionFrameInstanceKey);
  useEffect(() => {
    if (
      shouldForceHiddenCaptureRemount
      && prevSolutionFrameKeyRef.current
      && prevSolutionFrameKeyRef.current !== solutionFrameInstanceKey
    ) {
      clearStoredSolutionSide(scenario.scenarioId);
    }
    prevSolutionFrameKeyRef.current = solutionFrameInstanceKey;
  }, [scenario.scenarioId, shouldForceHiddenCaptureRemount, solutionFrameInstanceKey]);

  const solutionFrameNeedsReplay = solutionReplaySequence.length > 0;
  const needsLiveSolutionFrame = showLive || solutionFrameNeedsReplay;
  const mountSolutionFrame =
    needsLiveSolutionFrame
    || canEditCurrentGame
    || (!usePerStepSolutionKeys && !hasSolutionCapture)
    || (
      usePerStepSolutionKeys
      && !suppressHeavyLayoutEffects
      && !hasSolutionCapture
    );

  const prevMountedSolutionFrameRef = useRef(mountSolutionFrame);
  useEffect(() => {
    const prev = prevMountedSolutionFrameRef.current;
    if (prev && !mountSolutionFrame && !canEditCurrentGame) {
      announceLiveSolutionFrameRemoved(scenario.scenarioId);
    }
    prevMountedSolutionFrameRef.current = mountSolutionFrame;
  }, [canEditCurrentGame, mountSolutionFrame, scenario.scenarioId]);

  const levelSolution = level?.solution || { css: "", html: "", js: "" };
  const solutionCss = levelSolution.css || "";
  const solutionHtml = levelSolution.html || "";
  const solutionJs = levelSolution.js || "";

  const bindSolutionFrame = useCallback((instance: FrameHandle | null) => {
    if (solutionFrameRef.current === instance) {
      return;
    }
    solutionFrameRef.current = instance;
    if (registerForNavbarCapture) {
      captureNav?.registerSolutionFrame(instance);
    }
  }, [captureNav, registerForNavbarCapture]);

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerSolutionFrame(null);
      }
    };
  }, [captureNav, registerForNavbarCapture]);

  const handleSolutionCaptureBusy = useCallback((busy: boolean) => {
    setSolutionCaptureBusy(busy);
    if (registerForNavbarCapture) {
      captureNav?.notifySolutionBusy(busy);
    }
  }, [captureNav, registerForNavbarCapture]);
  const handleJsError = useCallback((error: FrameJsError | null) => setJsError(error), []);


  const showSolutionCapture = canEditCurrentGame && manualDrawboardCapture;

  useEffect(() => {
    setModelActions(
      <>
        {!showLive ? (
          <div className="flex h-9 items-center rounded-full bg-muted px-3 py-0 text-foreground shadow-sm">
            <DiffModelToggleContent
              leftLabel="diff"
              rightLabel="model"
            />
          </div>
        ) : null}
        {showSolutionCapture ? (
          <ManualCaptureButton
            busy={solutionCaptureBusy}
            frameRef={solutionFrameRef}
            title="Capture picture from solution (static view)"
          />
        ) : null}
      </>,
    );

    return () => {
      setModelActions(null);
    };
  }, [
    setModelActions,
    showLive,
    showSolutionCapture,
    solutionCaptureBusy,
  ]);


  return (
    <ScenarioFrameBoard
      scenario={scenario}
      allowScaling={allowScaling}
      allowRecording
      mountFrame={mountSolutionFrame}
      replayBatchRequest={runtime.activeRunId != null && solutionReplayBatchVisibleStepIds.length > 0
        ? {
          enabled: true,
          replaySequence: solutionReplaySequence,
          runId: runtime.activeRunId,
          visibleStepIds: solutionReplayBatchVisibleStepIds,
        }
        : null}
      viewportPointerEvents={showLive ? "none" : "auto"}
      frameConfig={{
        key: solutionFrameInstanceKey,
        ref: bindSolutionFrame,
        name: "solutionUrl",
        events: solutionInteractionTriggers,
        newCss: solutionCss,
        newHtml: solutionHtml,
        newJs: `${solutionJs}\n${scenario.js}`,
        hiddenFromView: !showLive,
        onCaptureBusyChange: handleSolutionCaptureBusy,
        interactiveOverride: showLive,
        replaySequence: solutionReplaySequence,
        forceEmptyReplaySequence: solutionForceEmptyReplaySequence,
        suppressHeavyLayoutEffects,
        eventSequenceSolutionStepId: usePerStepSolutionKeys ? solutionCurrentStepId : null,
        selectedReplayStepId: usePerStepSolutionKeys ? solutionCurrentStepId : null,
        artifactCache: solutionArtifactDescriptor,
        onJsError: handleJsError,
        onReplayBatchCheckpoint: solutionReplayBatchCheckpoint,
        onReplayBatchStatus: solutionReplayBatchStatus,
      }}
      surfaceContent={!showLive ? (
        showModel && solutionUrl ? (
          <Image
            name="solution"
            imageUrl={solutionUrl}
            alt="Reference solution"
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            loadingMessage="Loading reference image…"
          />
        ) : (
          <Diff scenario={scenario} />
        )
      ) : null}
      jsError={jsError}
      showJsErrorOverlay={!showLive}
      showCaptureBusyOverlay={solutionCaptureBusy}
      showLoadingOverlay={!canEditCurrentGame && !hasSolutionCapture}
      loadingMessage="Preparing reference…"
    />
  );
};
