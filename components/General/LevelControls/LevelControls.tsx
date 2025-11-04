'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, Edit } from "lucide-react";
import { NavPopper } from "@/components/Navbar/Navbar";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import LevelOpinion from "./LevelOpinion";
import { updateLevelName } from "@/store/slices/levels.slice";
import Difficulty from "@/components/InfoBoard/Difficulty";
import { LevelData } from "@/components/InfoBoard/LevelData";
import { InfoText } from "@/components/InfoBoard/InfoText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LevelControlsProps {
  maxLevels: number;
  levelHandler: (level: number) => void;
  currentlevel: number;
  levelName?: string;
}

const LevelControls = ({
  maxLevels,
  levelHandler,
  currentlevel,
  levelName,
}: LevelControlsProps) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const levels = useAppSelector((state) => state.levels);
  const forwardArrowRef = React.useRef(null);
  const options = useAppSelector((state) => state.options);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const [editName, setEditName] = useState(false);
  const isCreator = options.creator;
  const dispatch = useAppDispatch();
  const [name, setName] = React.useState(levelName || "Unnamed");

  // take each of the level names for the select

  const decreaseLevel = () => {
    levelHandler(currentlevel - 1);
  };

  useEffect(() => {
    setName(levelName || "Unnamed");
  }, [levelName, currentlevel]);

  const increaseLevelConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    // if the next level timer has not started, confirm
    const nextLevel = levels[currentlevel];
    if (nextLevel && !nextLevel.timeData.startTime) {
      setAnchorEl(forwardArrowRef.current);
      return;
    }
    increaseLevel();
  };
  const increaseLevel = () => {
    levelHandler(currentlevel + 1);
  };

  const resetAnchorEl = () => {
    setAnchorEl(null);
  };

  const updateLevelNameHandler = (name: string) => {
    dispatch(updateLevelName({ levelId: currentlevel, text: name }));
  };

  const changeLevelName = (name: string) => {
    setName(name);
  };

  return (
    <>
      <NavPopper
        anchorEl={anchorEl}
        paragraph="Are you sure you want to go to the next level? Timer for the next level will start immediately if you proceed."
        title="Next Level"
        handleConfirmation={increaseLevel}
        resetAnchorEl={resetAnchorEl}
      />
      <div
        className="flex justify-center items-center"
        ref={forwardArrowRef}
      >
        <strong>
          {currentlevel}/{maxLevels}
        </strong>
        <Button
          size="icon"
          variant="ghost"
          disabled={currentlevel === 1}
          className={currentlevel === 1 ? "invisible" : "visible"}
          onClick={decreaseLevel}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col justify-center items-center m-0 p-0">
          <div className="text-base flex flex-col justify-center items-center">
            {/* {levelName && <>"The {levelName}"</>} */}
          </div>
          {(levels.length > 1 && <LevelSelect levelHandler={levelHandler} />) || (
            <InfoText>
              <LevelData
                dataType={"string"}
                reduxState="name"
                actionToDispatch={updateLevelName}
              />
            </InfoText>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          disabled={currentlevel === maxLevels}
          className={currentlevel === maxLevels ? "invisible" : "visible"}
          onClick={increaseLevelConfirm}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
          <Difficulty />
      </div>
    </>
  );
};

const getSyntaxIcons = (level: any) => {
  if (!level) return null;

  const icons = [];
  if (!level.lockHTML) {
    icons.push(
      <img
        key="html"
        src="/html.svg"
        alt="HTML"
        title="HTML"
        className="h-4 w-4 inline"
      />
    );
  }
  if (!level.lockCSS) {
    icons.push(
      <img
        key="css"
        src="/css3.svg"
        alt="CSS"
        title="CSS"
        className="h-4 w-4 inline"
      />
    );
  }
  if (!level.lockJS) {
    icons.push(
      <img
        key="js"
        src="/Javascript-shield.svg"
        alt="JavaScript"
        title="JavaScript"
        className="h-4 w-4 inline"
      />
    );
  }
  return icons;
};

const LevelSelect = ({ levelHandler }: { levelHandler: (level: number) => void }) => {
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const currentLevelData = levels[currentLevel - 1];
  const [showEdit, setShowEdit] = React.useState(false);
  const [openEditor, setOpenEditor] = React.useState(false);
  const handleClickToEdit = () => {
    setOpenEditor(true);
  };

  const stateOptions = useAppSelector((state) => state.options);
  const isCreator = stateOptions.creator;
  const dispatch = useAppDispatch();

  const updateLevelNameHandler = (name: string) => {
    dispatch(updateLevelName({ levelId: currentLevel, text: name }));
  };

  const handleNameChange = (name: string) => {
    // This would update local state if needed
  };

  const levelSelectHandler = (selectedLevelName: string) => {
    const levelIndex = levels.findIndex(
      (level) => level.name === selectedLevelName
    );
    levelHandler(levelIndex + 1);
  };

  return (
    <div
      className="min-w-[120px] text-primary"
      onMouseEnter={() => setShowEdit(true)}
      onMouseLeave={() => setShowEdit(false)}
    >
      {openEditor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateLevelNameHandler(currentLevelData?.name || "");
            setOpenEditor(false);
          }}
          className="flex flex-row"
        >
          <Input
            className="text-primary border-primary bg-primary"
            value={currentLevelData?.name || ""}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => {
              updateLevelNameHandler(currentLevelData?.name || "");
              setOpenEditor(false);
            }}
          />
        </form>
      )}
      {!openEditor && (
        <div className="flex flex-row items-center gap-2">
          <Select value={currentLevelData?.name || ""} onValueChange={levelSelectHandler}>
            <SelectTrigger className="text-primary border-b-2 border-secondary hover:border-secondary focus:border-primary focus:outline-none px-2 py-1 h-auto font-normal min-w-[200px]">
              <SelectValue placeholder="Select level">
                <div className="flex items-center justify-between w-full gap-2">
                  <span>The {currentLevelData?.name || "Unnamed"}</span>
                  <div className="flex gap-1">
                    {getSyntaxIcons(currentLevelData)}
                  </div>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-lg min-w-[300px]">
              {levels.map((level, index) => (
                <SelectItem key={index} value={level.name}>
                  <div className="flex items-center justify-between w-full gap-2 w-200 bg-red-500">
                    <span className="flex-1">The {level.name}</span>
                    <div className="flex gap-1">
                      {getSyntaxIcons(level)}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isCreator && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClickToEdit}
              className={showEdit ? "visible" : "invisible"}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default LevelControls;
