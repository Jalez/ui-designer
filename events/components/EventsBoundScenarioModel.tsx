'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { useArtboardActionBar } from "@/components/ArtBoards/ArtboardActionBarContext";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { ScenarioFrameBoard } from "@/components/ArtBoards/ScenarioFrameBoard";
import { Diff } from "@/components/ArtBoards/ModelBoard/Diff/Diff";
import { Image } from "@/components/General/Image/Image";
import { DiffModelToggleContent } from "@/components/General/FloatingActionButton";
import { Button } from "@/components/ui/button";
import PoppingTitle from "@/components/General/PoppingTitle";
import { Camera } from "lucide-react";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
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
import { announceLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import { clearStoredSolutionSide } from "@/lib/drawboard/drawboardPixelsStore";
import type { scenario } from "@/types";
import type { FrameHandle, FrameJsError } from "@/components/ArtBoards/Frame";
import { useGameContext } from "@/components/ArtBoards/GameContext";

type EventsBoundScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
};

type SolutionArtifactLookupStatus = "ready" | "loading" | "missing";

function CaptureButton({
  busy,
  solutionFrameRef,
  title,
}: {
  busy: boolean;
  solutionFrameRef: React.RefObject<FrameHandle | null>;
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
        onClick={() => solutionFrameRef.current?.requestCapture()}
      >
        <Camera className="h-5 w-5" />
      </Button>
    </PoppingTitle>
  );
}

