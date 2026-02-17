import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Helper function to get value from localStorage synchronously
const getStoredValue = <T>(key: string, initialValue: T): T => {
  return initialValue;
};

const useSidebarPersistence = <T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] => {
  // Initialize state with stored value synchronously
  const [storedValue, setStoredValue] = useState(() => getStoredValue(key, initialValue));

  useIsomorphicLayoutEffect(() => {
    // During hydration, React reuses the server-rendered value.
    // Pull the latest value from localStorage once the component mounts.
    if (typeof window !== "undefined") {
      setStoredValue(getStoredValue(key, initialValue));
    }
  }, [initialValue, key]);

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      // Handle function updates like React setState
      const resolvedValue = typeof value === "function" ? (value as (prev: T) => T)(storedValue) : value;

      // Don't store undefined values
      if (resolvedValue === undefined) {
        return;
      }

      // Save state
      setStoredValue(resolvedValue);
    } catch (error) {
      console.error(`Error setting stored value for key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

export default useSidebarPersistence;
