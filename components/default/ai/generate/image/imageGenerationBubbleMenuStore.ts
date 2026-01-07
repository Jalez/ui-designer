import { create } from "zustand";

interface ImageGenerationBubbleMenuState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useImageGenerationBubbleMenu = create<ImageGenerationBubbleMenuState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));



