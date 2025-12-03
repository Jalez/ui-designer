/**
 * Iframe Theme Listener Utility
 *
 * This utility allows an application to respond to theme change messages
 * sent from parent iframes. Useful when your app is embedded in other sites
 * that want to control its theme.
 *
 * Usage in your app (for receiving theme changes):
 *
 * ```typescript
 * import { setupIframeThemeListener } from './lib/iframeThemeListener';
 *
 * // Set up listener for theme change messages from parent iframes
 * setupIframeThemeListener((theme) => {
 *   // Apply the theme change to your app
 *   setTheme(theme);
 *   // You might also want to save to localStorage or update your theme context
 * });
 * ```
 *
 * Usage when embedding other apps (for sending theme changes):
 *
 * ```typescript
 * import { sendThemeToIframe } from './lib/iframeThemeListener';
 *
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * sendThemeToIframe(iframe, 'dark');
 * ```
 *
 * Message Format:
 * The utility sends/receives messages with this format:
 * ```javascript
 * { type: 'THEME_CHANGE', theme: 'dark' | 'light' }
 * ```
 */

export type Theme = 'light' | 'dark';

export type ThemeChangeCallback = (theme: Theme) => void

/**
 * Sets up a listener for theme change messages from parent iframes
 * @param onThemeChange - Callback function called when theme changes
 * @returns Cleanup function to remove the event listener
 */
export const setupIframeThemeListener = (onThemeChange: ThemeChangeCallback): (() => void) => {
  const handleMessage = (event: MessageEvent) => {
    // Optional: Add origin validation for security
    // if (event.origin !== 'https://trusted-domain.com') return;

    if (event.data && event.data.type === 'THEME_CHANGE' && (event.data.theme === 'dark' || event.data.theme === 'light')) {
      onThemeChange(event.data.theme);
    }
  };

  window.addEventListener('message', handleMessage);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handleMessage);
  };
};


/**
 * Sends a theme change message to an iframe
 * @param iframe - The iframe element to send the message to
 * @param theme - The theme to send
 */
export const sendThemeToIframe = (iframe: HTMLIFrameElement, theme: Theme): void => {
  if (iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage(
        { type: 'THEME_CHANGE', theme },
        '*'
      );
    } catch (error) {
      // Ignore postMessage errors (CORS, etc.)
      console.warn('Failed to send theme to iframe:', error);
    }
  }
};
