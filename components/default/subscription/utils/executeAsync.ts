// Utility function to handle async operations with loading states
interface ExecuteAsyncOptions<T = void> {
  asyncFn: () => Promise<T>;
  onLoading?: (loading: boolean) => void;
  errorMessage: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  showAlert?: boolean;
}

export const executeAsync = async <T = void>(options: ExecuteAsyncOptions<T>): Promise<T | undefined> => {
  const { asyncFn, onLoading, errorMessage, onSuccess, onError, showAlert = true } = options;

  try {
    onLoading?.(true);
    const result = await asyncFn();
    onSuccess?.();
    return result;
  } catch (error) {
    console.error(`Error: ${errorMessage}`, error);
    onError?.(error);
    if (showAlert) {
      alert(`Failed to ${errorMessage}`);
    }
    return undefined;
  } finally {
    onLoading?.(false);
  }
};
