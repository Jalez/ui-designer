'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { Image } from "@/components/General/Image/Image";
import { ScenarioDimensions } from "@/components/ArtBoards/Drawboard/ScenarioDimensions";
import { ScenarioFrameBoard } from "@/components/ArtBoards/ScenarioFrameBoard";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { useArtboardActionBar } from "@/components/ArtBoards/ArtboardActionBarContext";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { Button } from "@/components/ui/button";
import PoppingTitle from "@/components/General/PoppingTitle";
import { Camera } from "lucide-react";
import type { FrameHandle, FrameJsError, FrameRuntimeWarning } from "@/components/ArtBoards/Frame";
import type { scenario } from "@/types";

type EventsBoundScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
};

function CaptureButton({
  busy,
  drawingFrameRef,
  title,
}: {
  busy: boolean;
  drawingFrameRef: React.RefObject<FrameHandle | null>;
  title: string;
}) {
  return (
    <PoppingTitle topTitle={title}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85"
        disabled={busy}
        aria-label={title}
        onClick={() => drawingFrameRef.current?.requestCapture()}
      >
        <Camera className="h-5 w-5" />
      </Button>
    </PoppingTitle>
  );
}

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
  const {
    isCreator,
    solutionUrl,
    drawingBoard,
    frameEvents,
    onVerifiedInteraction,
    runtime,
    sessionStepCaptureCacheKey,
  } = useArtboardContext();
  const drawingReplayBatchCheckpoint = drawingBoard.onReplayBatchCheckpoint;
  const drawingReplayBatchStatus = drawingBoard.onReplayBatchStatus;
  const drawingCurrentStepId = drawingBoard.currentStepId;
  const drawingArtifactDescriptor = drawingBoard.artifactDescriptor;
  const drawingCurrentImageUrl = drawingBoard.currentImageUrl;
  const drawingReplayBatchVisibleStepIds = drawingBoard.replayBatchVisibleStepIds;
  const drawingReplaySequence = drawingBoard.replaySequence;
  const drawingForceEmptyReplaySequence = drawingBoard.forceEmptyReplaySequence;
  const drawingReplayRunId = runtime.activeRunId;
  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const drawingFrameRef = useRef<FrameHandle | null>(null);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const [dimensionsSelectOpen, setDimensionsSelectOpen] = useState(false);
  const [editDimensions, setEditDimensions] = useState(false);
  const runtimeWarningTimeoutRef = useRef<number | null>(null);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { manualDrawboardCapture } = useGameRuntimeConfig();
  const { setDrawingActions } = useArtboardActionBar();

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
      if (runtimeWarningTimeoutRef.current) {
        window.clearTimeout(runtimeWarningTimeoutRef.current);
        runtimeWarningTimeoutRef.current = null;
      }
    };
  }, [captureNav, registerForNavbarCapture]);

  const captureTitle = isCreator && !showLive
    ? "Capture picture from your design"
    : "Capture picture from your preview";
  const showCaptureButton = manualDrawboardCapture && (interactive || isCreator);
  const showDimensionsControl = isCreator;

  useEffect(() => {
    if (!showCaptureButton && !showDimensionsControl) {
      setDrawingActions(null);
      return;
    }

    setDrawingActions(
      <>
        {showDimensionsControl ? (
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
          <CaptureButton
            busy={drawingCaptureBusy}
            drawingFrameRef={drawingFrameRef}
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
    scenario,
    setDrawingActions,
    showCaptureButton,
    showDimensionsControl,
  ]);

  if (!level) {
    return null;
  }

  const hiddenFromView = isCreator
    ? !showLive
    : !interactive && !showLive;
  const showStaticImage = isCreator
    ? !showLive
    : !interactive && !showLive;

  return (
    <ScenarioFrameBoard
      scenario={scenario}
      allowScaling={allowScaling}
      allowRecording
      replayBatchRequest={drawingReplayRunId != null && drawingReplayBatchVisibleStepIds.length > 0
        ? {
          enabled: true,
          replaySequence: drawingReplaySequence,
          runId: drawingReplayRunId,
          visibleStepIds: drawingReplayBatchVisibleStepIds,
        }
        : null}
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
        events: frameEvents,
        newCss: css,
        newHtml: html,
        newJs: `${js}\n${scenario.js}`,
        hiddenFromView,
        onCaptureBusyChange: handleDrawingCaptureBusy,
        interactiveOverride: showLive,
        replaySequence: drawingReplaySequence,
        forceEmptyReplaySequence: drawingForceEmptyReplaySequence,
        suppressHeavyLayoutEffects,
        dataTestId: isCreator && !suppressHeavyLayoutEffects ? "creator-template-drawboard-frame" : undefined,
        onVerifiedInteraction,
        artifactCache: drawingArtifactDescriptor,
        selectedReplayStepId: drawingCurrentStepId,
        onJsError: handleJsError,
        onRuntimeWarning: handleRuntimeWarning,
        onReplayBatchCheckpoint: drawingReplayBatchCheckpoint,
        onReplayBatchStatus: drawingReplayBatchStatus,
        sessionStepCaptureCacheKey,
      }}
      surfaceContent={showStaticImage ? (
        <Image
          name="drawing"
          imageUrl={drawingCurrentImageUrl}
          alt={isCreator ? "Creator static preview" : "Player static preview"}
          height={scenario.dimensions.height}
          width={scenario.dimensions.width}
          loadingMessage="Loading your design…"
        />
      ) : null}
      jsError={jsError}
      showJsErrorOverlay={showStaticImage}
      showCaptureBusyOverlay={drawingCaptureBusy && (!isCreator || showLive)}
      runtimeWarning={runtimeWarning}
    />
  );
};
