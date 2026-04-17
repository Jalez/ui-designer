"use client";

import type { NavbarRegistryItem } from "../../types";
import { PlayerCompactGame } from "./component";

export const registerPlayerCompactGame = (): NavbarRegistryItem => ({
  id: "player-compact-game",
  order: 10,
  placement: "compact-player",
  render: (context) => <PlayerCompactGame context={context} />,
});
