'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { Image } from "@/components/General/Image/Image";
import { ScenarioDimensions } from "@/components/ArtBoards/Drawboard/ScenarioDimensions";
import { ScenarioFrameBoard } from "@/components/ArtBoards/ScenarioFrameBoard";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { useArtboardActionBar } from "@/components/ArtBoards/ArtboardActionBarContext";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import { useEventRecorderContext } from "@/events/components/EventRecorderContext";
import { useEventsActions } from "@/events/components/EventsContext";
import { showDrawboardRuntimeWarning } from "@/events/components/showDrawboardRuntimeWarning";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import type { FrameDataUrlMeta, FrameHandle, FrameJsError, FrameRuntimeWarning } from "@/components/ArtBoards/Frame";

import type { VerifiedInteraction, scenario } from "@/types";
import { ManualCaptureButton } from "@/components/General/ManualCaptureButton";

type EventsBoundScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
};

export const EventsBoundScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
}: EventsBoundScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const interactive = level?.interactive ?? false;
  const { showLive } = useGameContext();
  const { drawing, isCreator, solutionUrl, runtime } = useArtboardContext();
  const { activeRunId, autoReplayRunning } = runtime;
  const {
    commitDrawingCapture,
    handleDrawingReplayBatchCheckpoint,
    handleDrawingReplayBatchStatus,
    handleDrawingReplayStatus,
    handleVerifiedInteraction: handleRuntimeVerifiedInteraction,
  } = useEventsActions();
  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const drawingFrameRef = useRef<FrameHandle | null>(null);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);
  const [dimensionsSelectOpen, setDimensionsSelectOpen] = useState(false);
  const [editDimensions, setEditDimensions] = useState(false);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { manualDrawboardCapture } = useGameRuntimeConfig();
  const { setDrawingActions } = useArtboardActionBar();
  const { isSequenceRecording } = useEventRecorderContext();
  const handleJsError = useCallback((error: FrameJsError | null) => setJsError(error), []);
  const handleDrawingDataUrl = useCallback((dataUrl: string, meta: FrameDataUrlMeta) => {
    if (drawing.replayBatchRequest || activeRunId != null || autoReplayRunning) {
      return;
    }
    commitDrawingCapture({
      stepId: meta.stepId,
      url: dataUrl,
      persistScenarioUrl: true,
    });
  }, [activeRunId, autoReplayRunning, commitDrawingCapture, drawing.replayBatchRequest]);
  const handleVerifiedInteraction = useCallback((interaction: VerifiedInteraction) => {
    handleRuntimeVerifiedInteraction(interaction);
  }, [handleRuntimeVerifiedInteraction]);
  const handleRuntimeWarning = useCallback((warning: FrameRuntimeWarning) => {
    showDrawboardRuntimeWarning(scenario.scenarioId, warning);
  }, [scenario.scenarioId]);

  const bindDrawingFrame = useCallback((instance: FrameHandle | null) => {
    if (drawingFrameRef.current === instance) {
      return;
    }
    drawingFrameRef.current = instance;
    if (registerForNavbarCapture) {
      captureNav?.registerDrawingFrame(instance);
    }
  }, [captureNav, registerForNavbarCapture]);

  const handleDrawingCaptureBusy = useCallback((busy: boolean) => {
    setDrawingCaptureBusy(busy);
    if (registerForNavbarCapture) {
      captureNav?.notifyDrawingBusy(busy);
    }
  }, [captureNav, registerForNavbarCapture]);

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(null);
      }
    };
  }, [captureNav, registerForNavbarCapture]);

  const captureTitle = isCreator && !showLive
    ? "Capture picture from your design"
    : "Capture picture from your preview";
  const showCaptureButton = manualDrawboardCapture && (interactive || isCreator);

  useEffect(() => {
    setDrawingActions(
      <>
        {isCreator ? (
          <div className="flex h-9 items-center rounded-full bg-muted px-3 py-0 text-foreground shadow-sm">
            <ScenarioDimensions
              scenario={scenario}
              showDimensions
              setShowDimensions={() => {}}
              selectOpen={dimensionsSelectOpen}
              setSelectOpen={setDimensionsSelectOpen}
              editDimensions={editDimensions}
              setEditDimensions={setEditDimensions}
            />
          </div>
        ) : null}
        {showCaptureButton ? (
          <ManualCaptureButton
            busy={drawingCaptureBusy}
            frameRef={drawingFrameRef}
            title={captureTitle}
          />
        ) : null}
      </>,
    );

    return () => {
      setDrawingActions(null);
    };
  }, [
    captureTitle,
    dimensionsSelectOpen,
    drawingCaptureBusy,
    editDimensions,
    isCreator,
    scenario,
    setDrawingActions,
    showCaptureButton,
  ]);

  return (
    <ScenarioFrameBoard
      scenario={scenario}
      allowScaling={allowScaling}
      disabledInteractionNotice={
        isSequenceRecording
          ? "Interaction disabled. Event recording happens in the solution board."
          : null
      }
      viewportPointerEvents={isSequenceRecording ? "none" : "auto"}
      replayBatchRequest={drawing.replayBatchRequest}
      slideShow={{
        showStatic: !interactive && !isCreator,
        staticComponent: (
          <Image
            imageUrl={solutionUrl}
            alt="Reference image"
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            loadingMessage="Loading reference image…"
          />
        ),
      }}
      frameConfig={{
        ref: bindDrawingFrame,
        name: "drawingUrl",
        events: drawing.interactionTriggers,
        newCss: css,
        newHtml: html,
        newJs: `${js}\n${scenario.js}`,
        hiddenFromView: drawing.hiddenFromView,
        autoCapture: drawing.autoCapture,
        interactive: showLive || drawing.autoCapture,
        isCreator,
        onCaptureBusyChange: handleDrawingCaptureBusy,
        onDataUrl: handleDrawingDataUrl,
        replaySequence: drawing.replaySequence,
        replayRefreshNonce: drawing.replayRefreshNonce,
        forceEmptyReplaySequence: drawing.forceEmptyReplaySequence,
        suppressHeavyLayoutEffects,
        dataTestId: isCreator && !suppressHeavyLayoutEffects ? "creator-template-drawboard-frame" : undefined,
        onVerifiedInteraction: handleVerifiedInteraction,
        selectedReplayStepId: drawing.stepId,
        onJsError: handleJsError,
        onRuntimeWarning: handleRuntimeWarning,
        onReplayBatchCheckpoint: handleDrawingReplayBatchCheckpoint,
        onReplayBatchStatus: handleDrawingReplayBatchStatus,
        onReplayStatus: handleDrawingReplayStatus,
      }}
      surfaceContent={drawing.showStaticImage ? (
        <Image
          name="drawing"
          imageUrl={drawing.currentImageUrl}
          alt={isCreator ? "Creator static preview" : "Player static preview"}
          height={scenario.dimensions.height}
          width={scenario.dimensions.width}
          loadingMessage="Loading your design…"
        />
      ) : null}
      jsError={jsError}
      showJsErrorOverlay={drawing.showStaticImage}
      showCaptureBusyOverlay={drawingCaptureBusy && (!isCreator || showLive)}
    />
  );
};
