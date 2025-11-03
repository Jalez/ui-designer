'use client';

import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAppSelector } from "@/store/hooks/hooks";
import { ChevronDown, Info } from "lucide-react";
import InfoGuide from "./InfoGuide";
import PoppingTitle from "../General/PoppingTitle";

type InfoInstructionsProps = {
  children: React.ReactNode;
};

export const InfoInstructions = ({ children }: InfoInstructionsProps) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const instructions = level.instructions;
  // <StyledSection>
  // </StyledSection>
  return (
    <Accordion type="single" collapsible className="bg-secondary text-primary border-none shadow-none p-0 m-0 w-full">
      <AccordionItem value="instructions" className="border-none">
        <div
          id="instructions-box"
          className="flex justify-center items-center"
        >
          {children}
          <AccordionTrigger className="m-0 p-0">
            <PoppingTitle topTitle="Level Instructions">
              <Info className="h-6 w-6" />
            </PoppingTitle>
          </AccordionTrigger>
        </div>
        <AccordionContent className="flex flex-col justify-center items-center bg-secondary text-primary p-0 m-0">
          <InfoGuide sections={instructions} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default InfoInstructions;
