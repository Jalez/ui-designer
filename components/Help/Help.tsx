/** @format */
'use client';

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks/hooks";

export default function Help() {
  const router = useRouter();
  const isCreatorMode = useAppSelector((state) => state.options.creator);

  const handleOpenHelp = () => {
    router.push(isCreatorMode ? "/help" : "/help/game");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="help"
      onClick={handleOpenHelp}
      className="shadow-none border-none bg-transparent"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
