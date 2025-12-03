"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { setupIframeThemeListener, type Theme } from "./iframeThemeListener";

/**
 * IframeThemeOverride Component
 *
 * This component detects when the app is running in an iframe and overrides
 * the theme selection with messages received from the parent iframe.
 *
 * It should be placed inside a ThemeProvider to work correctly.
 */
export const IframeThemeOverride: React.FC = () => {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    // Only set up iframe theme listener if we're running in an iframe
    const isInIframe = window.self !== window.top;

    if (!isInIframe) {
      return;
    }

    console.log("CLIENT: IFRAME-THEME: Setting up iframe theme listener");

    // Set up listener for theme change messages from parent iframe
    const cleanup = setupIframeThemeListener((receivedTheme: Theme) => {
      console.log(`CLIENT: IFRAME-THEME: Received theme override from parent: ${receivedTheme}`);
      setTheme(receivedTheme);
    });

    // Cleanup on unmount
    return cleanup;
  }, [setTheme]);

  return null; // This component doesn't render anything
};
