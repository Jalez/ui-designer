/** @format */

/**
 * Backend storage utility that replaces sessionStorage for user progression.
 * Uses the backend API to persist user data, with sessionStorage as a fallback.
 */
export const backendStorage = (originalKey: string) => {
  const obfuscatedKey = btoa(originalKey);
  const apiUrl = `/api/progression/${encodeURIComponent(obfuscatedKey)}`;
  const storageKey = obfuscatedKey;

  const setItem = async (key: string, value: string) => {
    if (typeof window === 'undefined') {
      return; // Server-side rendering, skip
    }

    // Save to sessionStorage immediately for fast access
    if (window.sessionStorage) {
      sessionStorage.setItem(storageKey + btoa(key), btoa(value));
    }

    // Save to backend asynchronously
    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });
    } catch (error) {
      console.error('Failed to save to backend:', error);
    }
  };

  const getItem = (key: string): string | null => {
    if (typeof window === 'undefined') {
      return null; // Server-side rendering
    }

    // First try sessionStorage for immediate access
    if (window.sessionStorage) {
      const item = sessionStorage.getItem(storageKey + btoa(key));
      if (item !== null) {
        return atob(item);
      }
    }

    // If not in sessionStorage, try to load from backend (async, but return null for now)
    // The actual backend sync should happen in a useEffect or similar
    return null;
  };

  const getItemAsync = async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') {
      return null;
    }

    // First check sessionStorage
    if (window.sessionStorage) {
      const item = sessionStorage.getItem(storageKey + btoa(key));
      if (item !== null) {
        return atob(item);
      }
    }

    // Try backend
    try {
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.value !== null && data.value !== undefined) {
          // Cache in sessionStorage for next time
          if (window.sessionStorage) {
            sessionStorage.setItem(storageKey + btoa(key), btoa(data.value));
          }
          return data.value;
        }
      }
    } catch (error) {
      console.error('Failed to load from backend:', error);
    }

    return null;
  };

  const removeItem = async (key: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    // Remove from sessionStorage
    if (window.sessionStorage) {
      sessionStorage.removeItem(storageKey + btoa(key));
    }

    // Remove from backend
    try {
      await fetch(apiUrl, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete from backend:', error);
    }
  };

  return {
    setItem,
    getItem,
    getItemAsync,
    removeItem,
    key: storageKey,
  };
};

export type BackendStorage = ReturnType<typeof backendStorage>;
