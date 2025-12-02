// Temporary stub for sidebar - will be replaced with full implementation later
import { create } from "zustand";

interface SidebarStore {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const useSidebarCollapseStore = create<SidebarStore>((set) => ({
  isCollapsed: false,
  setIsCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
}));

export function useSidebarCollapse() {
  return useSidebarCollapseStore();
}

