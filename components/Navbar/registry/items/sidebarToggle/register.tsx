"use client";

import { PanelLeft } from "lucide-react";
import { CompactMenuButton } from "@/components/General/CompactMenuButton";
import type { NavbarRegistryItem } from "../../types";

function renderSidebarToggle(onClick: () => void) {
  return (
    <div className="flex flex-none">
      <div className="rounded-md px-2 py-1.5">
        <CompactMenuButton
          icon={PanelLeft}
          label="Sidebar"
          text="Sidebar"
          onClick={onClick}
          title="Open sidebar"
        />
      </div>
    </div>
  );
}

export const registerMobilePlayerSidebarToggle = (): NavbarRegistryItem => ({
  id: "mobile-player-sidebar-toggle",
  order: 0,
  placement: "compact-player",
  render: (context) => (
    context.shouldShowMobileSidebarToggle ? renderSidebarToggle(context.onOpenOverlay) : null
  ),
});

export const registerCreatorSidebarToggle = (placement: "compact-creator" | "compact-workbench"): NavbarRegistryItem => ({
  id: `${placement}-sidebar-toggle`,
  order: 0,
  placement,
  render: (context) => (
    context.shouldShowCreatorSidebarToggle ? renderSidebarToggle(context.onOpenOverlay) : null
  ),
});
