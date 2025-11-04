/** @format */
'use client';

import { appVersion } from "@/constants";
import { setDarkMode } from "@/store/slices/options.slice";
import HelpModal from "@/components/Help/Help";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useCallback } from "react";
import InfoInstructions from "../InfoBoard/InfoInstructions";
import Info from "../InfoBoard/Info";

export const Footer = () => {
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);

  const toggleDarkMode = useCallback(() => {
    dispatch(setDarkMode(!options.darkMode));
  }, [options.darkMode, dispatch]);

  return (
    <footer
      className="flex flex-row justify-between items-center p-2 w-full h-fit shrink-0 text-sm"
      style={{
        backgroundColor: 'hsl(var(--footer-bg))',
        color: 'hsl(var(--footer-text))',
      }}
    >
      <div className="flex flex-row gap-2 pointer-events-auto">
        <PoppingTitle topTitle="Help">
          <HelpModal />
        </PoppingTitle>
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
      <InfoInstructions>
            <Info />
          </InfoInstructions>
      <p className="text-sm">
        Inspired by
        <a
          href="https://cssbattle.dev/"
          target="_blank"
          rel="noreferrer"
          className="text-primary m-2 pointer-events-auto"
        >
          <strong>
          CSS Battle
          </strong>
        </a>
      </p>
    </footer>
  );
};
