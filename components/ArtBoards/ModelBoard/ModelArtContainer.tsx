/** @format */
"use client";

// ModelArtContainer.tsx
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { Frame, type FrameHandle } from "../Frame";
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

type LegacySolution = {
  SCSS: string;
  SHTML: string;
  SJS: string;
  drawn: boolean;
};

type ModelArtContainerProps = {
  children: React.ReactNode;
  scenario: scenario;
  showInteractivePreview?: boolean;
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
};

export const ModelArtContainer = ({
  children,
  scenario,
  showInteractivePreview = false,
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
}: ModelArtContainerProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutions = useAppSelector((state) => state.solutions as unknown as Record<string, LegacySolution>);

  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  /** Game-only: remount solution iframe + clear pixels when timeline step changes. Creator keeps the iframe stable. */
  const usePerStepGameCapture = scenarioSequenceLength > 0;

  const mountSolutionFrame =
    isCreator
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

  // When the per-step solution iframe remounts for a different step (key change),
  // clear stale solution pixels so the comparison pipeline uses the solutionUrl
  // instead of leftover pixels from the previous step's iframe.
  const prevStepIdRef = useRef(eventSequenceSolutionStepId);
  useEffect(() => {
    if (usePerStepGameCapture && prevStepIdRef.current !== eventSequenceSolutionStepId) {
      clearStoredSolutionSide(scenario.scenarioId);
    }
    prevStepIdRef.current = eventSequenceSolutionStepId;
  }, [eventSequenceSolutionStepId, scenario.scenarioId, usePerStepGameCapture]);

  if (!level) return null;

  const defaultLevelSolutions = solutions[level.name]
    ? {
        css: solutions[level.name].SCSS,
        html: solutions[level.name].SHTML,
        js: solutions[level.name].SJS,
      }
    : null;
  const levelSolution = level.solution || { css: "", html: "", js: "" };
  const solutionCSS = levelSolution.css || defaultLevelSolutions?.css || "";
  const solutionHTML = levelSolution.html || defaultLevelSolutions?.html || "";
  const solutionJS = levelSolution.js || defaultLevelSolutions?.js || "";
  const frameCss = snapshotOverride?.css ?? solutionCSS;
  const frameHtml = snapshotOverride?.snapshotHtml ?? solutionHTML;
  const frameEvents = interactionTriggers ?? level.events ?? [];
  const solutionFrameNeedsReplay = replaySequence.length > 0 || recordingSequence;
  const solutionFrameInteractive = solutionFrameNeedsReplay || interactiveOverride === true;
  const [jsError, setJsError] = useState<FrameJsError | null>(null);
  const handleJsError = useCallback((error: FrameJsError | null) => setJsError(error), []);

  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {mountSolutionFrame && (
        <Frame
          key={usePerStepGameCapture && !isCreator ? `solution-${eventSequenceSolutionStepId ?? "none"}` : undefined}
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
          artifactCache={artifactCache}
          onJsError={handleJsError}
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
