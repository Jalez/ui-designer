"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNotificationStore } from ".";

export function NotificationProvider() {
  const { message, type, isVisible } = useNotificationStore();
  const currentToastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    // Dismiss previous toast if it exists
    if (currentToastIdRef.current !== null) {
      toast.dismiss(currentToastIdRef.current);
      currentToastIdRef.current = null;
    }

    if (isVisible && message) {
      // Show toast based on notification type using Sonner's API
      // Store the toast ID so we can dismiss it later
      switch (type) {
        case "success":
          currentToastIdRef.current = toast.success(message);
          break;
        case "error":
          currentToastIdRef.current = toast.error(message);
          break;
        case "loading":
          currentToastIdRef.current = toast.loading(message);
          break;
        default:
          currentToastIdRef.current = toast(message);
      }
    }
  }, [message, type, isVisible]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (currentToastIdRef.current !== null) {
        toast.dismiss(currentToastIdRef.current);
      }
    };
  }, []);

  return null; // This component doesn't render anything
}
