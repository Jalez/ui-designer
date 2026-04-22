/**
 * useStepPreviewRenderer — Batch-fetches server-rendered target images
 * for each timeline step (all capture modes — browser mode uses these as
 * fallbacks when live iframe pixels are unavailable).
 */
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import {
  hashArtifactFingerprint,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import { solutionStepArtifactFingerprint } from "@/lib/drawboard/artifactFingerprint";
import { parseDrawboardRenderPreview, type DrawboardRenderPreviewPayload } from "@/events/core/imageUtils";
import type { EventSequenceStep } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseStepPreviewRendererParams = {
  scenarioSequence: EventSequenceStep[];
  scenarioId: string;
  resolvedSolutionCss: string;
  resolvedSolutionHtml: string;
  solutionFingerprint: string;
  buildDescriptor: (type: string, fp: string, stepId: string | null) => DrawboardArtifactDescriptor;
  suppressSequenceMetrics: boolean;
  /** Called for each successfully rendered step so the caller can dispatch to Redux if needed. */
  onStepRendered?: (stepId: string, descriptor: DrawboardArtifactDescriptor, dataUrl: string) => void;
};

export type UseStepPreviewRendererResult = {
  stepPreviews: Record<string, DrawboardRenderPreviewPayload>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStepPreviewRenderer({
  scenarioSequence,
  scenarioId,
  resolvedSolutionCss,
  resolvedSolutionHtml,
  solutionFingerprint,
  buildDescriptor,
  suppressSequenceMetrics,
  onStepRendered,
}: UseStepPreviewRendererParams): UseStepPreviewRendererResult {
  const [stepPreviews, setStepPreviews] = useState<Record<string, DrawboardRenderPreviewPayload>>({});
  const stepPreviewsRef = useRef<Record<string, DrawboardRenderPreviewPayload>>({});
  const lastRenderedSolutionSourceRef = useRef<string>("");
  const onStepRenderedRef = useRef(onStepRendered);

  useEffect(() => { stepPreviewsRef.current = stepPreviews; }, [stepPreviews]);
  useEffect(() => { onStepRenderedRef.current = onStepRendered; }, [onStepRendered]);

  useEffect(() => {
    let cancelled = false;

    const renderPreviews = async () => {
      if (suppressSequenceMetrics) return;
      if (!scenarioSequence.length) { setStepPreviews({}); return; }

      const renderSourceKey = `${resolvedSolutionCss}\0${resolvedSolutionHtml}`;
      const sourceChanged = lastRenderedSolutionSourceRef.current !== renderSourceKey;
      const missingSteps = sourceChanged
        ? scenarioSequence
        : scenarioSequence.filter((step) => !stepPreviewsRef.current[step.id]);

      const pruneStale = (current: Record<string, DrawboardRenderPreviewPayload>) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) =>
            scenarioSequence.some((s) => s.id === id),
          ),
        );

      if (missingSteps.length === 0) {
        setStepPreviews((current) => pruneStale(current));
        return;
      }

      lastRenderedSolutionSourceRef.current = renderSourceKey;

      const renderBody = (
        css: string,
        snapshotHtml: string,
        width: number,
        height: number,
        artifactCache: DrawboardArtifactDescriptor,
      ) =>
        fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            css, snapshotHtml, width, height,
            scenarioId, urlName: "solutionUrl",
            includeDataUrl: true, artifactCache,
          }),
        });

      const requests: Promise<readonly [string, DrawboardRenderPreviewPayload | null, DrawboardArtifactDescriptor]>[] = [];

      missingSteps.forEach((step) => {
        const stepDescriptor: DrawboardArtifactDescriptor = {
          ...buildDescriptor(
            "solution-step",
            step.isInitial
              ? hashArtifactFingerprint(["solution-step", solutionFingerprint, step.id])
              : solutionStepArtifactFingerprint({ solutionFingerprint, step }),
            step.id,
          ),
          width: step.snapshot.width,
          height: step.snapshot.height,
        };
        requests.push(
          (async () => {
            const response = await renderBody(
              step.isInitial ? resolvedSolutionCss : (step.snapshot.css || resolvedSolutionCss),
              step.isInitial ? resolvedSolutionHtml : step.snapshot.snapshotHtml,
              step.snapshot.width,
              step.snapshot.height,
              stepDescriptor,
            );
            if (!response.ok) return [step.id, null, stepDescriptor] as const;
            return [step.id, parseDrawboardRenderPreview(await response.json()), stepDescriptor] as const;
          })(),
        );
      });

      const nextEntries = await Promise.all(requests);
      if (cancelled) return;

      nextEntries.forEach(([id, entry, descriptor]) => {
        if (entry?.dataUrl) {
          onStepRenderedRef.current?.(id, descriptor, entry.dataUrl);
        }
      });

      setStepPreviews((current) => {
        const next = sourceChanged ? {} : { ...current };
        nextEntries.forEach(([id, entry]) => { if (entry) next[id] = entry; });
        return pruneStale(next);
      });
    };

    void renderPreviews();
    return () => { cancelled = true; };
  }, [
    buildDescriptor,
    scenarioSequence,
    resolvedSolutionCss,
    resolvedSolutionHtml,
    scenarioId,
    solutionFingerprint,
    suppressSequenceMetrics,
  ]);

  return { stepPreviews };
}
