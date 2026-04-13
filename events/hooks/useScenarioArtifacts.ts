/**
 * useScenarioArtifacts — Resolves drawing + solution URLs for a scenario.
 *
 * Handles fingerprinting, descriptor construction, cache hydration,
 * per-step solution key logic, and the `getStepSolutionUrl` helper.
 */
import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import {
  buildArtifactKey,
  fetchRemoteArtifact,
  hashArtifactFingerprint,
  readLocalArtifact,
  type DrawboardArtifactDescriptor,
  type DrawboardArtifactType,
} from "@/lib/drawboard/artifactCache";
import {
  drawingArtifactFingerprint,
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";
import { defaultTimelineStepIdForSolutionCapture } from "@/events/core/eventSequenceSolutionUrls";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "@/events/core/eventSequenceState";
import type { scenario, EventSequenceStep } from "@/types";

// ---------------------------------------------------------------------------
// useArtifactHydration — shared local→remote cache fallback
// ---------------------------------------------------------------------------

function useArtifactHydration(
  descriptor: DrawboardArtifactDescriptor,
  existingUrl: string | undefined,
  onHydrated: (dataUrl: string) => void,
) {
  useEffect(() => {
    if (existingUrl?.trim()) return;
    let cancelled = false;
    const hydrate = async () => {
      const local = readLocalArtifact(descriptor);
      if (local?.dataUrl) { onHydrated(local.dataUrl); return; }
      try {
        const remote = await fetchRemoteArtifact(descriptor);
        if (!cancelled && remote?.dataUrl) onHydrated(remote.dataUrl);
      } catch { /* cache miss / network — live capture will populate */ }
    };
    void hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor, existingUrl]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LegacySolution = { SCSS: string; SHTML: string; SJS: string; drawn: boolean };

export type UseScenarioArtifactsParams = {
  scenario: scenario;
  isCreator: boolean;
  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId?: string | null;
  scenarioSequence: EventSequenceStep[];
};

export type UseScenarioArtifactsResult = {
  drawingUrl: string | undefined;
  solutionUrl: string;
  drawingArtifactDescriptor: DrawboardArtifactDescriptor;
  solutionArtifactDescriptor: DrawboardArtifactDescriptor;
  solutionStepIdForCapture: string | null;
  solutionFingerprint: string;
  usePerStepSolutionKeys: boolean;
  buildDescriptor: (type: DrawboardArtifactType, fp: string, stepId: string | null) => DrawboardArtifactDescriptor;
  getStepSolutionUrl: (stepId: string) => string;
  drawboardCaptureMode: string;
  css: string;
  html: string;
  js: string;
  resolvedSolutionCss: string;
  resolvedSolutionHtml: string;
  interactive: boolean;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScenarioArtifacts({
  scenario,
  isCreator,
  selectedEventSequenceStepId,
  gameplaySolutionStepId,
  scenarioSequence,
}: UseScenarioArtifactsParams): UseScenarioArtifactsResult {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string>);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const currentGameId = useGameStore((state) => state.currentGameId);
  const { drawboardCaptureMode } = useGameRuntimeConfig();
  const solutions = useAppSelector((state) => state.solutions as unknown as Record<string, LegacySolution>);

  const platformBucket = useMemo(
    () => (drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null),
    [drawboardCaptureMode],
  );

  // ---- Code + solution resolution ----

  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const resolvedSolution = useMemo(() => {
    if (!level) return { css: "", html: "" };
    const defaults = solutions[level.name]
      ? { css: solutions[level.name].SCSS, html: solutions[level.name].SHTML }
      : null;
    const sol = level.solution || { css: "", html: "", js: "" };
    return {
      css: sol.css || defaults?.css || "",
      html: sol.html || defaults?.html || "",
    };
  }, [level, solutions]);
  const resolvedSolutionCss = resolvedSolution.css;
  const resolvedSolutionHtml = resolvedSolution.html;
  const interactive = level?.interactive ?? false;
  /** Per-step solution captures for any mode when a sequence exists (matches drawboard + game). */
  const usePerStepSolutionKeys = scenarioSequence.length > 0;

  // ---- Artifact descriptor factory ----

  const buildDescriptor = useCallback(
    (artifactType: DrawboardArtifactType, fingerprint: string, stepId: string | null): DrawboardArtifactDescriptor => ({
      version: "v1",
      captureMode: drawboardCaptureMode,
      artifactType,
      fingerprint,
      gameId: currentGameId,
      levelIdentifier: level?.identifier ?? null,
      levelName: level?.name ?? null,
      scenarioId: scenario.scenarioId,
      stepId,
      platformBucket,
      width: scenario.dimensions.width,
      height: scenario.dimensions.height,
    }),
    [currentGameId, drawboardCaptureMode, level?.identifier, level?.name, platformBucket, scenario.dimensions.height, scenario.dimensions.width, scenario.scenarioId],
  );

  // ---- Drawing fingerprint + descriptor ----

  const drawingFingerprint = useMemo(
    () => drawingArtifactFingerprint({ html, css, js, scenario }),
    [css, html, js, scenario],
  );
  const drawingArtifactDescriptor = useMemo(
    () => buildDescriptor("drawing", drawingFingerprint, null),
    [buildDescriptor, drawingFingerprint],
  );
  const drawingArtifactKey = useMemo(() => buildArtifactKey(drawingArtifactDescriptor), [drawingArtifactDescriptor]);
  const drawingUrl = drawingUrls[drawingArtifactKey];

  // ---- Solution fingerprint + descriptor ----

  const resolvedSolutionJs = level?.solution?.js || solutions[level?.name ?? ""]?.SJS || "";
  const solutionFingerprint = useMemo(
    () => solutionArtifactFingerprint({ html: resolvedSolutionHtml, css: resolvedSolutionCss, js: resolvedSolutionJs, scenario }),
    [resolvedSolutionCss, resolvedSolutionHtml, resolvedSolutionJs, scenario],
  );
  const solutionStepIdForCapture = useMemo(() => {
    if (scenarioSequence.length > 0) {
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed) return defaultTimelineStepIdForSolutionCapture(scrubbed);
      if (!isCreator && gameplaySolutionStepId != null) {
        return defaultTimelineStepIdForSolutionCapture(gameplaySolutionStepId);
      }
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence.length, selectedEventSequenceStepId]);
  const selectedSolutionStep = useMemo(
    () => scenarioSequence.find((step) => step.id === solutionStepIdForCapture) ?? null,
    [scenarioSequence, solutionStepIdForCapture],
  );
  const activeSolutionFingerprint = useMemo(() => {
    if (!usePerStepSolutionKeys) {
      return solutionFingerprint;
    }
    if (solutionStepIdForCapture === INITIAL_EVENT_SEQUENCE_STEP_ID) {
      return hashArtifactFingerprint(["solution-step", solutionFingerprint, INITIAL_EVENT_SEQUENCE_STEP_ID]);
    }
    if (selectedSolutionStep) {
      return solutionStepArtifactFingerprint({ solutionFingerprint, step: selectedSolutionStep });
    }
    return solutionFingerprint;
  }, [selectedSolutionStep, solutionFingerprint, usePerStepSolutionKeys, solutionStepIdForCapture]);
  const solutionArtifactDescriptor = useMemo(
    () => buildDescriptor(
      usePerStepSolutionKeys ? "solution-step" : "solution",
      activeSolutionFingerprint,
      usePerStepSolutionKeys ? solutionStepIdForCapture : null,
    ),
    [activeSolutionFingerprint, buildDescriptor, solutionStepIdForCapture, usePerStepSolutionKeys],
  );
  const solutionArtifactKey = useMemo(() => buildArtifactKey(solutionArtifactDescriptor), [solutionArtifactDescriptor]);
  const solutionUrl = solutionUrls[solutionArtifactKey] ?? "";

  // ---- Hydration ----

  useArtifactHydration(drawingArtifactDescriptor, drawingUrl, (dataUrl) => {
    dispatch(addDrawingUrl({ drawingUrl: dataUrl, scenarioId: scenario.scenarioId, storageKey: drawingArtifactKey }));
  });

  useArtifactHydration(solutionArtifactDescriptor, solutionUrl, (dataUrl) => {
    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91f8b2'},body:JSON.stringify({sessionId:'91f8b2',runId:'flash-switch-1',hypothesisId:'H4',location:'useScenarioArtifacts.ts:solution-hydrate',message:'shared scenario artifacts solution hydrate callback',data:{levelId:currentLevel,levelIdentifier:level?.identifier ?? null,levelName:level?.name ?? null,scenarioId:scenario.scenarioId,stepId:solutionStepIdForCapture ?? null,artifactKey:solutionArtifactKey,artifactFingerprint:solutionArtifactDescriptor.fingerprint,slotOccupied:Boolean((store.getState().solutionUrls as Record<string, string | undefined>)[solutionArtifactKey]?.trim()),urlLength:dataUrl.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    dispatch(addSolutionUrl({
      solutionUrl: dataUrl,
      scenarioId: scenario.scenarioId,
      storageKey: solutionArtifactKey,
      eventSequenceStepId: usePerStepSolutionKeys ? solutionStepIdForCapture ?? undefined : undefined,
    }));
  });

  // ---- Step solution URL resolver ----

  const getStepSolutionUrl = useCallback((stepId: string): string => {
    const comparisonStep = scenarioSequence.find((step) => step.id === stepId) ?? null;
    const fp =
      usePerStepSolutionKeys && stepId === INITIAL_EVENT_SEQUENCE_STEP_ID
        ? hashArtifactFingerprint(["solution-step", solutionFingerprint, INITIAL_EVENT_SEQUENCE_STEP_ID])
        : usePerStepSolutionKeys && comparisonStep
          ? solutionStepArtifactFingerprint({ solutionFingerprint, step: comparisonStep })
          : solutionFingerprint;
    const desc = buildDescriptor(
      usePerStepSolutionKeys ? "solution-step" : "solution",
      fp,
      usePerStepSolutionKeys ? stepId : null,
    );
    return solutionUrls[buildArtifactKey(desc)]?.trim() ?? "";
  }, [buildDescriptor, scenarioSequence, solutionFingerprint, solutionUrls, usePerStepSolutionKeys]);

  return {
    drawingUrl,
    solutionUrl,
    drawingArtifactDescriptor,
    solutionArtifactDescriptor,
    solutionStepIdForCapture,
    solutionFingerprint,
    usePerStepSolutionKeys,
    buildDescriptor,
    getStepSolutionUrl,
    drawboardCaptureMode,
    css,
    html,
    js,
    resolvedSolutionCss,
    resolvedSolutionHtml,
    interactive,
  };
}
