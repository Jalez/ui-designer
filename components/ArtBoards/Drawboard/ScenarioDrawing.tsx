'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { Image } from "@/components/General/Image/Image";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import type { FrameJsError, FrameHandle } from "../Frame";
import type { FrameRuntimeWarning } from "../Frame";
import { FrameJsErrorOverlay } from "../FrameJsErrorOverlay";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { Button } from "@/components/ui/button";
import type { scenario } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { Camera, Loader2 } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { ScenarioDimensionsWrapper } from "./ScenarioDimensionsWrapper";
import { ScenarioHoverContainer } from "./ScenarioHoverContainer";
import { useScenarioDrawingContext } from "@/events/components/ScenarioDrawingContext";

export type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
};

type DrawingSurfaceProps = {
  bindDrawingFrame: (instance: FrameHandle | null) => void;
  css: string;
  drawingArtifactDescriptor: React.ComponentProps<typeof Frame>["artifactCache"];
  drawingCaptureBusy: boolean;
  drawingFrameRef: React.RefObject<FrameHandle | null>;
  effectiveDrawingUrl: string | undefined;
  forceEmptyReplaySequence: boolean;
  frameEvents: React.ComponentProps<typeof Frame>["events"];
  frameNeedsInteractive: boolean;
  handleDrawingCaptureBusy: (busy: boolean) => void;
  handleJsError: (error: FrameJsError | null) => void;
  handleRuntimeWarning: (warning: FrameRuntimeWarning) => void;
  html: string;
  interactive: boolean;
  isCreator: boolean;
  isSequenceRecording: boolean;
  js: string;
  jsError: FrameJsError | null;
  manualDrawboardCapture: boolean;
  onReplayBatchCheckpoint: React.ComponentProps<typeof Frame>["onReplayBatchCheckpoint"];
  onReplayBatchStatus: React.ComponentProps<typeof Frame>["onReplayBatchStatus"];
  onVerifiedInteraction: React.ComponentProps<typeof Frame>["onVerifiedInteraction"];
  replaySequence: React.ComponentProps<typeof Frame>["replaySequence"];
  runtimeWarning: string | null;
  scenario: scenario;
  sessionStepCaptureCacheKey: string;
  shouldShowInteractivePreview: boolean;
  suppressHeavyLayoutEffects: boolean;
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
        variant="secondary"
        className="h-7 w-7 bg-background/90 shadow-sm"
        disabled={busy}
        aria-label={title}
        onClick={() => drawingFrameRef.current?.requestCapture()}
      >
        <Camera className="h-4 w-4" />
      </Button>
    </PoppingTitle>
  );
}

