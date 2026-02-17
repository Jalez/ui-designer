/** @format */
'use client';

import HelpModal from "@/components/Help/Help";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";
import InfoInstructions from "../InfoBoard/InfoInstructions";
import Info from "../InfoBoard/Info";
import { useEffect, useState } from "react";

function useRelativeTime(timestamp: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!timestamp) { setLabel(null); return; }

    const update = () => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 10) setLabel("just now");
      else if (seconds < 60) setLabel(`${seconds}s ago`);
      else setLabel(`${Math.floor(seconds / 60)}m ago`);
    };

    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [timestamp]);

  return label;
}

export const Footer = () => {
  const options = useAppSelector((state) => state.options);
  const lastSavedLabel = useRelativeTime(options.lastSaved);

  return (
    <footer
      className="flex flex-row justify-between items-center p-2 w-full h-fit shrink-0 text-sm border-t"
    >
      <div className="flex flex-row gap-2 pointer-events-auto">
        <PoppingTitle topTitle="Help">
          <HelpModal />
        </PoppingTitle>
      </div>
      <InfoInstructions>
        <Info />
      </InfoInstructions>
      <div className="flex items-center gap-4">
        {options.creator && (
          <span className="text-xs text-muted-foreground">
            {lastSavedLabel ? `Saved ${lastSavedLabel}` : "Unsaved"}
          </span>
        )}
        <p className="text-sm">
          Inspired by
          <a
            href="https://cssbattle.dev/"
            target="_blank"
            rel="noreferrer"
            className="text-primary m-2 pointer-events-auto"
          >
            <strong>CSS Battle</strong>
          </a>
        </p>
      </div>
    </footer>
  );
};
