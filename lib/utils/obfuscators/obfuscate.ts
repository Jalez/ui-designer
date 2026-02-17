/** @format */

const memoryStorage = new Map<string, string>();

export const obfuscate = (originalKey: string) => {
  const obfuscatedKey = btoa(originalKey);

  const getMemoryKey = (key: string) => `${obfuscatedKey}${btoa(key)}`;

  const setItem = (key: string, value: string) => {
    memoryStorage.set(getMemoryKey(key), btoa(value));
  };
  const getItem = (key: string): string | null => {
    const item = memoryStorage.get(getMemoryKey(key));
    if (item === undefined) {
      return null;
    }
    return atob(item);
  };
  const removeItem = (key: string) => {
    memoryStorage.delete(getMemoryKey(key));
  };
  return {
    setItem,
    getItem,
    removeItem,
    key: obfuscatedKey,
  };
};

export type Obfuscate = ReturnType<typeof obfuscate>;
