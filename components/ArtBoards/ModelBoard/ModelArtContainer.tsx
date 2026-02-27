/** @format */
'use client';

// ModelArtContainer.tsx
import { Frame } from "../Frame";
import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";

type ModelArtContainerProps = {
  children: React.ReactNode;
  scenario: scenario;
};

export const ModelArtContainer = ({
  children,
  scenario,
}: ModelArtContainerProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state: any) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];

  // Select the specific CSS/HTML/JS values directly to avoid re-renders
  // from reference changes on the whole level/solutions objects
  const solutionCSS = useAppSelector((state) => {
    const l = state.levels[state.currentLevel.currentLevel - 1];
    const sol = state.solutions as Record<string, { css?: string; html?: string; js?: string }>;
    return l?.solution?.css || sol[l?.name]?.css || '';
  });
  const solutionHTML = useAppSelector((state) => {
    const l = state.levels[state.currentLevel.currentLevel - 1];
    const sol = state.solutions as Record<string, { css?: string; html?: string; js?: string }>;
    return l?.solution?.html || sol[l?.name]?.html || '';
  });
  const solutionJS = useAppSelector((state) => {
    const l = state.levels[state.currentLevel.currentLevel - 1];
    const sol = state.solutions as Record<string, { css?: string; html?: string; js?: string }>;
    return l?.solution?.js || sol[l?.name]?.js || '';
  });

  if (!level) return null;

  // decode with base64
  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {!solutionUrl && (
        <Frame
          id="DrawBoard"
          newCss={solutionCSS}
          newHtml={solutionHTML}
          newJs={solutionJS + "\n" + scenario.js}
          events={level.events || []}
          scenario={scenario}
          name="solutionUrl"
        />
      )}
      {children}
    </ArtContainer>
  );
};