export const EventsBoundScenarioModel = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
}: EventsBoundScenarioModelProps) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const levelIdentifier = level?.identifier ?? null;
  const levelName = level?.name ?? null;
  const showModel = level?.showSolutionImageInsteadOfDiff ?? true;
  const dispatch = useAppDispatch();
  const currentGameId = useGameStore((state) => state.currentGameId);
  const { syncLevelFields } = useLevelMetaSync();
  const { runtime, solutionBoard } = useArtboardContext();
  const { canEditCurrentGame, showLive } = useGameContext();
  const solutionOnFrameReady = solutionBoard.onFrameReady;
  const solutionReplayBatchCheckpoint = solutionBoard.onReplayBatchCheckpoint;
  const solutionReplayBatchStatus = solutionBoard.onReplayBatchStatus;
  const solutionCurrentStepId = solutionBoard.currentStepId;
  const solutionReplaySequence = solutionBoard.replaySequence;
  const solutionIsSequenceRecording = solutionBoard.isSequenceRecording;
  const solutionForceEmptyReplaySequence = solutionBoard.forceEmptyReplaySequence;
  const solutionInteractionTriggers = solutionBoard.interactionTriggers;
  const solutionCurrentImageUrl = solutionBoard.currentImageUrl;
  const { drawboardCaptureMode, manualDrawboardCapture } = useGameRuntimeConfig();
  const { setModelActions } = useArtboardActionBar();
  const captureNav = useOptionalDrawboardNavbarCapture();
  const [solutionCaptureBusy, setSolutionCaptureBusy] = useState(false);
  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const [jsError, setJsError] = useState<FrameJsError | null>(null);

  const platformBucket = useMemo(
    () => (drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null),
    [drawboardCaptureMode],
  );
  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence?.byScenarioId, scenario.scenarioId],
  );
  const selectedSolutionStep = useMemo(
    () => (
      solutionCurrentStepId
        ? scenarioSequence.find((step) => step.id === solutionCurrentStepId) ?? null
        : null
    ),
    [scenarioSequence, solutionCurrentStepId],
  );
  const solutionFingerprint = useMemo(
    () => solutionArtifactFingerprint({
      html: level?.solution?.html || "",
      css: level?.solution?.css || "",
      js: level?.solution?.js || "",
      scenario,
    }),
    [level?.solution?.css, level?.solution?.html, level?.solution?.js, scenario],
  );
  const usePerStepSolutionKeys = runtime.sequenceLength > 0;
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
  }, [selectedSolutionStep, solutionFingerprint, usePerStepSolutionKeys]);
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
      stepId: usePerStepSolutionKeys ? solutionCurrentStepId : null,
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
      solutionCurrentStepId,
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
  const solutionUrl = solutionCurrentImageUrl?.trim()
    ? solutionCurrentImageUrl
    : storedSolutionUrl;

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
          eventSequenceStepId: usePerStepSolutionKeys ? solutionCurrentStepId ?? undefined : undefined,
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
            eventSequenceStepId: usePerStepSolutionKeys ? solutionCurrentStepId ?? undefined : undefined,
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
    solutionCurrentStepId,
    solutionUrl,
    usePerStepSolutionKeys,
  ]);

  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  const shouldForceHiddenCaptureRemount = usePerStepSolutionKeys
    && !showLive
    && !canEditCurrentGame;
  const solutionFrameInstanceKey = shouldForceHiddenCaptureRemount
    ? `solution-${solutionArtifactDescriptor.fingerprint}-${solutionCurrentStepId ?? "none"}`
    : undefined;

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

  const solutionFrameNeedsReplay = solutionReplaySequence.length > 0 || solutionIsSequenceRecording;
  const needsLiveSolutionFrame = showLive || solutionFrameNeedsReplay;
  const mountSolutionFrame =
    needsLiveSolutionFrame
    || canEditCurrentGame
    || (!usePerStepSolutionKeys && !hasSolutionCapture)
    || (
      usePerStepSolutionKeys
      && !suppressHeavyLayoutEffects
      && !hasSolutionCapture
      && solutionArtifactLookupStatus === "missing"
    );

  const prevMountedSolutionFrameRef = useRef(mountSolutionFrame);
  useEffect(() => {
    const prev = prevMountedSolutionFrameRef.current;
    if (prev && !mountSolutionFrame && !canEditCurrentGame) {
      announceLiveSolutionFrameRemoved(scenario.scenarioId);
    }
    prevMountedSolutionFrameRef.current = mountSolutionFrame;
  }, [canEditCurrentGame, mountSolutionFrame, scenario.scenarioId]);

  const levelSolution = level?.solution || { css: "", html: "", js: "" };
  const solutionCss = levelSolution.css || "";
  const solutionHtml = levelSolution.html || "";
  const solutionJs = levelSolution.js || "";

  const bindSolutionFrame = useCallback((instance: FrameHandle | null) => {
    if (solutionFrameRef.current === instance) {
      return;
    }
    solutionFrameRef.current = instance;
    solutionOnFrameReady(instance);
    if (registerForNavbarCapture) {
      captureNav?.registerSolutionFrame(instance);
    }
  }, [captureNav, registerForNavbarCapture, solutionOnFrameReady]);

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerSolutionFrame(null);
      }
      solutionOnFrameReady(null);
    };
  }, [captureNav, registerForNavbarCapture, solutionOnFrameReady]);

  const handleSolutionCaptureBusy = useCallback((busy: boolean) => {
    setSolutionCaptureBusy(busy);
    if (registerForNavbarCapture) {
      captureNav?.notifySolutionBusy(busy);
    }
  }, [captureNav, registerForNavbarCapture]);
  const handleJsError = useCallback((error: FrameJsError | null) => setJsError(error), []);
  const handleSwitchModel = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
    syncLevelFields(currentLevel - 1, ["showSolutionImageInsteadOfDiff"]);
  }, [currentLevel, dispatch, syncLevelFields]);

  const showModelToggle = !showLive;
  const showSolutionCapture = canEditCurrentGame && !showLive && manualDrawboardCapture;

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
          <CaptureButton
            busy={solutionCaptureBusy}
            solutionFrameRef={solutionFrameRef}
            title="Capture picture from solution (static view)"
          />
        ) : null}
      </>,
    );

    return () => {
      setModelActions(null);
    };
  }, [
    handleSwitchModel,
    setModelActions,
    showModel,
    showModelToggle,
    showSolutionCapture,
    solutionCaptureBusy,
  ]);

  if (!level) {
    return null;
  }

  return (
    <ScenarioFrameBoard
      scenario={scenario}
      allowScaling={allowScaling}
      mountFrame={mountSolutionFrame}
      viewportPointerEvents={showLive ? "none" : "auto"}
      frameConfig={{
        key: solutionFrameInstanceKey,
        ref: bindSolutionFrame,
        name: "solutionUrl",
        events: solutionInteractionTriggers,
        newCss: solutionCss,
        newHtml: solutionHtml,
        newJs: `${solutionJs}\n${scenario.js}`,
        hiddenFromView: !showLive,
        onCaptureBusyChange: handleSolutionCaptureBusy,
        interactiveOverride: showLive,
        recordingSequence: solutionIsSequenceRecording,
        persistRecordedSequenceStep: solutionIsSequenceRecording,
        replaySequence: solutionReplaySequence,
        forceEmptyReplaySequence: solutionForceEmptyReplaySequence,
        suppressHeavyLayoutEffects,
        eventSequenceSolutionStepId: usePerStepSolutionKeys ? solutionCurrentStepId : null,
        selectedReplayStepId: usePerStepSolutionKeys ? solutionCurrentStepId : null,
        artifactCache: solutionArtifactDescriptor,
        onJsError: handleJsError,
        onReplayBatchCheckpoint: solutionReplayBatchCheckpoint,
        onReplayBatchStatus: solutionReplayBatchStatus,
      }}
      surfaceContent={!showLive ? (
        showModel && solutionUrl ? (
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
        )
      ) : null}
      jsError={jsError}
      showJsErrorOverlay={!showLive}
      showCaptureBusyOverlay={solutionCaptureBusy}
      showLoadingOverlay={!canEditCurrentGame && !hasSolutionCapture}
      loadingMessage={solutionArtifactLookupStatus === "loading" ? "Checking reference cache…" : "Preparing reference…"}
    />
  );
};