function DrawingSurface({
  bindDrawingFrame,
  css,
  drawingArtifactDescriptor,
  drawingCaptureBusy,
  drawingFrameRef,
  effectiveDrawingUrl,
  forceEmptyReplaySequence,
  frameEvents,
  frameNeedsInteractive,
  handleDrawingCaptureBusy,
  handleJsError,
  handleRuntimeWarning,
  html,
  interactive,
  isCreator,
  isSequenceRecording,
  js,
  jsError,
  manualDrawboardCapture,
  onReplayBatchCheckpoint,
  onReplayBatchStatus,
  onVerifiedInteraction,
  replaySequence,
  runtimeWarning,
  scenario,
  sessionStepCaptureCacheKey,
  shouldShowInteractivePreview,
  suppressHeavyLayoutEffects,
}: DrawingSurfaceProps) {
  const hiddenFromView = isCreator
    ? !shouldShowInteractivePreview
    : !interactive && !frameNeedsInteractive;
  const showStaticImage = isCreator
    ? !shouldShowInteractivePreview
    : !interactive && !frameNeedsInteractive;
  const captureTitle = isCreator && !shouldShowInteractivePreview
    ? "Capture picture from your design"
    : "Capture picture from your preview";
  const showCaptureButton = manualDrawboardCapture && isCreator;

  return (
    <div
      className="overflow-hidden relative"
      style={{
        height: `${scenario.dimensions.height}px`,
        width: `${scenario.dimensions.width}px`,
      }}
    >
      <Frame
        ref={bindDrawingFrame}
        id="DrawBoard"
        events={frameEvents}
        newCss={css}
        newHtml={html}
        newJs={js + "\n" + scenario.js}
        scenario={scenario}
        name="drawingUrl"
        hiddenFromView={hiddenFromView}
        onCaptureBusyChange={handleDrawingCaptureBusy}
        interactiveOverride={frameNeedsInteractive}
        recordingSequence={isSequenceRecording}
        persistRecordedSequenceStep={isSequenceRecording}
        replaySequence={replaySequence}
        forceEmptyReplaySequence={forceEmptyReplaySequence}
        suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
        dataTestId={isCreator && !suppressHeavyLayoutEffects ? "creator-template-drawboard-frame" : undefined}
        onVerifiedInteraction={onVerifiedInteraction}
        artifactCache={drawingArtifactDescriptor}
        onJsError={handleJsError}
        onRuntimeWarning={handleRuntimeWarning}
        onReplayBatchCheckpoint={onReplayBatchCheckpoint}
        onReplayBatchStatus={onReplayBatchStatus}
        sessionStepCaptureCacheKey={sessionStepCaptureCacheKey}
      />
      {showStaticImage && (
        <div className="relative z-[1]">
          <Image
            name="drawing"
            imageUrl={effectiveDrawingUrl}
            alt={isCreator ? "Creator static preview" : "Player static preview"}
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            loadingMessage="Loading your design…"
          />
        </div>
      )}
      {showStaticImage && jsError && (
        <FrameJsErrorOverlay
          error={jsError}
          width={scenario.dimensions.width}
          height={scenario.dimensions.height}
        />
      )}
      {showCaptureButton && (
        <div className="absolute top-2 right-2 z-30">
          <CaptureButton
            busy={drawingCaptureBusy}
            drawingFrameRef={drawingFrameRef}
            title={captureTitle}
          />
        </div>
      )}
      {drawingCaptureBusy && (!isCreator || shouldShowInteractivePreview) && (
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
  );
}

export const ScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
}: ScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const interactive = level?.interactive ?? false;

  const {
    isCreator,
    solutionUrl,
    effectiveDrawingUrl,
    drawingArtifactDescriptor,
    sessionStepCaptureCacheKey,
    frameEvents,
    replaySequence,
    shouldShowInteractivePreview,
    frameNeedsInteractive,
    isSequenceRecording,
    autoReplayRunning,
    shouldBypassSelectedStepReplay,
    onFrameReady,
    onVerifiedInteraction,
    onReplayBatchCheckpoint,
    onReplayBatchStatus,
  } = useScenarioDrawingContext();

  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const drawingFrameRef = useRef<FrameHandle | null>(null);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const runtimeWarningTimeoutRef = useRef<number | null>(null);

  const captureNav = useOptionalDrawboardNavbarCapture();
  const { manualDrawboardCapture } = useGameRuntimeConfig();

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
    drawingFrameRef.current = instance;
    onFrameReady(instance);
    if (registerForNavbarCapture) {
      captureNav?.registerDrawingFrame(instance);
    }
  }, [captureNav, onFrameReady, registerForNavbarCapture]);

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

  if (!level) {
    return null;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        <Board>
          <ArtContainer>
            <div className="relative">
              {isCreator && (
                <ScenarioHoverContainer enabled={!shouldShowInteractivePreview}>
                  <div className="relative h-full w-full min-h-[1px]">
                    <ScenarioDimensionsWrapper
                      scenario={scenario}
                      levelId={currentLevel}
                      showDimensions
                      setShowDimensions={() => {}}
                    />
                  </div>
                </ScenarioHoverContainer>
              )}
              {!isCreator && manualDrawboardCapture && interactive && (
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                  <CaptureButton
                    busy={drawingCaptureBusy}
                    drawingFrameRef={drawingFrameRef}
                    title="Capture picture from your preview"
                  />
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
                  <DrawingSurface
                    bindDrawingFrame={bindDrawingFrame}
                    css={css}
                    drawingArtifactDescriptor={drawingArtifactDescriptor}
                    drawingCaptureBusy={drawingCaptureBusy}
                    drawingFrameRef={drawingFrameRef}
                    effectiveDrawingUrl={effectiveDrawingUrl}
                    forceEmptyReplaySequence={
                      isCreator
                        ? autoReplayRunning || shouldBypassSelectedStepReplay
                        : autoReplayRunning
                    }
                    frameEvents={frameEvents}
                    frameNeedsInteractive={frameNeedsInteractive}
                    handleDrawingCaptureBusy={handleDrawingCaptureBusy}
                    handleJsError={handleJsError}
                    handleRuntimeWarning={handleRuntimeWarning}
                    html={html}
                    interactive={interactive}
                    isCreator={isCreator}
                    isSequenceRecording={isSequenceRecording}
                    js={js}
                    jsError={jsError}
                    manualDrawboardCapture={manualDrawboardCapture}
                    onReplayBatchCheckpoint={onReplayBatchCheckpoint}
                    onReplayBatchStatus={onReplayBatchStatus}
                    onVerifiedInteraction={onVerifiedInteraction}
                    replaySequence={replaySequence}
                    runtimeWarning={runtimeWarning}
                    scenario={scenario}
                    sessionStepCaptureCacheKey={sessionStepCaptureCacheKey}
                    shouldShowInteractivePreview={shouldShowInteractivePreview}
                    suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
                  />
                }
              />
            </div>
          </ArtContainer>
        </Board>
      </BoardContainer>
    </div>
  );
};
