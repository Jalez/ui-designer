'use client';

import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { mainColor } from "@/constants";

type DiffProps = {
  scenario: scenario;
};

export const Diff = ({ scenario }: DiffProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const differenceUrls = useAppSelector((state: any) => state.differenceUrls);
  const scenarioDiffUrl = differenceUrls[scenario.scenarioId];
  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const prevImgUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (!scenarioDiffUrl || scenarioDiffUrl.length === 0) {
      setLoading(false);
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

    imgData?.data.set(deserializedDiff);
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
    setLoading(false);
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
      {
        // @ts-ignore
        (imgUrl && <img src={imgUrl} alt="Difference" />) || (
          <p className="text-center">
            No diff image created for this level yet. Save your solution to
            generate.
          </p>
        )
      }
    </div>
  );
};
