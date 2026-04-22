/**
 * useScenarioArtifacts — Resolves drawing + solution URLs for a scenario.
 *
 * Handles fingerprinting, descriptor construction, cache hydration,
 * per-step solution key logic, and the `getStepSolutionUrl` helper.
 */
import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import {
  buildArtifactKey,
  hashArtifactFingerprint,
  type DrawboardArtifactDescriptor,
  type DrawboardArtifactType,
} from "@/lib/drawboard/artifactCache";
import {
  drawingArtifactFingerprint,
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { defaultTimelineStepIdForSolutionCapture } from "@/events/core/eventSequenceSolutionUrls";
import type { scenario, EventSequenceStep } from "@/types";


export type UseScenarioArtifactsParams = {
  scenario: scenario;
  isCreator: boolean;
  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId?: string | null;
  /** When set (and no timeline selection), drives the solution iframe to this step so browser capture can fill Redux. */
  solutionStepIdOverride?: string | null;
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
  css: string;
  html: string;
  js: string;
  resolvedSolutionCss: string;
  resolvedSolutionHtml: string;
  interactive: boolean;
};

type BuildDrawingArtifactDescriptorParams = {
  currentGameId: string | null;
  level: {
    code: { html?: string; css?: string; js?: string };
    identifier?: string | null;
    name?: string | null;
  } | null | undefined;
  scenario: scenario;
};

export function buildDrawingArtifactDescriptor({
  currentGameId,
  level,
  scenario,
}: BuildDrawingArtifactDescriptorParams): DrawboardArtifactDescriptor {
  return {
    version: "v1",
    artifactType: "drawing",
    fingerprint: drawingArtifactFingerprint({
      html: level?.code.html ?? "",
      css: level?.code.css ?? "",
      js: level?.code.js ?? "",
      scenario,
    }),
    gameId: currentGameId,
    levelIdentifier: level?.identifier ?? null,
    levelName: level?.name ?? null,
    scenarioId: scenario.scenarioId,
    stepId: null,
    width: scenario.dimensions.width,
    height: scenario.dimensions.height,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScenarioArtifacts({
  scenario,
  isCreator,
  selectedEventSequenceStepId,
  gameplaySolutionStepId,
  solutionStepIdOverride = null,
  scenarioSequence,
}: UseScenarioArtifactsParams): UseScenarioArtifactsResult {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string>);
  const dispatch = useAppDispatch();
  const currentGameId = useGameStore((state) => state.currentGameId);

  // ---- Code + solution resolution ----

  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const resolvedSolution = useMemo(() => {
    if (!level) return { css: "", html: "" };
    const sol = level.solution || { css: "", html: "", js: "" };
    return {
      css: sol.css || "",
      html: sol.html || "",
    };
  }, [level]);
  const resolvedSolutionCss = resolvedSolution.css;
  const resolvedSolutionHtml = resolvedSolution.html;
  const interactive = level?.interactive ?? false;
  /** Per-step solution captures for any mode when a sequence exists (matches drawboard + game). */
  const usePerStepSolutionKeys = scenarioSequence.length > 0;

  // ---- Artifact descriptor factory ----

  const buildDescriptor = useCallback(
    (artifactType: DrawboardArtifactType, fingerprint: string, stepId: string | null): DrawboardArtifactDescriptor => ({
      version: "v1",
      artifactType,
      fingerprint,
      gameId: currentGameId,
      levelIdentifier: level?.identifier ?? null,
      levelName: level?.name ?? null,
      scenarioId: scenario.scenarioId,
      stepId,
      width: scenario.dimensions.width,
      height: scenario.dimensions.height,
    }),
    [currentGameId, level?.identifier, level?.name, scenario.dimensions.height, scenario.dimensions.width, scenario.scenarioId],
  );

  // ---- Drawing fingerprint + descriptor ----

  const drawingArtifactDescriptor = useMemo(
    () => buildDrawingArtifactDescriptor({
      currentGameId,
      level,
      scenario,
    }),
    [currentGameId, level, scenario],
  );
  const drawingArtifactKey = useMemo(() => buildArtifactKey(drawingArtifactDescriptor), [drawingArtifactDescriptor]);
  const drawingUrl = drawingUrls[drawingArtifactKey];

  // ---- Solution fingerprint + descriptor ----

  const resolvedSolutionJs = level?.solution?.js || "";
  const solutionFingerprint = useMemo(
    () => solutionArtifactFingerprint({ html: resolvedSolutionHtml, css: resolvedSolutionCss, js: resolvedSolutionJs, scenario }),
    [resolvedSolutionCss, resolvedSolutionHtml, resolvedSolutionJs, scenario],
  );
  const solutionStepIdForCapture = useMemo(() => {
    const firstStepId = scenarioSequence[0]?.id ?? "";
    if (scenarioSequence.length > 0) {
      const override = solutionStepIdOverride?.trim();
      if (override) return defaultTimelineStepIdForSolutionCapture(override);
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed && scrubbed !== firstStepId) {
        return defaultTimelineStepIdForSolutionCapture(scrubbed);
      }
      if (!isCreator && gameplaySolutionStepId != null) {
        return defaultTimelineStepIdForSolutionCapture(gameplaySolutionStepId);
      }
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId ?? firstStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence, selectedEventSequenceStepId, solutionStepIdOverride]);
  const selectedSolutionStep = useMemo(
    () => scenarioSequence.find((step) => step.id === solutionStepIdForCapture) ?? null,
    [scenarioSequence, solutionStepIdForCapture],
  );
  const activeSolutionFingerprint = useMemo(() => {
    if (!usePerStepSolutionKeys) {
      return solutionFingerprint;
    }
    if (solutionStepIdForCapture === scenarioSequence[0]?.id) {
      return hashArtifactFingerprint(["solution-step", solutionFingerprint, solutionStepIdForCapture]);
    }
    if (selectedSolutionStep) {
      return solutionStepArtifactFingerprint({ solutionFingerprint, step: selectedSolutionStep });
    }
    return solutionFingerprint;
  }, [selectedSolutionStep, solutionFingerprint, usePerStepSolutionKeys, solutionStepIdForCapture, scenarioSequence]);
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




  // ---- Step solution URL resolver ----

  const getStepSolutionUrl = useCallback((stepId: string): string => {
    const comparisonStep = scenarioSequence.find((step) => step.id === stepId) ?? null;
    const isFirstStep = stepId === scenarioSequence[0]?.id;
    const fp =
      usePerStepSolutionKeys && isFirstStep
        ? hashArtifactFingerprint(["solution-step", solutionFingerprint, stepId])
        : usePerStepSolutionKeys && comparisonStep
          ? solutionStepArtifactFingerprint({ solutionFingerprint, step: comparisonStep })
          : solutionFingerprint;
    const desc = buildDescriptor(
      usePerStepSolutionKeys ? "solution-step" : "solution",
      fp,
      usePerStepSolutionKeys ? stepId : null,
    );
    const key = buildArtifactKey(desc);
    const result = solutionUrls[key]?.trim() ?? "";

    return result;
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
    css,
    html,
    js,
    resolvedSolutionCss,
    resolvedSolutionHtml,
    interactive,
  };
}
