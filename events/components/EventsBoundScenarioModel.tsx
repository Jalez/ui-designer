'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import { useEventsActions } from "@/events/components/EventsContext";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { useArtboardActionBar } from "@/components/ArtBoards/ArtboardActionBarContext";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { ScenarioFrameBoard } from "@/components/ArtBoards/ScenarioFrameBoard";
import { Diff } from "@/components/ArtBoards/ModelBoard/Diff/Diff";
import { Image } from "@/components/General/Image/Image";
import { DiffModelToggleContent } from "@/components/General/DiffModelToggleContent";
import { announceLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import { clearStoredSolutionSide } from "@/lib/drawboard/drawboardPixelsStore";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceState";
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
  const runtimeKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level?.showSolutionImageInsteadOfDiff ?? true;
  const { runtime, solution } = useArtboardContext();
  const { activeRunId, autoReplayRunning } = runtime;
  const { commitSolutionCapture, handleSolutionReplayBatchCheckpoint, handleSolutionReplayBatchStatus } = useEventsActions();
  const { canEditCurrentGame, showLive } = useGameContext();
  const { manualDrawboardCapture } = useGameRuntimeConfig();
  const { setModelActions } = useArtboardActionBar();
  const captureNav = useOptionalDrawboardNavbarCapture();
  const [solutionCaptureBusy, setSolutionCaptureBusy] = useState(false);
  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);

  const usePerStepSolutionKeys = runtime.sequenceLength > 0;
  const solutionUrl = solution.currentImageUrl;
  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  const shouldForceHiddenCaptureRemount = usePerStepSolutionKeys
    && !showLive
    && !canEditCurrentGame;
  const solutionFrameInstanceKey = shouldForceHiddenCaptureRemount
    ? `solution-${scenario.scenarioId}-${solution.stepId ?? "none"}`
    : undefined;

  const prevSolutionFrameKeyRef = useRef(solutionFrameInstanceKey);
  useEffect(() => {
    if (
      shouldForceHiddenCaptureRemount
      && prevSolutionFrameKeyRef.current
      && prevSolutionFrameKeyRef.current !== solutionFrameInstanceKey
    ) {
      clearStoredSolutionSide(runtimeKey);
    }
    prevSolutionFrameKeyRef.current = solutionFrameInstanceKey;
  }, [runtimeKey, shouldForceHiddenCaptureRemount, solutionFrameInstanceKey]);

  const prevMountedSolutionFrameRef = useRef(solution.mountFrame);
  useEffect(() => {
    const prev = prevMountedSolutionFrameRef.current;
    if (prev && !solution.mountFrame && !canEditCurrentGame) {
      announceLiveSolutionFrameRemoved(scenario.scenarioId);
    }
    prevMountedSolutionFrameRef.current = solution.mountFrame;
  }, [canEditCurrentGame, scenario.scenarioId, solution.mountFrame]);

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
  const handleSolutionDataUrl = useCallback((dataUrl: string) => {
    if (solution.replayBatchRequest || activeRunId != null || autoReplayRunning) {
      return;
    }
    commitSolutionCapture({
      url: dataUrl,
      persistPerStep: usePerStepSolutionKeys,
    });
  }, [
    commitSolutionCapture,
    activeRunId,
    autoReplayRunning,
    solution.replayBatchRequest,
    usePerStepSolutionKeys,
  ]);

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
      mountFrame={solution.mountFrame}
      replayBatchRequest={solution.replayBatchRequest}
      viewportPointerEvents={showLive && !canEditCurrentGame ? "none" : "auto"}
      frameConfig={{
        key: solutionFrameInstanceKey,
        ref: bindSolutionFrame,
        name: "solutionUrl",
        events: solution.interactionTriggers,
        newCss: solutionCss,
        newHtml: solutionHtml,
        newJs: `${solutionJs}\n${scenario.js}`,
        hiddenFromView: solution.hiddenFromView,
        autoCapture: showLive,
        interactive: showLive,
        isCreator: canEditCurrentGame,
        onCaptureBusyChange: handleSolutionCaptureBusy,
        onDataUrl: handleSolutionDataUrl,
        replaySequence: solution.replaySequence,
        forceEmptyReplaySequence: solution.forceEmptyReplaySequence,
        suppressHeavyLayoutEffects,
        selectedReplayStepId: usePerStepSolutionKeys ? solution.stepId : null,
        onJsError: handleJsError,
        onReplayBatchCheckpoint: handleSolutionReplayBatchCheckpoint,
        onReplayBatchStatus: handleSolutionReplayBatchStatus,
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
      showLoadingOverlay={solution.showLoading && !hasSolutionCapture}
      loadingMessage="Preparing reference…"
    />
  );
};
