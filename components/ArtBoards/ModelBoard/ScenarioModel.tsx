/** @format */
"use client";

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { EventSequenceStep, scenario } from "@/types";
import { Image } from "@/components/General/Image/Image";
import { DiffModelToggleContent } from "@/components/General/FloatingActionButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { Button } from "@/components/ui/button";
import PoppingTitle from "@/components/General/PoppingTitle";
import { Camera } from "lucide-react";
import type { FrameHandle, ReplayBatchCheckpoint, ReplayBatchStatusEvent } from "@/components/ArtBoards/Frame";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";

import {
  buildArtifactKey,
  fetchRemoteArtifact,
  hashArtifactFingerprint,
  readLocalArtifact,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import {
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import type { InteractionTrigger } from "@/types";
import { useArtboardActionBar } from "@/components/ArtBoards/ArtboardActionBarContext";

type ScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
  /** When true, registers with creator navbar Grade (visible artboards only; not used on player game nav). */
  registerForNavbarCapture?: boolean;
  /** When true, skip snapshot preview fetch (SidebySideArt probes/hidden branches). */
  suppressHeavyLayoutEffects?: boolean;
  creatorMode?: boolean;
  activeSolutionStepId?: string | null;
  showInteractivePreview?: boolean;
  frameNeedsInteractive?: boolean;
  interactiveSnapshotOverride?: any;
  replaySequence?: EventSequenceStep[];
  interactionTriggers?: InteractionTrigger[];
  isSequenceRecording?: boolean;
  forceEmptyReplaySequence?: boolean;
  scenarioSequenceLength?: number;
  onSolutionFrameReady?: (handle: FrameHandle | null) => void;
  onSolutionReplayBatchCheckpoint?: (checkpoint: ReplayBatchCheckpoint) => void;
  onSolutionReplayBatchStatus?: (event: ReplayBatchStatusEvent) => void;
  solutionUrlOverride?: string;
};

type SolutionArtifactLookupStatus = "ready" | "loading" | "missing";

export const ScenarioModel = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorMode,
  activeSolutionStepId = null,
  showInteractivePreview = false,
  frameNeedsInteractive = false,
  interactiveSnapshotOverride = null,
  replaySequence = [],
  interactionTriggers = [],
  isSequenceRecording = false,
  forceEmptyReplaySequence = false,
  scenarioSequenceLength = 0,
  onSolutionFrameReady,
  onSolutionReplayBatchCheckpoint,
  onSolutionReplayBatchStatus,
  solutionUrlOverride,
}: ScenarioModelProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const levelIdentifier = level?.identifier ?? null;
  const levelName = level?.name ?? null;
  const showModel = level.showSolutionImageInsteadOfDiff;
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const currentGameId = useGameStore((state) => state.currentGameId);
  const { syncLevelFields } = useLevelMetaSync();
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.mode === "creator";
  const usePerStepSolutionKeys = scenarioSequenceLength > 0;
  const solutionStepIdForCapture = activeSolutionStepId;
  const [solutionCaptureBusy, setSolutionCaptureBusy] = useState(false);
  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { drawboardCaptureMode, manualDrawboardCapture } = useGameRuntimeConfig();
  const { setModelActions } = useArtboardActionBar();
  const platformBucket = useMemo(
    () => (drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null),
    [drawboardCaptureMode],
  );
  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence?.byScenarioId, scenario.scenarioId],
  );
  const selectedSolutionStep = useMemo(
    () => (solutionStepIdForCapture ? scenarioSequence.find((s) => s.id === solutionStepIdForCapture) ?? null : null),
    [scenarioSequence, solutionStepIdForCapture],
  );
  const solutionFingerprint = useMemo(
    () =>
      solutionArtifactFingerprint({
        html: level?.solution?.html || "",
        css: level?.solution?.css || "",
        js: level?.solution?.js || "",
        scenario,
      }),
    [level?.solution?.css, level?.solution?.html, level?.solution?.js, scenario],
  );
  const activeSolutionFingerprint = useMemo(() => {
    if (!usePerStepSolutionKeys) {
      return solutionFingerprint;
    }
    if (selectedSolutionStep) {
      if (selectedSolutionStep.isInitial) {
        return hashArtifactFingerprint(["solution-step", solutionFingerprint, selectedSolutionStep.id]);
      }
      return solutionStepArtifactFingerprint({ solutionFingerprint, step: selectedSolutionStep });
    }
    return solutionFingerprint;
  }, [selectedSolutionStep, solutionFingerprint, usePerStepSolutionKeys, solutionStepIdForCapture]);
  const solutionArtifactDescriptor = useMemo<DrawboardArtifactDescriptor>(
    () => ({
      version: "v1",
      captureMode: drawboardCaptureMode,
      artifactType: usePerStepSolutionKeys ? "solution-step" : "solution",
      fingerprint: activeSolutionFingerprint,
      gameId: currentGameId,
      levelIdentifier,
      levelName,
      scenarioId: scenario.scenarioId,
      stepId: usePerStepSolutionKeys ? solutionStepIdForCapture : null,
      platformBucket,
      width: scenario.dimensions.width,
      height: scenario.dimensions.height,
    }),
    [
      activeSolutionFingerprint,
      currentGameId,
      drawboardCaptureMode,
      levelIdentifier,
      levelName,
      platformBucket,
      scenario.dimensions.height,
      scenario.dimensions.width,
      scenario.scenarioId,
      solutionStepIdForCapture,
      usePerStepSolutionKeys,
    ],
  );
  const solutionArtifactKey = useMemo(
    () => buildArtifactKey(solutionArtifactDescriptor),
    [solutionArtifactDescriptor],
  );
  const storedSolutionUrl = useAppSelector(
    (state) => (state.solutionUrls as Record<string, string | undefined>)[solutionArtifactKey] ?? "",
  );
  const solutionUrl = solutionUrlOverride?.trim() ? solutionUrlOverride : storedSolutionUrl;

  const [solutionArtifactLookup, setSolutionArtifactLookup] = useState<{
    key: string;
    status: SolutionArtifactLookupStatus;
  }>({
    key: solutionArtifactKey,
    status: solutionUrl?.trim() ? "ready" : "loading",
  });
  const solutionArtifactLookupStatus: SolutionArtifactLookupStatus = solutionUrl?.trim()
    ? "ready"
    : solutionArtifactLookup.key === solutionArtifactKey
      ? solutionArtifactLookup.status
      : "loading";

  useEffect(() => {
    if (solutionUrl?.trim()) {
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      const local = readLocalArtifact(solutionArtifactDescriptor);
      if (local?.dataUrl) {
     
        dispatch(addSolutionUrl({
          solutionUrl: local.dataUrl,
          scenarioId: scenario.scenarioId,
          storageKey: solutionArtifactKey,
          eventSequenceStepId: usePerStepSolutionKeys ? solutionStepIdForCapture ?? undefined : undefined,
        }));
        if (!cancelled) {
          setSolutionArtifactLookup({ key: solutionArtifactKey, status: "ready" });
        }
        return;
      }
      try {
        const remote = await fetchRemoteArtifact(solutionArtifactDescriptor);
        if (!cancelled && remote?.dataUrl) {
         
          dispatch(addSolutionUrl({
            solutionUrl: remote.dataUrl,
            scenarioId: scenario.scenarioId,
            storageKey: solutionArtifactKey,
            eventSequenceStepId: usePerStepSolutionKeys ? solutionStepIdForCapture ?? undefined : undefined,
          }));
          setSolutionArtifactLookup({ key: solutionArtifactKey, status: "ready" });
          return;
        }
      } catch {
        // Ignore cache misses/network failures.
      }
      if (!cancelled) {
        setSolutionArtifactLookup({ key: solutionArtifactKey, status: "missing" });
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    scenario.scenarioId,
    solutionArtifactDescriptor,
    solutionArtifactKey,
    solutionStepIdForCapture,
    solutionUrl,
    store,
    usePerStepSolutionKeys,
    currentLevel,
    levelIdentifier,
    levelName,
  ]);

  const bindSolutionFrame = useCallback(
    (instance: FrameHandle | null) => {
      solutionFrameRef.current = instance;
      onSolutionFrameReady?.(instance);
      if (registerForNavbarCapture) {
        captureNav?.registerSolutionFrame(instance);
      }
    },
    [captureNav, onSolutionFrameReady, registerForNavbarCapture],
  );

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerSolutionFrame(null);
      }
      onSolutionFrameReady?.(null);
    };
  }, [captureNav, onSolutionFrameReady, registerForNavbarCapture]);

  const handleSolutionCaptureBusy = useCallback(
    (busy: boolean) => {
      setSolutionCaptureBusy(busy);
      if (registerForNavbarCapture) {
        captureNav?.notifySolutionBusy(busy);
      }
    },
    [captureNav, registerForNavbarCapture],
  );
  const handleSwitchModel = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
    syncLevelFields(currentLevel - 1, ["showSolutionImageInsteadOfDiff"]);
  }, [currentLevel, dispatch, syncLevelFields]);

  const showModelToggle = !showInteractivePreview;
  const showSolutionCapture = isCreator && !showInteractivePreview && manualDrawboardCapture;

  useEffect(() => {
    if (!showModelToggle && !showSolutionCapture) {
      setModelActions(null);
      return;
    }

    setModelActions(
      <>
        {showModelToggle ? (
          <div className="flex h-9 items-center rounded-full bg-muted px-3 py-0 text-foreground shadow-sm">
            <DiffModelToggleContent
              dragStarted={false}
              leftLabel="diff"
              rightLabel="model"
              checked={showModel}
              onCheckedChange={handleSwitchModel}
            />
          </div>
        ) : null}
        {showSolutionCapture ? (
          <PoppingTitle topTitle="Capture picture from solution (static view)">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85"
              disabled={solutionCaptureBusy}
              aria-label="Capture picture from solution (static view)"
              onClick={() => solutionFrameRef.current?.requestCapture()}
            >
              <Camera className="h-5 w-5" />
            </Button>
          </PoppingTitle>
        ) : null}
      </>,
    );

    return () => {
      setModelActions(null);
    };
  }, [
    handleSwitchModel,
    manualDrawboardCapture,
    setModelActions,
    showInteractivePreview,
    showModel,
    showModelToggle,
    showSolutionCapture,
    solutionCaptureBusy,
    isCreator,
  ]);

  return (
    <div className="relative flex h-full min-h-0 w-full justify-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        <Board>
          <ModelArtContainer
            scenario={scenario}
            showInteractivePreview={showInteractivePreview}
            frameNeedsInteractive={frameNeedsInteractive}
            frameRef={bindSolutionFrame}
            onCaptureBusyChange={handleSolutionCaptureBusy}
            isCreator={isCreator}
            scenarioSequenceLength={scenarioSequenceLength}
            solutionUrl={solutionUrl}
            eventSequenceSolutionStepId={usePerStepSolutionKeys ? solutionStepIdForCapture : null}
            allowTransientSolutionIframe={!suppressHeavyLayoutEffects}
            interactiveOverride={frameNeedsInteractive}
            recordingSequence={isSequenceRecording}
            replaySequence={replaySequence}
            forceEmptyReplaySequence={forceEmptyReplaySequence}
            interactionTriggers={interactionTriggers}
            snapshotOverride={interactiveSnapshotOverride}
            suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
            artifactCache={solutionArtifactDescriptor}
            solutionArtifactLookupStatus={solutionArtifactLookupStatus}
            onSolutionReplayBatchCheckpoint={onSolutionReplayBatchCheckpoint}
            onSolutionReplayBatchStatus={onSolutionReplayBatchStatus}
          >
            <div
              className="relative"
              style={{
                width: scenario.dimensions.width,
                height: scenario.dimensions.height,
                pointerEvents: showInteractivePreview ? "none" : "auto",
              }}
            >
              {!showInteractivePreview && (
                <div className="relative z-[1]">
                  {showModel && (solutionUrl) ? (
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
                  )}
                </div>
              )}
              {solutionCaptureBusy && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
                  aria-busy
                  aria-label="Generating picture"
                >
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              )}
            </div>
          </ModelArtContainer>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </div>
  );
};
