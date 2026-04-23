/** @format */
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { dataUrlFromRawRgba, imageDataFromRawRgba } from "@/lib/utils/drawboardSnapshot";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import type { EventSequenceStep, InteractionTrigger, VerifiedInteraction } from "@/types";

type PendingReplayBatchRequest = {
  replaySequence: EventSequenceStep[];
  runId: number;
  visibleStepIds: string[];
};

export type FrameJsError = {
  message: string;
  lineno: number;
  colno: number;
};

export type FrameRuntimeWarning = {
  type: "form-submit-without-prevent-default";
  message: string;
};

export type FrameReplayStatusEvent = {
  index: number | null;
  reason: string | null;
  selector: string | null;
  signature: string;
  status: "run-started" | "step-started" | "step-completed" | "step-skipped" | "run-completed";
  stepId: string | null;
  totalSteps: number;
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
  height: number;
  id: string;
  interactive?: boolean;
  isCreator?: boolean;
  name: string;
  frameUrl?: string;
  scenarioId: string;
  width: number;
  hiddenFromView?: boolean;
  autoCapture?: boolean;
  onCaptureBusyChange?: (busy: boolean) => void;
  recordingSequence?: boolean;
  onVerifiedInteraction?: (interaction: VerifiedInteraction) => void;
  onRecordedSequenceStep?: (step: EventSequenceStep) => void;
  onDataUrl?: (dataUrl: string) => void;
  replaySequence?: EventSequenceStep[];
  forceEmptyReplaySequence?: boolean;
  suppressHeavyLayoutEffects?: boolean;
  dataTestId?: string;
  selectedReplayStepId?: string | null;
  onJsError?: (error: FrameJsError | null) => void;
  onRuntimeWarning?: (warning: FrameRuntimeWarning) => void;
  onReplayBatchCheckpoint?: (checkpoint: ReplayBatchCheckpoint) => void;
  onReplayBatchStatus?: (event: ReplayBatchStatusEvent) => void;
  onReplayStatus?: (event: FrameReplayStatusEvent) => void;
}

