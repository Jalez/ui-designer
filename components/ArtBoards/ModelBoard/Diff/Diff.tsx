'use client';

import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { useAppSelector } from "@/store/hooks/hooks";
import type { RootState } from "@/store/store";
import { scenario } from "@/types";
import { mainColor } from "@/constants";
import { getEventSequenceScenarioUiKey, INITIAL_EVENT_SEQUENCE_STEP_ID } from "@/events/core/eventSequenceState";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { resolveEventSequenceDiffUrl } from "@/events/core/eventSequenceDiffUrls";

type DiffProps = {
  scenario: scenario;
};

export const Diff = ({ scenario }: DiffProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state: RootState) => state.currentLevel);
  const differenceUrls = useAppSelector((state: RootState) => state.differenceUrls);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const prevImgUrlRef = useRef<string | null>(null);

  const storedStepId = useEventSequenceTimelineUiStore((state) => (
    state.selectedStepIdByScenario[getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)] ?? null
  ));
  const selectedStepId = storedStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID;
  const scenarioDiffUrl = resolveEventSequenceDiffUrl(differenceUrls, scenario.scenarioId, {
    usePerStepKeys: true,
    stepId: selectedStepId,
  });

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
