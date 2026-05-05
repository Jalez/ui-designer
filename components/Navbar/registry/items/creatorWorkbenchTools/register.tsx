"use client";

import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CompactMenuButton } from "@/components/General/CompactMenuButton";
import type { CreatorWorkbenchSubnavTabId } from "@/components/Navbar/useCreatorWorkbenchPanels";
import { Gamepad2, Layers3, MousePointer, Settings, Wrench } from "lucide-react";
import type { NavbarRegistryItem } from "../../types";

const CREATOR_WORKBENCH_SUBNAV_TABS: Array<{
  id: CreatorWorkbenchSubnavTabId;
  label: string;
  tooltip: string;
  icon: typeof Settings;
}> = [
  {
    id: "creator",
    label: "Levels",
    tooltip: "Level save, generation, and map tools",
    icon: Settings,
  },
  {
    id: "events",
    label: "Events",
    tooltip: "Record an event sequence for the selected scenario.",
    icon: MousePointer,
  },
  {
    id: "variants",
    label: "Variants",
    tooltip: "View and manage level variants.",
    icon: Layers3,
  },
  {
    id: "game",
    label: "Game",
    tooltip: "Game navigation and settings",
    icon: Gamepad2,
  },
];

export const registerCreatorWorkbenchTools = (): NavbarRegistryItem => ({
  id: "creator-workbench-tools",
  order: 10,
  placement: "compact-workbench",
  render: (context, slot = "desktop") => (
    <div className="flex flex-none" {...context.tourSpotProps("navbar.creator_workbench_tools", slot)}>
      <div className="rounded-md px-2 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <CompactMenuButton
              icon={Wrench}
              label="Tools"
              text="Tools"
              title="Choose which sidebar tool panels to show"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 border-0 shadow-lg">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Sidebar panels
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CREATOR_WORKBENCH_SUBNAV_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <DropdownMenuCheckboxItem
                  key={tab.id}
                  checked={context.creatorWorkbenchPanels[tab.id]}
                  onCheckedChange={(checked) => {
                    context.onSetCreatorWorkbenchPanels((prev) => ({
                      ...prev,
                      [tab.id]: checked === true,
                    }));
                  }}
                  onSelect={(event) => event.preventDefault()}
                  title={tab.tooltip}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  {tab.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  ),
});