export const Frame = forwardRef<FrameHandle, FrameProps>(function Frame(
  {
    id,
    newHtml,
    newCss,
    newJs,
    name,
    events,
    height,
    interactive = false,
    isCreator = false,
    scenarioId,
    width,
    frameUrl = process.env.NEXT_PUBLIC_DRAWBOARD_URL || "http://localhost:3500",
    hiddenFromView = false,
    autoCapture = true,
    onCaptureBusyChange,
    recordingSequence = false,
    onVerifiedInteraction,
    onRecordedSequenceStep,
    onDataUrl,
    replaySequence = [],
    forceEmptyReplaySequence = false,
    suppressHeavyLayoutEffects = false,
    dataTestId,
    selectedReplayStepId = null,
    onJsError,
    onRuntimeWarning,
    onReplayBatchCheckpoint,
    onReplayBatchStatus,
    onReplayStatus,
  },
  ref,
) {
  const shouldDebugReplayStart = process.env.NODE_ENV !== "production";
  const { manualDrawboardCapture, drawboardReloadDebounceMs } = useGameRuntimeConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoadGeneration, setIframeLoadGeneration] = useState(0);
  const iframeReloadDebounceRef = useRef<number | null>(null);
  const hasSkippedInitialReloadRef = useRef(false);
  const iframeMountedRef = useRef(false);
  const pendingReplayBatchRef = useRef<PendingReplayBatchRequest | null>(null);
  const outboundReplaySequence = useMemo(
    () => (forceEmptyReplaySequence ? [] : replaySequence),
    [forceEmptyReplaySequence, replaySequence],
  );

  const notifyCaptureBusy = useCallback(
    (busy: boolean) => {
      onCaptureBusyChange?.(busy);
    },
    [onCaptureBusyChange],
  );

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
        scenarioId,
        visibleStepIds: pending.visibleStepIds,
      },
      "*",
    );
  }, [name, notifyCaptureBusy, scenarioId]);

  useImperativeHandle(
    ref,
    () => ({
      requestCapture: () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) {
          return;
        }
        notifyCaptureBusy(true);
        win.postMessage(
          {
            message: "request-capture",
            name,
            scenarioId,
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
            scenarioId,
          },
          "*",
        );
      },
    }),
    [flushPendingReplayBatch, name, notifyCaptureBusy, scenarioId],
  );

  const lastMountedHandshakeWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const handleFrameMessage = (event: MessageEvent) => {
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
          return;
        }
        lastMountedHandshakeWindowRef.current = childWin;
        iframeMountedRef.current = true;
        if (shouldDebugReplayStart && outboundReplaySequence.length > 0) {
          console.log("[frame:mounted-payload]", {
            name,
            scenarioId,
            hiddenFromView,
            interactive,
            autoCapture,
            recordingSequence,
            replaySequenceIds: outboundReplaySequence.map((step) => step.id),
          });
        }
        childWin.postMessage(
          {
            html: newHtml,
            css: newCss,
            js: newJs,
            events: JSON.stringify(events),
            scenarioId,
            name,
            interactive,
            isCreator,
            autoCapture,
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
        && event.data?.scenarioId === scenarioId
        && event.data?.message === "unhandled-form-submit-detected"
      ) {
        const action = typeof event.data?.action === "string" ? event.data.action : "";
        onRuntimeWarning?.({
          type: "form-submit-without-prevent-default",
          message: action
            ? `Submit was prevented by the drawboard safety guard (action: ${action || "default"}). Add event.preventDefault() in your own submit handler to remove this warning.`
            : "Submit was prevented by the drawboard safety guard. Add event.preventDefault() in your own submit handler to remove this warning.",
        });
      }
    };

    window.addEventListener("message", handleFrameMessage);
    return () => {
      window.removeEventListener("message", handleFrameMessage);
    };
  }, [
    events,
    flushPendingReplayBatch,
    hiddenFromView,
    interactive,
    isCreator,
    autoCapture,
    name,
    newCss,
    newHtml,
    newJs,
    onRuntimeWarning,
    outboundReplaySequence,
    recordingSequence,
    scenarioId,
    shouldDebugReplayStart,
  ]);

  useEffect(() => {
    if (!onVerifiedInteraction) {
      return;
    }
    const handleVerifiedInteraction = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.message !== "verified-interaction") {
        return;
      }
      if (event.data?.urlName !== name || event.data?.scenarioId !== scenarioId) {
        return;
      }

      const interaction = event.data?.interaction as VerifiedInteraction | undefined;
      if (!interaction?.id) {
        return;
      }

      onVerifiedInteraction(interaction);
    };

    window.addEventListener("message", handleVerifiedInteraction);
    return () => {
      window.removeEventListener("message", handleVerifiedInteraction);
    };
  }, [name, onVerifiedInteraction, scenarioId]);

  useEffect(() => {
    if (!onRecordedSequenceStep) {
      return;
    }
    const handleRecordedSequenceStep = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.message !== "recorded-event-sequence-step") {
        return;
      }
      if (event.data?.urlName !== name || event.data?.scenarioId !== scenarioId) {
        return;
      }

      const step = event.data?.step as EventSequenceStep | undefined;
      if (!step?.id) {
        return;
      }

      onRecordedSequenceStep(step);
    };

    window.addEventListener("message", handleRecordedSequenceStep);
    return () => {
      window.removeEventListener("message", handleRecordedSequenceStep);
    };
  }, [name, onRecordedSequenceStep, scenarioId]);

  useEffect(() => {
    if (!onDataUrl) {
      return;
    }
    const handleDisplayUrlFromIframe = (event: MessageEvent) => {
      if (event.data?.message !== "data" || typeof event.data?.dataURL !== "string") {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenarioId) {
        return;
      }

      onDataUrl(event.data.dataURL);
      notifyCaptureBusy(false);
    };

    window.addEventListener("message", handleDisplayUrlFromIframe);
    return () => {
      window.removeEventListener("message", handleDisplayUrlFromIframe);
    };
  }, [name, notifyCaptureBusy, onDataUrl, scenarioId]);

  useEffect(() => {
    const onPixels = (event: MessageEvent) => {
      if (event.data?.message !== "pixels") {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenarioId) {
        return;
      }
      notifyCaptureBusy(false);
    };
    window.addEventListener("message", onPixels);
    return () => {
      window.removeEventListener("message", onPixels);
    };
  }, [name, notifyCaptureBusy, scenarioId]);

  useEffect(() => {
    if (!onJsError) {
      return;
    }
    const handleJsErrorMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenarioId) {
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
  }, [name, onJsError, scenarioId]);

  const lastPostedOptionsPatchKeyRef = useRef<string | null>(null);
  const optionsPatchScenarioIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (optionsPatchScenarioIdRef.current !== scenarioId) {
      optionsPatchScenarioIdRef.current = scenarioId;
      lastPostedOptionsPatchKeyRef.current = null;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return;
    }
    const key = `${interactive}:${isCreator}:${autoCapture}:${recordingSequence}:${selectedReplayStepId ?? ""}:${JSON.stringify(events)}:${JSON.stringify(outboundReplaySequence.map((step) => step.id))}`;
    if (lastPostedOptionsPatchKeyRef.current === key) {
      return;
    }
    lastPostedOptionsPatchKeyRef.current = key;
    if (shouldDebugReplayStart && outboundReplaySequence.length > 0) {
      console.log("[frame:options-patch]", {
        name,
        scenarioId,
        hiddenFromView,
        interactive,
        autoCapture,
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
        scenarioId,
        interactive,
        isCreator,
        autoCapture,
        recordingSequence,
        selectedReplayStepId,
        events: JSON.stringify(events),
        replaySequence: outboundReplaySequence,
      },
      "*",
    );
  }, [
    events,
    hiddenFromView,
    iframeLoadGeneration,
    interactive,
    isCreator,
    autoCapture,
    name,
    outboundReplaySequence,
    recordingSequence,
    scenarioId,
    selectedReplayStepId,
    shouldDebugReplayStart,
  ]);

  useEffect(() => {
    const handleReplayBatchStatus = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenarioId) {
        return;
      }
      if (event.data?.message !== "event-sequence-replay-batch-status") {
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

    const handleReplayBatchCheckpoint = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenarioId) {
        return;
      }
      if (event.data?.message !== "event-sequence-replay-batch-checkpoint") {
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

        if (event.data?.pixels instanceof ArrayBuffer) {
          const nextWidth = typeof event.data?.width === "number" ? event.data.width : width;
          const nextHeight = typeof event.data?.height === "number" ? event.data.height : height;
          imageData = imageDataFromRawRgba(event.data.pixels, nextWidth, nextHeight);
          dataUrl = typeof event.data?.dataUrl === "string" && event.data.dataUrl
            ? event.data.dataUrl
            : dataUrlFromRawRgba(event.data.pixels, nextWidth, nextHeight);
          onReplayBatchCheckpoint?.({
            dataUrl,
            height: nextHeight,
            imageData,
            replaySignature,
            runId,
            stepId,
            width: nextWidth,
          });
        }
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
    height,
    name,
    notifyCaptureBusy,
    onReplayBatchCheckpoint,
    onReplayBatchStatus,
    scenarioId,
    width,
  ]);

  useEffect(() => {
    if (!onReplayStatus) {
      return;
    }
    const handleReplayStatus = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.name !== name || event.data?.scenarioId !== scenarioId) {
        return;
      }
      if (event.data?.message !== "event-sequence-replay-status") {
        return;
      }

      const status = event.data?.status;
      if (
        status !== "run-started"
        && status !== "step-started"
        && status !== "step-completed"
        && status !== "step-skipped"
        && status !== "run-completed"
      ) {
        return;
      }

      onReplayStatus({
        index: typeof event.data?.index === "number" ? event.data.index : null,
        reason: typeof event.data?.reason === "string" ? event.data.reason : null,
        selector: typeof event.data?.selector === "string" ? event.data.selector : null,
        signature: typeof event.data?.signature === "string" ? event.data.signature : "",
        status,
        stepId: typeof event.data?.stepId === "string" ? event.data.stepId : null,
        totalSteps: typeof event.data?.totalSteps === "number" ? event.data.totalSteps : 0,
      });
    };

    window.addEventListener("message", handleReplayStatus);
    return () => {
      window.removeEventListener("message", handleReplayStatus);
    };
  }, [name, onReplayStatus, scenarioId]);

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
      if (iframeRef.current) {
        iframeMountedRef.current = false;
        lastMountedHandshakeWindowRef.current = null;
        iframeRef.current.contentWindow?.postMessage(
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
    drawboardReloadDebounceMs,
    name,
    newCss,
    newHtml,
    newJs,
    suppressHeavyLayoutEffects,
  ]);

  if (suppressHeavyLayoutEffects) {
    return null;
  }

  const iframeSearch = new URLSearchParams({
    name,
    scenarioId,
    width: String(width),
    height: String(height),
    captureMode: "browser",
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
        setIframeLoadGeneration((generation) => generation + 1);
      }}
      width={width}
      height={height}
      className={cn(
        "overflow-hidden m-0 p-0 border-none bg-secondary absolute top-0 left-0 z-0 transition-[opacity] duration-300 ease-in-out",
        hiddenFromView && "pointer-events-none",
        hiddenFromView && "opacity-0",
      )}
      aria-hidden={hiddenFromView}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        visibility: "visible",
      }}
    />
  );
});

Frame.displayName = "Frame";
