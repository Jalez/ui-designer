'use client';

import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { useAppSelector } from "@/store/hooks/hooks";
import type { RootState } from "@/store/store";
import { scenario } from "@/types";
import { mainColor } from "@/constants";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceState";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import {
  getLatestUsableReplayComparisonResultForStep,
  getUsableReplayComparisonResult,
  logArtboardReplayDebug,
  selectBoardFreshnessMap,
  useArtboardReplayRuntimeStore,
} from "@/events/core/artboardReplayRuntimeStore";

type DiffProps = {
  scenario: scenario;
};

export const Diff = ({ scenario }: DiffProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state: RootState) => state.currentLevel);
  const { runtime } = useArtboardContext();
  const freshnessByKey = useArtboardReplayRuntimeStore((state) => state.freshnessByKey);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const prevImgUrlRef = useRef<string | null>(null);

  const storedStepId = useEventSequenceTimelineUiStore((state) => (
    state.selectedStepIdByScenario[getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)] ?? null
  ));
  const runtimeKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
  const drawingFreshnessByStep = selectBoardFreshnessMap(freshnessByKey, runtimeKey, "drawing");
  const solutionFreshnessByStep = selectBoardFreshnessMap(freshnessByKey, runtimeKey, "solution");
  const selectedStepId = runtime.activeReplayStepId ?? storedStepId ?? runtime.currentSelectedStepId;
  const replayScopedDiffUrl = runtime.activeReplayStepId && runtime.activeRunId != null
    ? getUsableReplayComparisonResult(
      runtimeKey,
      runtime.activeRunId,
      selectedStepId,
      drawingFreshnessByStep[selectedStepId]?.fingerprint,
      solutionFreshnessByStep[selectedStepId]?.fingerprint,
    )?.diff ?? null
    : getLatestUsableReplayComparisonResultForStep(
      runtimeKey,
      selectedStepId,
      drawingFreshnessByStep[selectedStepId]?.fingerprint,
      solutionFreshnessByStep[selectedStepId]?.fingerprint,
    )?.diff ?? null;
  const scenarioDiffUrl = replayScopedDiffUrl;

  useEffect(() => {
    logArtboardReplayDebug("diff-selection", {
      activeReplayStepId: runtime.activeReplayStepId,
      activeRunId: runtime.activeRunId,
      drawingFingerprint: drawingFreshnessByStep[selectedStepId]?.fingerprint ?? null,
      drawingIsStale: drawingFreshnessByStep[selectedStepId]?.isStale ?? false,
      replayDiffLength: replayScopedDiffUrl?.length ?? 0,
      runtimeKey,
      selectedStepId,
      solutionFingerprint: solutionFreshnessByStep[selectedStepId]?.fingerprint ?? null,
      solutionIsStale: solutionFreshnessByStep[selectedStepId]?.isStale ?? false,
      usingSource: replayScopedDiffUrl ? "replay-runtime" : "none",
    });
  }, [
    drawingFreshnessByStep,
    replayScopedDiffUrl,
    runtime.activeReplayStepId,
    runtime.activeRunId,
    runtimeKey,
    selectedStepId,
    solutionFreshnessByStep,
  ]);

  useEffect(() => {
    if (!scenarioDiffUrl || scenarioDiffUrl.length === 0) {
      setImgUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
          prevImgUrlRef.current = null;
        }
        return null;
      });
      return;
    }

    const width = scenario.dimensions.width;
    const height = scenario.dimensions.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imgData = ctx?.createImageData(width, height);
    const deserializedDiff = Buffer.from(scenarioDiffUrl, "base64");
    const expectedLength = width * height * 4;

    let normalizedDiff: ArrayLike<number> = deserializedDiff;
    if (deserializedDiff.length !== expectedLength) {
      // Normalize stale/mismatched buffers to the exact canvas size.
      const resized = new Uint8ClampedArray(expectedLength);
      resized.set(deserializedDiff.subarray(0, expectedLength));
      normalizedDiff = resized;
    }

    imgData?.data.set(normalizedDiff);
    ctx?.putImageData(imgData!, 0, 0);

    canvas.toBlob((blob) => {
      // Release the canvas GPU surface (critical for Firefox/Zen which holds
      // onto detached canvas textures much longer than Chrome)
      canvas.width = 0;
      canvas.height = 0;

      if (blob) {
        // Revoke the previous object URL to free memory
        if (prevImgUrlRef.current) {
          URL.revokeObjectURL(prevImgUrlRef.current);
        }
        const newUrl = URL.createObjectURL(blob);
        prevImgUrlRef.current = newUrl;
        setImgUrl(newUrl);
      }
    });
  }, [scenario, scenarioDiffUrl]);

  // Revoke on unmount
  useEffect(() => {
    return () => {
      if (prevImgUrlRef.current) {
        URL.revokeObjectURL(prevImgUrlRef.current);
      }
    };
  }, []);

  return (
    <div
      id="diff"
      className="z-[100] overflow-hidden flex flex-col items-center justify-center"
      style={{
        width: `${scenario.dimensions.width}px`,
        height: `${scenario.dimensions.height}px`,
        backgroundColor: mainColor,
      }}
    >
      {imgUrl ? (
        <img src={imgUrl} alt="Difference" />
      ) : (
        <p className="text-center">
          No diff image created for this level yet. Save your solution to
          generate.
        </p>
      )}
    </div>
  );
};
