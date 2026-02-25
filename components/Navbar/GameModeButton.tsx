'use client';

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Gamepad2 } from "lucide-react";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameStore } from "@/components/default/games";
import { useSession } from "next-auth/react";

export const GameModeButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = useAppSelector((state) => state.options);
  const currentMode = options.mode;
  const isGameMode = currentMode === "game";
  const { data: session } = useSession();
  const getCurrentGame = useGameStore((state) => state.getCurrentGame);
  const game = getCurrentGame();
  const isGameOwner = game?.userId && (session?.userId === game.userId || session?.user?.email === game.userId);

  const enterGameMode = useCallback(() => {
    // Navigate to game mode
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, searchParams, router]);

  // Don't show button if already in game mode or if user is not the game owner
  if (isGameMode || !isGameOwner) {
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




