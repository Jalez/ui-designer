'use client';

import { BoardContainer } from "./BoardContainer";
import { Board } from "./Board";
import { ArtContainer } from "./ArtContainer";
import { Frame, type FrameHandle, type FrameJsError } from "./Frame";
import { FrameJsErrorOverlay } from "./FrameJsErrorOverlay";
import { SlideShower } from "./Drawboard/ImageContainer/SlideShower";
import { Spinner } from "@/components/General/Spinner/Spinner";
import { cn } from "@/lib/utils/cn";
import { useEventRecorderContext } from "@/events/components/EventRecorderContext";
import { Loader2 } from "lucide-react";
import type { scenario } from "@/types";
import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

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
  ref?: (instance: FrameHandle | null) => void;
  replaySequence?: React.ComponentProps<typeof Frame>["replaySequence"];
  selectedReplayStepId?: string | null;
  sessionStepCaptureCacheKey?: string | null;
  suppressHeavyLayoutEffects?: boolean;
};

type ScenarioFrameReplayBatchRequest = {
  enabled?: boolean;
  replaySequence: React.ComponentProps<typeof Frame>["replaySequence"];
  runId: number;
  visibleStepIds: string[];
};

type ScenarioFrameBoardProps = {
  allowRecording?: boolean;
  allowScaling?: boolean;
  captureBusyLabel?: string;
  frameConfig?: ScenarioFrameBoardFrameConfig | null;
  frameId?: string;
  jsError?: FrameJsError | null;
  loadingMessage?: string | null;
  mountFrame?: boolean;
  replayBatchRequest?: ScenarioFrameReplayBatchRequest | null;
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
  allowRecording = false,
  allowScaling = false,
  captureBusyLabel = "Generating picture",
  frameConfig = null,
  frameId = "DrawBoard",
  jsError = null,
  loadingMessage = null,
  mountFrame = true,
  replayBatchRequest = null,
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
  const { isSequenceRecording } = useEventRecorderContext();
  const frameHandleRef = useRef<FrameHandle | null>(null);
  const requestedReplayRunIdRef = useRef<number | null>(null);
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
  const frameRef = frameConfig?.ref;
  const frameReplaySequence = frameConfig?.replaySequence;
  const frameSelectedReplayStepId = frameConfig?.selectedReplayStepId;
  const frameSessionStepCaptureCacheKey = frameConfig?.sessionStepCaptureCacheKey;
  const frameSuppressHeavyLayoutEffects = frameConfig?.suppressHeavyLayoutEffects;
  const recordingSequenceEnabled = allowRecording && isSequenceRecording;
  const replayBatchEnabled = replayBatchRequest?.enabled ?? true;
  const shouldMountFrame = mountFrame || recordingSequenceEnabled || Boolean(replayBatchRequest && replayBatchEnabled);

  const setFrameHandle = useCallback((instance: FrameHandle | null) => {
    frameHandleRef.current = instance;
    frameRef?.(instance);
  }, [frameRef]);

  useEffect(() => {
    const currentRunId = requestedReplayRunIdRef.current;
    if (!replayBatchRequest || !replayBatchEnabled) {
      if (currentRunId != null) {
        frameHandleRef.current?.cancelReplayBatch(currentRunId);
      }
      requestedReplayRunIdRef.current = null;
      return;
    }
    if (!frameHandleRef.current) {
      return;
    }
    if (currentRunId === replayBatchRequest.runId) {
      return;
    }
    if (currentRunId != null) {
      frameHandleRef.current.cancelReplayBatch(currentRunId);
    }
    requestedReplayRunIdRef.current = replayBatchRequest.runId;
    frameHandleRef.current.requestReplayBatch({
      replaySequence: replayBatchRequest.replaySequence,
      runId: replayBatchRequest.runId,
      visibleStepIds: replayBatchRequest.visibleStepIds,
    });
  }, [replayBatchEnabled, replayBatchRequest]);

  useEffect(() => () => {
    if (requestedReplayRunIdRef.current != null) {
      frameHandleRef.current?.cancelReplayBatch(requestedReplayRunIdRef.current);
    }
  }, []);

  const surface = (
    <div
      className={cn("relative overflow-hidden", surfaceClassName)}
      style={{
        width: scenario.dimensions.width,
        height: scenario.dimensions.height,
        pointerEvents: viewportPointerEvents,
      }}
    >
      {shouldMountFrame && frameConfig ? (
        <Frame
          key={frameKey}
          ref={setFrameHandle}
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
          recordingSequence={recordingSequenceEnabled}
          persistRecordedSequenceStep={recordingSequenceEnabled}
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
