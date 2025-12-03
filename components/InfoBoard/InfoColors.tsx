/** @format */
'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { InfoColor } from "./InfoColor";
import { useEffect } from "react";
import { updateLevelColors } from "@/store/slices/levels.slice";
import PoppingTitle from "../General/PoppingTitle";

export const InfoColors = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  if (!level) return null;
  useEffect(() => {
    if (isCreator && level.solution) {
      //go through the level solution code and extract the colors, should be rgb or hex
      //store the colors in the level object

      const css = level.solution.css || "";
      const html = level.solution.html || "";
      const js = level.solution.js || "";
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
      dispatch(
        updateLevelColors({ levelId: currentLevel, colors: uniqueColors })
      );
    }
  }, [level.solution]);

  return (
    <PoppingTitle topTitle="Colors" bottomTitle="Click to copy">
      <div className="flex">
        {level.buildingBlocks?.colors?.map((color) => (
          <InfoColor key={Math.random() * 10000} color={color} />
        ))}
      </div>
    </PoppingTitle>
  );
};
