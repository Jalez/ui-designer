"use client";

import type { NavbarRegistryItem } from "../../types";
import { LevelSelectItem } from "./component";

export const registerCompactPlayerLevelSelect = (): NavbarRegistryItem => ({
  id: "player-compact-level-select",
  order: 20,
  placement: "compact-player",
  render: (context) => (
    <LevelSelectItem
      levelHandler={context.levelChanger}
      spot="navbar.game_route_levels"
      slot="mobile"
      tourSpotProps={context.tourSpotProps}
    />
  ),
});

export const registerInlinePlayerLevelSelect = (): NavbarRegistryItem => ({
  id: "player-inline-level-select",
  order: 40,
  placement: "inline-player",
  render: (context) => (
    <LevelSelectItem
      levelHandler={context.levelChanger}
      spot="navbar.game_route_levels"
      slot="desktop"
      tourSpotProps={context.tourSpotProps}
    />
  ),
});

export const registerCreatorLevelSelect = (placement: "compact-creator" | "compact-workbench"): NavbarRegistryItem => ({
  id: `${placement}-level-select`,
  order: 30,
  placement,
  render: (context, slot = "desktop") => (
    <LevelSelectItem
      levelHandler={context.levelChanger}
      spot="navbar.creator_levels"
      slot={slot}
      tourSpotProps={context.tourSpotProps}
    />
  ),
});
