'use client';

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Code2, Gamepad2 } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameStore } from "@/components/default/games";
import { useSession } from "next-auth/react";
import { stripBasePath } from "@/lib/apiUrl";

type NavbarActionDisplayMode = "icon-label" | "icon";

interface ModeToggleButtonProps {
  displayMode?: NavbarActionDisplayMode;
}

export const ModeToggleButton = ({ displayMode = "icon" }: ModeToggleButtonProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const getCurrentGame = useGameStore((state) => state.getCurrentGame);
  const game = getCurrentGame();
  const sessionUserId = session?.userId || session?.user?.email || "";
  const gameOwnerId = game?.userId || "";
  const canEdit = Boolean(game?.canEdit ?? (gameOwnerId && sessionUserId === gameOwnerId));
  const isCreatorRoute = normalizedPathname.startsWith("/creator/");

  const toggleMode = useCallback(() => {
    if (!game?.id) return;
    if (isCreatorRoute) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", "game");
      router.push(`/game/${game.id}?${params.toString()}`);
      return;
    }
    router.push(`/creator/${game.id}`);
  }, [game, isCreatorRoute, router, searchParams]);

  if (!canEdit || !game?.id) {
    return null;
  }
  const label = isCreatorRoute ? "Switch to Game Mode" : "Switch to Creator Mode";
  const icon = isCreatorRoute ? <Gamepad2 className="h-5 w-5" /> : <Code2 className="h-5 w-5" />;

  const button = (
    <Button
      type="button"
      size={displayMode === "icon-label" ? "sm" : "icon"}
      variant="ghost"
      className={displayMode === "icon-label" ? "justify-start gap-2" : undefined}
      title={label}
      onClick={toggleMode}
    >
      {icon}
      {displayMode === "icon-label" && <span>{label}</span>}
    </Button>
  );

  if (displayMode === "icon-label") {
    return button;
  }

  return (
    <PoppingTitle topTitle={label}>
      {button}
    </PoppingTitle>
  );
};
