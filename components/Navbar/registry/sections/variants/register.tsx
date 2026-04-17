"use client";

import { LevelVariantsPanel } from "@/components/CreatorControls/LevelVariantsPanel";
import type { NavbarRegistrySection } from "../../types";

export function registerVariantsWorkbenchSection(visible: boolean): NavbarRegistrySection {
  return {
    id: "variants",
    order: 30,
    build: () => ({
      id: "variants",
      visible,
      title: "Variants",
      children: <LevelVariantsPanel />,
    }),
  };
}
