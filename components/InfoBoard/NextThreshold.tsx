'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import InfoBox from "./InfoBox";
import PoppingTitle from "../General/PoppingTitle";
import { InfoText } from "./InfoText";

export const NextThreshold = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const points = useAppSelector((state) => state.points);

  if (!level) return null;

  const thresholds = level.pointsThresholds;
  if (!thresholds || thresholds.length === 0) return null;

  const currentAccuracy = points.levels[level.name]?.accuracy ?? 0;
  const sorted = [...thresholds].sort((a, b) => a.accuracy - b.accuracy);

  // Next = lowest threshold not yet reached
  const next = sorted.find((t) => currentAccuracy < t.accuracy);

  if (!next) {
    // All thresholds reached
    const top = sorted[sorted.length - 1];
    return (
      <InfoBox>
        <PoppingTitle topTitle="Next Threshold">
          <InfoText>
            <span className="text-primary font-semibold">Max pts!</span>
          </InfoText>
        </PoppingTitle>
      </InfoBox>
    );
  }

  const pts = Math.ceil((next.pointsPercent / 100) * level.maxPoints);

  return (
    <InfoBox>
      <PoppingTitle topTitle="Next Threshold">
        <InfoText>
          <span className="text-primary font-semibold">{next.accuracy}%</span>
          <span className="text-muted-foreground text-xs"> → </span>
          <span className="text-primary font-semibold">{pts}pts</span>
        </InfoText>
      </PoppingTitle>
    </InfoBox>
  );
};
