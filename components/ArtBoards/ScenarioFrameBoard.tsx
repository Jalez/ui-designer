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
import { logArtboardReplayDebug } from "@/events/core/artboardReplayRuntimeStore";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { scenario } from "@/types";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type ScenarioFrameBoardFrameConfig = {
  autoCapture?: React.ComponentProps<typeof Frame>["autoCapture"];
  dataTestId?: string;
  events: React.ComponentProps<typeof Frame>["events"];
  forceEmptyReplaySequence?: boolean;
  hiddenFromView?: boolean;
  interactive?: React.ComponentProps<typeof Frame>["interactive"];
  isCreator?: React.ComponentProps<typeof Frame>["isCreator"];
  key?: string;
  name: React.ComponentProps<typeof Frame>["name"];
  onDataUrl?: React.ComponentProps<typeof Frame>["onDataUrl"];
  newCss: string;
  newHtml: string;
  newJs: string;
  onCaptureBusyChange?: React.ComponentProps<typeof Frame>["onCaptureBusyChange"];
  onJsError?: React.ComponentProps<typeof Frame>["onJsError"];
  onRecordedSequenceStep?: React.ComponentProps<typeof Frame>["onRecordedSequenceStep"];
  onReplayBatchCheckpoint?: React.ComponentProps<typeof Frame>["onReplayBatchCheckpoint"];
  onReplayBatchStatus?: React.ComponentProps<typeof Frame>["onReplayBatchStatus"];
  onReplayStatus?: React.ComponentProps<typeof Frame>["onReplayStatus"];
  onRuntimeWarning?: React.ComponentProps<typeof Frame>["onRuntimeWarning"];
  onVerifiedInteraction?: React.ComponentProps<typeof Frame>["onVerifiedInteraction"];
  ref?: (instance: FrameHandle | null) => void;
  replayRefreshNonce?: React.ComponentProps<typeof Frame>["replayRefreshNonce"];
  replaySequence?: React.ComponentProps<typeof Frame>["replaySequence"];
  selectedReplayStepId?: string | null;
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
  disabledInteractionNotice?: ReactNode;
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
  disabledInteractionNotice = null,
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
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const frameHandleRef = useRef<FrameHandle | null>(null);
  const latestReplayBatchEnabledRef = useRef(false);
  const latestReplayBatchRequestRef = useRef<ScenarioFrameReplayBatchRequest | null>(null);
  const requestedReplayRunIdRef = useRef<number | null>(null);
  const frameDataTestId = frameConfig?.dataTestId;
  const frameAutoCapture = frameConfig?.autoCapture;
  const frameEvents = frameConfig?.events ?? [];
  const frameForceEmptyReplaySequence = frameConfig?.forceEmptyReplaySequence;
  const frameHiddenFromView = frameConfig?.hiddenFromView;
  const frameInteractive = frameConfig?.interactive;
  const frameIsCreator = frameConfig?.isCreator;
  const frameKey = frameConfig?.key;
  const frameName = frameConfig?.name ?? "drawingUrl";
  const frameOnDataUrl = frameConfig?.onDataUrl;
  const frameNewCss = frameConfig?.newCss ?? "";
  const frameNewHtml = frameConfig?.newHtml ?? "";
  const frameNewJs = frameConfig?.newJs ?? "";
  const frameOnCaptureBusyChange = frameConfig?.onCaptureBusyChange;
  const frameOnJsError = frameConfig?.onJsError;
  const frameOnRecordedSequenceStep = frameConfig?.onRecordedSequenceStep;
  const frameOnReplayBatchCheckpoint = frameConfig?.onReplayBatchCheckpoint;
  const frameOnReplayBatchStatus = frameConfig?.onReplayBatchStatus;
  const frameOnReplayStatus = frameConfig?.onReplayStatus;
  const frameOnRuntimeWarning = frameConfig?.onRuntimeWarning;
  const frameOnVerifiedInteraction = frameConfig?.onVerifiedInteraction;
  const frameRef = frameConfig?.ref;
  const frameReplayRefreshNonce = frameConfig?.replayRefreshNonce;
  const frameReplaySequence = frameConfig?.replaySequence;
  const frameSelectedReplayStepId = frameConfig?.selectedReplayStepId;
  const frameSuppressHeavyLayoutEffects = frameConfig?.suppressHeavyLayoutEffects;
  const recordingSequenceEnabled = allowRecording && isSequenceRecording;
  const replayBatchEnabled = replayBatchRequest?.enabled ?? true;
  const shouldMountFrame = mountFrame || recordingSequenceEnabled || Boolean(replayBatchRequest && replayBatchEnabled);

  useLayoutEffect(() => {
    latestReplayBatchEnabledRef.current = replayBatchEnabled;
    latestReplayBatchRequestRef.current = replayBatchRequest;
  }, [replayBatchEnabled, replayBatchRequest]);


  const requestReplayBatch = useCallback((instance: FrameHandle, request: ScenarioFrameReplayBatchRequest) => {
    requestedReplayRunIdRef.current = request.runId;

    instance.requestReplayBatch({
      replaySequence: request.replaySequence,
      runId: request.runId,
      visibleStepIds: request.visibleStepIds,
    });
  }, [frameName]);

  const setFrameHandle = useCallback((instance: FrameHandle | null) => {
    frameHandleRef.current = instance;
    frameRef?.(instance);

    if (instance) {
      window.requestAnimationFrame(() => {
        if (frameHandleRef.current !== instance) {
          return;
        }
        const request = latestReplayBatchRequestRef.current;
        if (
          request
          && latestReplayBatchEnabledRef.current
          && requestedReplayRunIdRef.current !== request.runId
        ) {
          requestReplayBatch(instance, request);
        }
      });
    }
  }, [frameName, frameRef, requestReplayBatch]);

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
    requestReplayBatch(frameHandleRef.current, replayBatchRequest);
  }, [frameName, replayBatchEnabled, replayBatchRequest, requestReplayBatch]);

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
        <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <div
              style={{
                position: "relative",
                width: scenario.dimensions.width,
                height: scenario.dimensions.height,
              }}
            >
              <Frame
                key={frameKey}
                ref={setFrameHandle}
                id={frameId}
                scenarioId={scenario.scenarioId}
                width={scenario.dimensions.width}
                height={scenario.dimensions.height}
                name={frameName}
                events={frameEvents}
                newCss={frameNewCss}
                newHtml={frameNewHtml}
                newJs={frameNewJs}
                hiddenFromView={frameHiddenFromView}
                autoCapture={frameAutoCapture}
                onCaptureBusyChange={frameOnCaptureBusyChange}
                interactive={frameInteractive}
                isCreator={frameIsCreator}
                recordingSequence={recordingSequenceEnabled}
                onRecordedSequenceStep={frameOnRecordedSequenceStep}
                onDataUrl={frameOnDataUrl}
                replayRefreshNonce={frameReplayRefreshNonce}
                replaySequence={frameReplaySequence}
                forceEmptyReplaySequence={frameForceEmptyReplaySequence}
                suppressHeavyLayoutEffects={frameSuppressHeavyLayoutEffects}
                dataTestId={frameDataTestId}
                selectedReplayStepId={frameSelectedReplayStepId}
                onJsError={frameOnJsError}
                onRuntimeWarning={frameOnRuntimeWarning}
                onReplayBatchCheckpoint={frameOnReplayBatchCheckpoint}
                onReplayBatchStatus={frameOnReplayBatchStatus}
                onReplayStatus={frameOnReplayStatus}
                onVerifiedInteraction={frameOnVerifiedInteraction}
                onHoverEnter={() => setTooltipOpen(true)}
                onHoverLeave={() => setTooltipOpen(false)}
              />
              {surfaceContent ? (
                <div className="relative z-[1] pointer-events-auto">{surfaceContent}</div>
              ) : null}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {frameName === "drawingUrl" ? "Drawing Board" : "Solution Board"}
          </TooltipContent>
        </Tooltip>
      ) : (
        surfaceContent ? (
          <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
            <TooltipTrigger asChild>
              <div
                style={{
                  position: "relative",
                  width: scenario.dimensions.width,
                  height: scenario.dimensions.height,
                }}
              >
                <div className="relative z-[1] pointer-events-auto">{surfaceContent}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {frameName === "drawingUrl" ? "Drawing Board" : "Solution Board"}
            </TooltipContent>
          </Tooltip>
        ) : null
      )}
      {disabledInteractionNotice ? (
        <div
          className="pointer-events-none absolute left-2 right-2 top-2 z-40 rounded-md border border-slate-300 bg-slate-950/85 px-3 py-2 text-center text-xs font-medium text-white shadow-sm"
          role="status"
          aria-live="polite"
        >
          {disabledInteractionNotice}
        </div>
      ) : null}
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
