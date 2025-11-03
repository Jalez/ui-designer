'use client';

import {
  setDarkMode,
  setShowWordCloud,
} from "@/store/slices/options.slice";
import HelpModal from "@/components/Help/Help";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Sun, RotateCcw } from "lucide-react";
import LevelControls from "@/components/General/LevelControls/LevelControls";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { resetLevel } from "@/store/slices/levels.slice";
import { useCallback, useEffect, useRef, useState } from "react";
import PoppingTitle from "@/components/General/PoppingTitle";
import CreatorControls from "@/components/CreatorControls/CreatorControls";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import InfoInstructions from "../InfoBoard/InfoInstructions";
import Info from "../InfoBoard/Info";
import Timer from "../General/Timer";
import InfoBox from "../InfoBoard/InfoBox";
import InfoGamePoints from "../InfoBoard/InfoGamePoints";

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const level = levels[currentLevel - 1];
  const arrowRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const levelChanger = useCallback((pickedLevel: number) => {
    dispatch(setCurrentLevel(pickedLevel));
  }, []);

  const toggleWordCloud = useCallback(() => {
    dispatch(setShowWordCloud(!options.showWordCloud));
  }, [options.showWordCloud]);

  const toggleDarkMode = useCallback(() => {
    dispatch(setDarkMode(!options.darkMode));
  }, [options.darkMode]);

  const handleLevelReset = useCallback(() => {
    dispatch(resetLevel(currentLevel));
    dispatch(resetSolutionUrls());
  }, [currentLevel]);

  const togglePopper = useCallback(() => {
    setAnchorEl(arrowRef.current);
  }, [arrowRef]);

  const handleAnchorElReset = useCallback(() => {
    setAnchorEl(null);
  }, []);

  if (!level) return null;

  return (
      <div
        className="flex flex-row justify-around items-center w-full h-fit"
      >
        {isCreator && (
          <div className="flex flex-row gap-4 justify-center items-center flex-[1_0_25%]">
            <CreatorControls />
          </div>
        )}
                  {!isCreator && (
            <InfoBox>
              <Timer />
            </InfoBox>
          )}
          <InfoGamePoints />

        <NavPopper
          anchorEl={anchorEl}
          paragraph="This is an irreversible action. All progress will be lost, but timer is not affected. Are you sure you want to reset the level?"
          title="Reset Level"
          handleConfirmation={handleLevelReset}
          resetAnchorEl={handleAnchorElReset}
        />
        <div className="flex flex-row gap-4 justify-center items-center flex-[1_0_50%]">
          <PoppingTitle topTitle="Reset Level">
            <Button
              size="icon"
              variant="ghost"
              title="Reset Level"
              ref={arrowRef}
              onClick={togglePopper}
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </PoppingTitle>
          <PoppingTitle topTitle="Help">
            <HelpModal />
          </PoppingTitle>
          <LevelControls
            currentlevel={currentLevel}
            levelHandler={levelChanger}
            maxLevels={Object.keys(levels).length}
            levelName={level.name}
          />
          <PoppingTitle topTitle="Toggle Dark Mode">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleDarkMode}
              title="Toggle Dark Mode"
            >
              <Sun className="h-5 w-5" />
            </Button>
          </PoppingTitle>
   
        </div>
      </div>
  );
};

type NavPopperProps = {
  anchorEl: any;
  paragraph: string;
  title: string;
  handleConfirmation: () => void;
  resetAnchorEl?: () => void;
};

export const NavPopper = ({
  anchorEl,
  paragraph,
  title,
  handleConfirmation,
  resetAnchorEl,
}: NavPopperProps) => {
  const [openPopper, setOpenPopper] = useState(false);

  useEffect(() => {
    // whenever anchorEl changes, set openPopper to true
    if (anchorEl) {
      setOpenPopper(true);
    }
  }, [anchorEl]);

  useEffect(() => {
    // if openPopper is true, start a timer to close it after 10 seconds
    if (openPopper) {
      const timer = setTimeout(() => {
        setOpenPopper(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      resetAnchorEl && resetAnchorEl();
    }
  }, [openPopper, resetAnchorEl]);

  const confirmationAndClose = () => {
    handleConfirmation();
    setOpenPopper(false);
  };
  const handleClose = useCallback(() => setOpenPopper(false), []);

  return (
    <Dialog open={openPopper} onOpenChange={setOpenPopper}>
      <DialogContent className="z-[1200]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[0.7rem] w-[250px]">
            {paragraph}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            onClick={confirmationAndClose}
            variant="outline"
          >
            Yes
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
          >
            No
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
