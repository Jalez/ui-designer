'use client';

import {
  setShowWordCloud,
  setActiveArtTab,
} from "@/store/slices/options.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { RotateCcw, Menu, PanelLeft } from "lucide-react";
import LevelControls from "@/components/General/LevelControls/LevelControls";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { resetLevel } from "@/store/slices/levels.slice";
import { useCallback, useEffect, useRef, useState } from "react";
import PoppingTitle from "@/components/General/PoppingTitle";
import CreatorControls from "@/components/CreatorControls/CreatorControls";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InfoGamePoints from "../InfoBoard/InfoGamePoints";
import { Switch } from "@/components/ui/switch";
import { ModeToggleButton } from "./ModeToggleButton";
import { GameModeButton } from "./GameModeButton";
import { GameSettings } from "./GameSettings";
import { AplusSubmitButton } from "./AplusSubmitButton";

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const { openOverlay, isVisible } = useSidebarCollapse();
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

  const activeArtTab = options.activeArtTab;
  const handleArtTabSwitch = useCallback(() => {
    dispatch(setActiveArtTab(activeArtTab === 0 ? 1 : 0));
  }, [activeArtTab, dispatch]);

  if (!level) return null;

  return (
      <div
        className="flex flex-row justify-around items-center w-full h-fit gap-2"
      >
        {/* Sidebar Toggle Button - Only visible on small screens */}
        {isVisible && (
          <div className="sm:hidden">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={openOverlay}
              title="Open sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Mobile Menu Button - Only visible on small screens */}
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {/* Art tab switch or creator controls */}
              {isCreator ? (
                <div className="px-2 py-1.5">
                  <CreatorControls />
                </div>
              ) : (
                <DropdownMenuItem
                  onClick={handleArtTabSwitch}
                  className="cursor-pointer"
                >
                  <Switch
                    checked={activeArtTab === 1}
                    onCheckedChange={handleArtTabSwitch}
                    className="pointer-events-none scale-75"
                  />
                  <span>{activeArtTab === 0 ? "Model solution" : "Your design"}</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Tools row */}
              <div className="flex items-center justify-center gap-1 px-2 py-1.5">
                <ModeToggleButton />
                <GameModeButton />
                <GameSettings />
                <AplusSubmitButton />
                <PoppingTitle topTitle="Reset Level">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Reset Level"
                    onClick={togglePopper}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </PoppingTitle>
              </div>

              <DropdownMenuSeparator />

              {/* Points */}
              <div className="flex items-center justify-center px-2 py-1.5">
                <InfoGamePoints />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Left section - Creator controls or Art tab switch - Hidden on mobile */}
        <div className="hidden sm:flex flex-row gap-4 justify-center items-center flex-[1_0_25%]">
          {isCreator ? (
            <CreatorControls />
          ) : (
            <PoppingTitle topTitle={activeArtTab === 0 ? "Model solution" : "Your design"}>
              <Switch checked={activeArtTab === 1} onCheckedChange={handleArtTabSwitch} />
            </PoppingTitle>
          )}
        </div>

        {/* Center section - Mode toggle, Reset, and Level controls */}
        <div className="flex flex-row gap-2 sm:gap-4 justify-center items-center flex-1 sm:flex-[1_0_50%]">
          {/* Mode toggle, Game mode, and Game Settings - Hidden on mobile */}
          <div className="hidden sm:flex gap-2">
            <ModeToggleButton />
            <GameModeButton />
            <GameSettings />
          </div>

          {/* Reset button - Hidden on mobile */}
          <div className="hidden sm:block">
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
          </div>

          {/* Level controls - Always visible */}
          <LevelControls
            currentlevel={currentLevel}
            levelHandler={levelChanger}
            maxLevels={Object.keys(levels).length}
            levelName={level.name}
          />
        </div>

        {/* Right section - Game points + A+ submit */}
        <div className="hidden sm:flex flex-[1_0_25%] justify-center items-center gap-3">
          <InfoGamePoints />
          <AplusSubmitButton />
        </div>

        {/* Dialog for reset confirmation */}
        <NavPopper
          anchorEl={anchorEl}
          paragraph="This is an irreversible action. All progress will be lost, but timer is not affected. Are you sure you want to reset the level?"
          title="Reset Level"
          handleConfirmation={handleLevelReset}
          resetAnchorEl={handleAnchorElReset}
        />
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
