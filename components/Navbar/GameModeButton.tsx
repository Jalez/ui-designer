'use client';

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Gamepad2 } from "lucide-react";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";

export const GameModeButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = useAppSelector((state) => state.options);
  const currentMode = options.mode;
  const isGameMode = currentMode === "game";

  const enterGameMode = useCallback(() => {
    // Navigate to game mode
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, searchParams, router]);

  // Don't show button if already in game mode
  if (isGameMode) {
    return null;
  }

  return (
    <PoppingTitle topTitle="Enter Game Mode">
      <Button
        size="icon"
        variant="ghost"
        title="Enter Game Mode"
        onClick={enterGameMode}
      >
        <Gamepad2 className="h-5 w-5" />
      </Button>
    </PoppingTitle>
  );
};




