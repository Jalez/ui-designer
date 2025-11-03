/** @format */

export const obfuscate = (originalKey: string) => {
  const obfuscatedKey = btoa(originalKey);
  const setItem = (key: string, value: string) => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(obfuscatedKey + btoa(key), btoa(value));
    }
  };
  const getItem = (key: string): string | null => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const item = sessionStorage.getItem(obfuscatedKey + btoa(key));
      if (item === null) {
        return null;
      }
      return atob(item);
    }
    return null;
  };
  const removeItem = (key: string) => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(obfuscatedKey + btoa(key));
    }
  };
  return {
    setItem,
    getItem,
    removeItem,
    key: obfuscatedKey,
  };
};

export type Obfuscate = ReturnType<typeof obfuscate>;
