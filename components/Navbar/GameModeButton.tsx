'use client';

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Gamepad2 } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameStore } from "@/components/default/games";
import { useSession } from "next-auth/react";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";

type NavbarActionDisplayMode = "icon-label" | "icon";

interface GameModeButtonProps {
  displayMode?: NavbarActionDisplayMode;
}

export const GameModeButton = ({ displayMode = "icon" }: GameModeButtonProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const getCurrentGame = useGameStore((state) => state.getCurrentGame);
  const game = getCurrentGame();
  const sessionUserId = session?.userId || session?.user?.email || "";
  const gameOwnerId = game?.userId || "";
  const canEdit = Boolean(game?.canEdit ?? (gameOwnerId && sessionUserId === gameOwnerId));
  const isCreatorRoute = useIsCreatorRoute();

  const enterGameMode = useCallback(() => {
    if (!game?.id) return;
    router.push(`/game/${game.id}`);
  }, [game, router]);

  if (!isCreatorRoute || !canEdit || !game?.id) {
    return null;
  }

  const button = (
    <Button
      size={displayMode === "icon-label" ? "sm" : "icon"}
      variant="ghost"
      className={displayMode === "icon-label" ? "w-full justify-start gap-2" : undefined}
      title="Go to game route"
      onClick={enterGameMode}
    >
      <Gamepad2 className="h-5 w-5" />
      {displayMode === "icon-label" && <span>Play</span>}
    </Button>
  );

  if (displayMode === "icon-label") {
    return button;
  }

  return (
    <PoppingTitle topTitle="Go to game route">
      {button}
    </PoppingTitle>
  );
};
