"use client";

import CreatorControls from "@/components/CreatorControls/CreatorControls";
import type { NavbarRegistrySection } from "../../types";

export function registerCreatorWorkbenchSection(visible: boolean): NavbarRegistrySection {
  return {
    id: "creator",
    order: 20,
    build: () => ({
      id: "creator",
      visible,
      title: "Levels",
      children: <CreatorControls displayMode="sidebar" />,
    }),
  };
}
