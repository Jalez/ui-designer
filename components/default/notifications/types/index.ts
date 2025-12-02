/**
 * Notification Module Types
 *
 * Types for UI notifications only
 */

// Notification types
export type NotificationType = "loading" | "success" | "error";

export interface NotificationState {
  message: string;
  type: NotificationType;
  isVisible: boolean;
}

export interface NotificationActions {
  showNotification: (message: string, type?: NotificationType) => void;
  hideNotification: () => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showLoading: (message: string) => void;
}
