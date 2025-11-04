/** @format */
'use client';

// ModelArtContainer.tsx
import { Frame } from "../Frame";
import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { useEffect, useState } from "react";

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
  const solutions = useAppSelector((state: any) => state.solutions);
  const defaultLevelSolutions = solutions[level.name] || null;
  const [solutionCSS, setSolutionCSS] = useState<string>(
    defaultLevelSolutions?.css || ""
  );
  const [solutionHTML, setSolutionHTML] = useState<string>(
    defaultLevelSolutions?.html || ""
  );
  const [solutionJS, setSolutionJS] = useState<string>(
    defaultLevelSolutions?.js || ""
  );
  const solutionUrls = useAppSelector((state) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];

  useEffect(() => {
    const levelSolutions = solutions[level.name] || null;
    if (levelSolutions) {
      setSolutionCSS(levelSolutions.css);
      setSolutionHTML(levelSolutions.html);
      setSolutionJS(levelSolutions.js);
    }
  }, [level, solutions]);

  if (!level) return <div>loading...</div>;

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
