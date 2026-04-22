'use client';

import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { mainColor } from "@/constants";
import { useArtboardContext } from "@/events/components/ArtboardContext";
import { useEventsState } from "@/events/components/EventsContext";
import { scenario } from "@/types";

type DiffProps = {
  scenario: scenario;
};

export const Diff = ({ scenario }: DiffProps): React.ReactNode => {
  const { solution } = useArtboardContext();
  const { stepsById } = useEventsState();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const prevImgUrlRef = useRef<string | null>(null);

  const scenarioDiffUrl = stepsById[solution.currentStepId]?.diffUrl ?? null;

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
      const resized = new Uint8ClampedArray(expectedLength);
      resized.set(deserializedDiff.subarray(0, expectedLength));
      normalizedDiff = resized;
    }

    imgData?.data.set(normalizedDiff);
    ctx?.putImageData(imgData!, 0, 0);

    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;

      if (blob) {
        if (prevImgUrlRef.current) {
          URL.revokeObjectURL(prevImgUrlRef.current);
        }
        const newUrl = URL.createObjectURL(blob);
        prevImgUrlRef.current = newUrl;
        setImgUrl(newUrl);
      }
    });
  }, [scenario, scenarioDiffUrl]);

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
