"use client";

import InfoGamePoints from "@/components/InfoBoard/InfoGamePoints";
import { AplusSubmitButton } from "@/components/Navbar/AplusSubmitButton";
import { ModeToggleButton } from "@/components/Navbar/ModeToggleButton";
import type { NavbarRegistryItem } from "../../types";

export const registerModeToggle = (): NavbarRegistryItem => ({
  id: "landing-mode-toggle",
  order: 10,
  placement: "mode-toggle",
  render: () => <ModeToggleButton displayMode="icon-label" />,
});

export const registerDefaultScore = (): NavbarRegistryItem => ({
  id: "default-score",
  order: 20,
  placement: "default-status",
  render: () => <InfoGamePoints />,
});

export const registerDefaultFinish = (): NavbarRegistryItem => ({
  id: "default-finish",
  order: 30,
  placement: "default-status",
  render: () => <AplusSubmitButton displayMode="icon-label" />,
});
