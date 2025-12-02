import { create } from "zustand";
import type { NotificationActions, NotificationState, NotificationType } from "../types";

export const useNotificationStore = create<NotificationState & NotificationActions>((set, get) => ({
  // Initial state
  message: "",
  type: "loading",
  isVisible: false,

  // Actions
  showNotification: (message: string, type: NotificationType = "loading") => {
    set({
      message,
      type,
      isVisible: true,
    });

    // Auto-dismiss success notifications
    if (type === "success") {
      setTimeout(() => {
        const currentState = get();
        if (currentState.isVisible && currentState.type === "success") {
          set((prev) => ({ ...prev, isVisible: false }));
        }
      }, 3000); // Auto-dismiss after 3 seconds
    }
  },

  hideNotification: () => {
    set((prev) => ({ ...prev, isVisible: false }));
  },

  showSuccess: (message: string) => {
    get().showNotification(message, "success");
  },

  showError: (message: string) => {
    get().showNotification(message, "error");
  },

  showLoading: (message: string) => {
    get().showNotification(message, "loading");
  },
}));
