'use client';

import { BoardContainer } from "./BoardContainer";
import { Board } from "./Board";
import { ArtContainer } from "./ArtContainer";
import { Frame, type FrameHandle, type FrameJsError } from "./Frame";
import { FrameJsErrorOverlay } from "./FrameJsErrorOverlay";
import { SlideShower } from "./Drawboard/ImageContainer/SlideShower";
import { Spinner } from "@/components/General/Spinner/Spinner";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";
import type { scenario } from "@/types";
import type { CSSProperties, ReactNode, Ref } from "react";

type ScenarioFrameBoardFrameConfig = {
  artifactCache?: React.ComponentProps<typeof Frame>["artifactCache"];
  dataTestId?: string;
  eventSequenceSolutionStepId?: string | null;
  events: React.ComponentProps<typeof Frame>["events"];
  forceEmptyReplaySequence?: boolean;
  hiddenFromView?: boolean;
  interactiveOverride?: boolean;
  key?: string;
  name: React.ComponentProps<typeof Frame>["name"];
  newCss: string;
  newHtml: string;
  newJs: string;
  onCaptureBusyChange?: React.ComponentProps<typeof Frame>["onCaptureBusyChange"];
  onJsError?: React.ComponentProps<typeof Frame>["onJsError"];
  onReplayBatchCheckpoint?: React.ComponentProps<typeof Frame>["onReplayBatchCheckpoint"];
  onReplayBatchStatus?: React.ComponentProps<typeof Frame>["onReplayBatchStatus"];
  onRuntimeWarning?: React.ComponentProps<typeof Frame>["onRuntimeWarning"];
  onVerifiedInteraction?: React.ComponentProps<typeof Frame>["onVerifiedInteraction"];
  persistRecordedSequenceStep?: boolean;
  recordingSequence?: boolean;
  ref?: Ref<FrameHandle>;
  replaySequence?: React.ComponentProps<typeof Frame>["replaySequence"];
  selectedReplayStepId?: string | null;
  sessionStepCaptureCacheKey?: string | null;
  suppressHeavyLayoutEffects?: boolean;
};

type ScenarioFrameBoardProps = {
  allowScaling?: boolean;
  captureBusyLabel?: string;
  frameConfig?: ScenarioFrameBoardFrameConfig | null;
  frameId?: string;
  jsError?: FrameJsError | null;
  loadingMessage?: string | null;
  mountFrame?: boolean;
  scenario: scenario;
  showCaptureBusyOverlay?: boolean;
  showJsErrorOverlay?: boolean;
  showLoadingOverlay?: boolean;
  slideShow?: {
    showStatic: boolean;
    staticComponent: ReactNode;
  } | null;
  surfaceClassName?: string;
  surfaceContent?: ReactNode;
  viewportClassName?: string;
  viewportPointerEvents?: CSSProperties["pointerEvents"];
  runtimeWarning?: string | null;
};

