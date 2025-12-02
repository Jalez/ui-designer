import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Helper function to get value from localStorage synchronously
const getStoredValue = <T>(key: string, initialValue: T): T => {
  if (typeof window === "undefined") {
    return initialValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    // Check if the stored value is actually undefined (as a string) or null
    if (item === "undefined" || item === null) {
      // Clear the invalid value
      window.localStorage.removeItem(key);
      // Also clear the cookie
      document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      return initialValue;
    }
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return initialValue;
  }
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

      // Save to localStorage (primary storage)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(resolvedValue));
        // Update cookie for SSR compatibility on future requests
        const cookieValue = encodeURIComponent(JSON.stringify(resolvedValue));
        document.cookie = `${key}=${cookieValue}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch (error) {
      console.error(`Error setting stored value for key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

export default useSidebarPersistence;
