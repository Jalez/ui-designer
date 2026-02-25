/** @format */

const memoryStorage = new Map<string, string>();

/**
 * In-memory storage utility for user progression.
 * Does not use localStorage/sessionStorage or backend persistence.
 */
export const backendStorage = (originalKey: string) => {
  const obfuscatedKey = btoa(originalKey);
  const storageKey = obfuscatedKey;

  const getMemoryKey = (key: string) => `${storageKey}${btoa(key)}`;

  const setItem = async (key: string, value: string) => {
    memoryStorage.set(getMemoryKey(key), btoa(value));
  };

  const getItem = (key: string): string | null => {
    const item = memoryStorage.get(getMemoryKey(key));
    return item ? atob(item) : null;
  };

  const getItemAsync = async (key: string): Promise<string | null> => {
    return getItem(key);
  };

  const removeItem = async (key: string) => {
    memoryStorage.delete(getMemoryKey(key));
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