export const ScenarioFrameBoard = ({
  allowScaling = false,
  captureBusyLabel = "Generating picture",
  frameConfig = null,
  frameId = "DrawBoard",
  jsError = null,
  loadingMessage = null,
  mountFrame = true,
  scenario,
  showCaptureBusyOverlay = false,
  showJsErrorOverlay = false,
  showLoadingOverlay = false,
  slideShow = null,
  surfaceClassName,
  surfaceContent,
  viewportClassName,
  viewportPointerEvents = "auto",
  runtimeWarning = null,
}: ScenarioFrameBoardProps): React.ReactNode => {
  const frameArtifactCache = frameConfig?.artifactCache;
  const frameDataTestId = frameConfig?.dataTestId;
  const frameEventSequenceSolutionStepId = frameConfig?.eventSequenceSolutionStepId;
  const frameEvents = frameConfig?.events ?? [];
  const frameForceEmptyReplaySequence = frameConfig?.forceEmptyReplaySequence;
  const frameHiddenFromView = frameConfig?.hiddenFromView;
  const frameInteractiveOverride = frameConfig?.interactiveOverride;
  const frameKey = frameConfig?.key;
  const frameName = frameConfig?.name ?? "drawingUrl";
  const frameNewCss = frameConfig?.newCss ?? "";
  const frameNewHtml = frameConfig?.newHtml ?? "";
  const frameNewJs = frameConfig?.newJs ?? "";
  const frameOnCaptureBusyChange = frameConfig?.onCaptureBusyChange;
  const frameOnJsError = frameConfig?.onJsError;
  const frameOnReplayBatchCheckpoint = frameConfig?.onReplayBatchCheckpoint;
  const frameOnReplayBatchStatus = frameConfig?.onReplayBatchStatus;
  const frameOnRuntimeWarning = frameConfig?.onRuntimeWarning;
  const frameOnVerifiedInteraction = frameConfig?.onVerifiedInteraction;
  const framePersistRecordedSequenceStep = frameConfig?.persistRecordedSequenceStep;
  const frameRecordingSequence = frameConfig?.recordingSequence;
  const frameRef = frameConfig?.ref;
  const frameReplaySequence = frameConfig?.replaySequence;
  const frameSelectedReplayStepId = frameConfig?.selectedReplayStepId;
  const frameSessionStepCaptureCacheKey = frameConfig?.sessionStepCaptureCacheKey;
  const frameSuppressHeavyLayoutEffects = frameConfig?.suppressHeavyLayoutEffects;

  const surface = (
    <div
      className={cn("relative overflow-hidden", surfaceClassName)}
      style={{
        width: scenario.dimensions.width,
        height: scenario.dimensions.height,
        pointerEvents: viewportPointerEvents,
      }}
    >
      {mountFrame && frameConfig ? (
        <Frame
          key={frameKey}
          ref={frameRef}
          id={frameId}
          scenario={scenario}
          name={frameName}
          events={frameEvents}
          newCss={frameNewCss}
          newHtml={frameNewHtml}
          newJs={frameNewJs}
          hiddenFromView={frameHiddenFromView}
          onCaptureBusyChange={frameOnCaptureBusyChange}
          interactiveOverride={frameInteractiveOverride}
          recordingSequence={frameRecordingSequence}
          persistRecordedSequenceStep={framePersistRecordedSequenceStep}
          replaySequence={frameReplaySequence}
          forceEmptyReplaySequence={frameForceEmptyReplaySequence}
          suppressHeavyLayoutEffects={frameSuppressHeavyLayoutEffects}
          dataTestId={frameDataTestId}
          eventSequenceSolutionStepId={frameEventSequenceSolutionStepId}
          selectedReplayStepId={frameSelectedReplayStepId}
          artifactCache={frameArtifactCache}
          onJsError={frameOnJsError}
          onRuntimeWarning={frameOnRuntimeWarning}
          onReplayBatchCheckpoint={frameOnReplayBatchCheckpoint}
          onReplayBatchStatus={frameOnReplayBatchStatus}
          onVerifiedInteraction={frameOnVerifiedInteraction}
          sessionStepCaptureCacheKey={frameSessionStepCaptureCacheKey}
        />
      ) : null}
      {surfaceContent ? <div className="relative z-[1]">{surfaceContent}</div> : null}
      {showJsErrorOverlay && jsError ? (
        <FrameJsErrorOverlay
          error={jsError}
          width={scenario.dimensions.width}
          height={scenario.dimensions.height}
        />
      ) : null}
      {showLoadingOverlay ? (
        <div
          className="absolute inset-0 z-[50] flex items-center justify-center bg-background"
          aria-busy
          aria-label={loadingMessage ?? "Loading"}
        >
          <Spinner
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            message={loadingMessage ?? "Loading…"}
          />
        </div>
      ) : null}
      {showCaptureBusyOverlay ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
          aria-busy
          aria-label={captureBusyLabel}
        >
          <Loader2 className={cn("h-8 w-8 animate-spin", showLoadingOverlay ? "text-background" : "text-muted-foreground")} />
        </div>
      ) : null}
      {runtimeWarning ? (
        <div
          className="absolute bottom-2 left-2 right-2 z-30 rounded-md border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm"
          role="status"
          aria-live="polite"
        >
          {runtimeWarning}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        <Board>
          <ArtContainer>
            <div className={cn("relative", viewportClassName)}>
              {slideShow ? (
                <SlideShower
                  sliderHeight={scenario.dimensions.height}
                  showStatic={slideShow.showStatic}
                  staticComponent={slideShow.staticComponent}
                  slidingComponent={surface}
                />
              ) : (
                surface
              )}
            </div>
          </ArtContainer>
        </Board>
      </BoardContainer>
    </div>
  );
};
