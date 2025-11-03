/** @format */
'use client';

import { useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import InfoInput from "./InfoInput";

// create prop interface
interface LevelDataProps {
  reduxState: string;
  actionToDispatch?: any;
  dataType?: string;
}

export const LevelData = ({
  reduxState,
  actionToDispatch,
  dataType,
}: LevelDataProps) => {
  // get redux state
  const [editing, setEditing] = useState(false);

  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const detail = useAppSelector(
    (state: any) => state.levels[currentLevel - 1][reduxState]
  );

  const options = useAppSelector((state) => state.options);

  const isCreator = options.creator;

  const finishEditHandler = () => {
    setEditing(false);
  };

  // if in creator mode, show an input instead of text

  if (isCreator && actionToDispatch && editing) {
    return (
      <InfoInput
        actionToDispatch={actionToDispatch}
        reduxState={reduxState}
        dataType={dataType || "number"}
        finishEditHandler={finishEditHandler}
      />
    );
  }

  const clickHandler = () => {
    if (isCreator) {
      setEditing(true);
    }
  };

  return (
    <span onClick={clickHandler} className={isCreator ? "cursor-pointer" : ""}>
      {detail}
    </span>
  );
};
