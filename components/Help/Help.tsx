/** @format */
'use client';

import * as React from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks/hooks";
import { HelpModal } from "./HelpModal";

export default function Help() {
  const isCreatorMode = useAppSelector((state) => state.options.mode === "creator");

  return (
    <HelpModal
      mode={isCreatorMode ? "creator" : "game"}
      trigger={(
        <Button
          variant="ghost"
          size="icon"
          aria-label="help"
          className="shadow-none border-none bg-transparent"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      )}
    />
  );
}
