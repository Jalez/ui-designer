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
  const solutionUrls = useAppSelector((state: any) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];
  const defaultLevelSolutions = solutions[level.name] || null;
  const levelSolution = level.solution || { css: "", html: "", js: "" };
  const [solutionCSS, setSolutionCSS] = useState<string>(
    levelSolution.css || defaultLevelSolutions?.css || ""
  );
  const [solutionHTML, setSolutionHTML] = useState<string>(
    levelSolution.html || defaultLevelSolutions?.html || ""
  );
  const [solutionJS, setSolutionJS] = useState<string>(
    levelSolution.js || defaultLevelSolutions?.js || ""
  );

  useEffect(() => {
    // level.solution is kept in sync by updateSolutionCode (editor edits), so prefer it.
    // Fall back to solutions slice for levels loaded before the editor updated them.
    const src = level.solution || { css: "", html: "", js: "" };
    const fallback = solutions[level.name] || { css: "", html: "", js: "" };
    setSolutionCSS(src.css || fallback.css || "");
    setSolutionHTML(src.html || fallback.html || "");
    setSolutionJS(src.js || fallback.js || "");
  }, [level, solutions]);

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
