/** @format */
'use client';

import { appVersion } from "@/constants";
import HelpModal from "@/components/Help/Help";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";
import InfoInstructions from "../InfoBoard/InfoInstructions";
import Info from "../InfoBoard/Info";

export const Footer = () => {
  const options = useAppSelector((state) => state.options);

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
