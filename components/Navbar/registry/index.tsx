"use client";

import type { NavbarPlacement, NavbarRegistryContext, NavbarRegistryItem, NavbarRegistrySection, NavbarResponsiveSlot } from "./types";
import { registerModeToggle, registerDefaultFinish, registerDefaultScore } from "./items/defaultLanding/register";
import { registerCreatorWorkbenchTools } from "./items/creatorWorkbenchTools/register";
import { registerGameRouteMenu } from "./items/gameRouteMenu/register";
import { registerCompactPlayerLevelSelect, registerCreatorLevelSelect, registerInlinePlayerLevelSelect } from "./items/levelSelect/register";
import { registerPlayerCompactGame } from "./items/playerCompactGame/register";
import { registerPlayerInlineFinish, registerPlayerInlineLobby, registerPlayerInlineScore } from "./items/playerInlineStatus/register";
import { registerCreatorSidebarToggle, registerMobilePlayerSidebarToggle } from "./items/sidebarToggle/register";
import { registerCreatorWorkbenchSection } from "./sections/creator/register";
import { registerEventsWorkbenchSection } from "./sections/events/register";
import { registerGameWorkbenchSection } from "./sections/game/register";
import { registerVariantsWorkbenchSection } from "./sections/variants/register";

export type { NavbarRegistryContext, NavbarResponsiveSlot } from "./types";

const NAVBAR_ITEM_REGISTRY: NavbarRegistryItem[] = [
  registerMobilePlayerSidebarToggle(),
  registerPlayerCompactGame(),
  registerCompactPlayerLevelSelect(),
  registerPlayerInlineScore(),
  registerPlayerInlineLobby(),
  registerPlayerInlineFinish(),
  registerInlinePlayerLevelSelect(),
  registerCreatorSidebarToggle("compact-creator"),
  registerGameRouteMenu(),
  registerCreatorLevelSelect("compact-creator"),
  registerCreatorSidebarToggle("compact-workbench"),
  registerCreatorWorkbenchTools(),
  registerCreatorLevelSelect("compact-workbench"),
  registerModeToggle(),
  registerDefaultScore(),
  registerDefaultFinish(),
];

export function renderNavbarItems(
  placement: NavbarPlacement,
  context: NavbarRegistryContext,
  slot?: NavbarResponsiveSlot,
) {
  return NAVBAR_ITEM_REGISTRY
    .filter((item) => item.placement === placement)
    .sort((left, right) => left.order - right.order)
    .map((item) => (
      <span key={item.id} className="contents">
        {item.render(context, slot)}
      </span>
    ));
}

type EventSectionControls = Parameters<typeof registerEventsWorkbenchSection>[0];

export function buildWorkbenchSections(
  context: NavbarRegistryContext,
  eventControls: EventSectionControls,
): NavbarRegistrySection[] {
  return [
    registerEventsWorkbenchSection(eventControls, context.creatorWorkbenchPanels.events),
    registerCreatorWorkbenchSection(context.creatorWorkbenchPanels.creator),
    registerVariantsWorkbenchSection(context.creatorWorkbenchPanels.variants),
    registerGameWorkbenchSection(context.creatorWorkbenchPanels.game),
  ].sort((left, right) => left.order - right.order);
}
