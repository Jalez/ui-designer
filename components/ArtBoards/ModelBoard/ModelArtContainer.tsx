/** @format */
"use client";

// ModelArtContainer.tsx
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { Frame, type FrameHandle, type ReplayBatchCheckpoint, type ReplayBatchStatusEvent } from "../Frame";
import type { FrameJsError } from "../Frame";
import { FrameJsErrorOverlay } from "../FrameJsErrorOverlay";
import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { DrawboardSnapshotPayload, EventSequenceStep, InteractionTrigger, scenario } from "@/types";
import { Spinner } from "@/components/General/Spinner/Spinner";
import { announceLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import { clearStoredSolutionSide } from "@/lib/drawboard/drawboardPixelsStore";
import type { DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";

const EMPTY_REPLAY_SEQUENCE: EventSequenceStep[] = [];

type ModelArtContainerProps = {
  children: React.ReactNode;
  scenario: scenario;
  showInteractivePreview?: boolean;
  frameNeedsInteractive?: boolean;
  frameRef?: Ref<FrameHandle>;
  onCaptureBusyChange?: (busy: boolean) => void;
  isCreator?: boolean;
  scenarioSequenceLength?: number;
  solutionUrl?: string;
  /**
   * Game + event sequence: timeline step id for the current reference (drives per-step Redux keys).
   * Omitted on creator route.
   */
  eventSequenceSolutionStepId?: string | null;
  /**
   * When false (SidebySideArt probes / hidden slides), do not mount a transient solution iframe so
   * only the visible artboard performs capture.
   */
  allowTransientSolutionIframe?: boolean;
  recordingSequence?: boolean;
  replaySequence?: EventSequenceStep[];
  forceEmptyReplaySequence?: boolean;
  interactionTriggers?: InteractionTrigger[];
  interactiveOverride?: boolean;
  snapshotOverride?: DrawboardSnapshotPayload | null;
  suppressHeavyLayoutEffects?: boolean;
  artifactCache?: DrawboardArtifactDescriptor;
  solutionArtifactLookupStatus?: "ready" | "loading" | "missing";
  onSolutionReplayBatchCheckpoint?: (checkpoint: ReplayBatchCheckpoint) => void;
  onSolutionReplayBatchStatus?: (event: ReplayBatchStatusEvent) => void;
};

export const ModelArtContainer = ({
  children,
  scenario,
  showInteractivePreview = false,
  frameNeedsInteractive = false,
  frameRef,
  onCaptureBusyChange,
  isCreator = true,
  scenarioSequenceLength = 0,
  solutionUrl = "",
  eventSequenceSolutionStepId = null,
  allowTransientSolutionIframe = true,
  recordingSequence = false,
  replaySequence = EMPTY_REPLAY_SEQUENCE,
  forceEmptyReplaySequence = false,
  interactionTriggers,
  interactiveOverride,
  snapshotOverride = null,
  suppressHeavyLayoutEffects = false,
  artifactCache,
  solutionArtifactLookupStatus = "missing",
  onSolutionReplayBatchCheckpoint,
  onSolutionReplayBatchStatus,
}: ModelArtContainerProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  /** Hidden per-step capture needs a fresh iframe identity when step or artifact fingerprint changes. */
  const usePerStepGameCapture = scenarioSequenceLength > 0;
  const shouldForceHiddenCaptureRemount = usePerStepGameCapture && !showInteractivePreview && !isCreator;
  const solutionFrameInstanceKey = shouldForceHiddenCaptureRemount
    ? `solution-${artifactCache?.fingerprint ?? "no-artifact"}-${eventSequenceSolutionStepId ?? "none"}`
    : undefined;

  // When the solution iframe changes identity (step or solution artifact fingerprint),
  // clear stale solution pixels so replay compares against the fresh reference side.
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

  const [jsError, setJsError] = useState<FrameJsError | null>(null);
  const handleJsError = useCallback((error: FrameJsError | null) => setJsError(error), []);
  const solutionFrameNeedsReplay = replaySequence.length > 0 || recordingSequence;
  const solutionFrameInteractive = frameNeedsInteractive || interactiveOverride === true;
  // Manual reruns need the live solution iframe even when a cached static image already exists.
  // Without this, player/game reruns animate only the drawboard and leave solution-side captures stale.
  const needsLiveSolutionFrame = showInteractivePreview || solutionFrameInteractive || solutionFrameNeedsReplay;
  const mountSolutionFrame =
    needsLiveSolutionFrame
    || isCreator
    || (!usePerStepGameCapture && !hasSolutionCapture)
    || (
      usePerStepGameCapture
      && allowTransientSolutionIframe
      && !hasSolutionCapture
      && solutionArtifactLookupStatus === "missing"
    );
  const prevMountedSolutionFrameRef = useRef(mountSolutionFrame);
  useEffect(() => {
    const prev = prevMountedSolutionFrameRef.current;
    if (prev && !mountSolutionFrame && !isCreator) {
      announceLiveSolutionFrameRemoved(scenario.scenarioId);
    }
    prevMountedSolutionFrameRef.current = mountSolutionFrame;
  }, [isCreator, mountSolutionFrame, scenario.scenarioId]);

  if (!level) return null;

  const levelSolution = level.solution || { css: "", html: "", js: "" };
  const solutionCSS = levelSolution.css || "";
  const solutionHTML = levelSolution.html || "";
  const solutionJS = levelSolution.js || "";
  const frameCss = snapshotOverride?.css ?? solutionCSS;
  const frameHtml = snapshotOverride?.snapshotHtml ?? solutionHTML;
  const frameEvents = interactionTriggers ?? level.events ?? [];

  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {mountSolutionFrame && (
        <Frame
          key={solutionFrameInstanceKey}
          ref={frameRef}
          id="DrawBoard"
          newCss={frameCss}
          newHtml={frameHtml}
          newJs={solutionJS + "\n" + scenario.js}
          events={frameEvents}
          scenario={scenario}
          name="solutionUrl"
          hiddenFromView={!showInteractivePreview}
          onCaptureBusyChange={onCaptureBusyChange}
          interactiveOverride={solutionFrameInteractive}
          recordingSequence={recordingSequence}
          persistRecordedSequenceStep={recordingSequence}
          replaySequence={replaySequence}
          forceEmptyReplaySequence={forceEmptyReplaySequence}
          suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
          eventSequenceSolutionStepId={usePerStepGameCapture ? eventSequenceSolutionStepId : null}
          selectedReplayStepId={usePerStepGameCapture ? eventSequenceSolutionStepId : null}
          artifactCache={artifactCache}
          onJsError={handleJsError}
          onReplayBatchCheckpoint={onSolutionReplayBatchCheckpoint}
          onReplayBatchStatus={onSolutionReplayBatchStatus}
        />
      )}
      {children}
      {!showInteractivePreview && jsError && (
        <FrameJsErrorOverlay
          error={jsError}
          width={scenario.dimensions.width}
          height={scenario.dimensions.height}
        />
      )}
      {!isCreator && !hasSolutionCapture && (
        <div
          className="absolute inset-0 z-[50] flex items-center justify-center bg-background"
          aria-busy
          aria-label="Preparing reference"
        >
          <Spinner
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            message={solutionArtifactLookupStatus === "loading" ? "Checking reference cache…" : "Preparing reference…"}
          />
        </div>
      )}
    </ArtContainer>
  );
};
