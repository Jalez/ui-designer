/** @format */
'use client';

import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks/hooks";
import { InfoColor } from "./InfoColor";
import { useEffect } from "react";
import { updateLevelColors } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import PoppingTitle from "../General/PoppingTitle";

function colorListsEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

export const InfoColors = () => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { syncLevelFields } = useLevelMetaSync();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";

  const solutionCss = level?.solution?.css ?? "";
  const solutionHtml = level?.solution?.html ?? "";
  const solutionJs = level?.solution?.js ?? "";

  useEffect(() => {
    if (!isCreator) {
      return;
    }
    const lvl = store.getState().levels[currentLevel - 1];
    if (!lvl?.solution) {
      return;
    }
    //go through the level solution code and extract the colors, should be rgb or hex
    //store the colors in the level object
    const css = solutionCss;
    const html = solutionHtml;
    const js = solutionJs;
    const cssColors =
      css.match(
        /#[0-9a-fA-F]{3,6}|rgb\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\)/g
      ) || [];
    const htmlColors =
      html.match(
        /#[0-9a-fA-F]{3,6}|rgb\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\)/g
      ) || [];

    const jsColors =
      js.match(
        /#[0-9a-fA-F]{3,6}|rgb\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\)/g
      ) || [];

    const colors = [...cssColors, ...htmlColors, ...jsColors];
    //Make sure the list of colors only has unique values
    const uniqueColors = Array.from(new Set(colors));
    const previousColors = lvl.buildingBlocks?.colors ?? [];
    if (colorListsEqual(previousColors, uniqueColors)) {
      return;
    }
    dispatch(
      updateLevelColors({ levelId: currentLevel, colors: uniqueColors })
    );
    syncLevelFields(currentLevel - 1, ["buildingBlocks"]);
  }, [
    currentLevel,
    dispatch,
    isCreator,
    solutionCss,
    solutionHtml,
    solutionJs,
    store,
    syncLevelFields,
  ]);

  if (!level) return null;

  return (
    <PoppingTitle topTitle="Colors" bottomTitle="Click to copy">
      <div className="flex flex-row flex-wrap items-center justify-center gap-1.5">
        {level.buildingBlocks?.colors?.map((color) => (
          <InfoColor key={color} color={color} />
        ))}
      </div>
    </PoppingTitle>
  );
};
