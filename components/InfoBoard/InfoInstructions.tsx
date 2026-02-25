'use client';

import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppSelector } from "@/store/hooks/hooks";
import { Info } from "lucide-react";
import InfoGuide from "./InfoGuide";
import PoppingTitle from "../General/PoppingTitle";

type InfoInstructionsProps = {
  children: React.ReactNode;
};

export const InfoInstructions = ({ children }: InfoInstructionsProps) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  
  // Early return if level doesn't exist
  if (!level) {
    return <div id="instructions-box" className="flex justify-center items-center">{children}</div>;
  }
  
  const instructions = level.instructions;
  
  return (
    <div id="instructions-box" className="flex justify-center items-center">
      {children}
      <Popover>
        <PopoverTrigger className="m-0 p-0">
          <PoppingTitle topTitle="Level Instructions">
            <Info className="h-6 w-6" />
          </PoppingTitle>
        </PopoverTrigger>
        <PopoverContent className="flex flex-col justify-center items-center m-0 w-full max-w-screen">
    
          <InfoGuide sections={instructions} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default InfoInstructions;
