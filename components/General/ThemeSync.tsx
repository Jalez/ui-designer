'use client';

import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks/hooks';
import { store } from '@/store/store';

/**
 * Component that syncs the darkMode Redux state with the HTML dark class
 * This ensures Tailwind CSS dark mode works throughout the application
 */
export function ThemeSync() {
  const darkMode = useAppSelector((state) => state.options.darkMode);

  useEffect(() => {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    if (darkMode) {
      htmlElement.classList.add('dark');
      bodyElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
      bodyElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle initial state on mount to prevent flash of incorrect theme
  useEffect(() => {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    const initialState = store.getState().options.darkMode;

    if (initialState) {
      htmlElement.classList.add('dark');
      bodyElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
      bodyElement.classList.remove('dark');
    }
  }, []);

  return null;
}
