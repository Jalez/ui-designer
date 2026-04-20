import { useCallback, useEffect, useState } from "react";

type UseStepScopedMapStateParams<T> = {
  currentStepId: string;
  resetKey: string | null;
  fallbackValue?: T | null;
  shouldSet?: (value: T) => boolean;
  normalize?: (value: T) => T;
  onSet?: (value: T, stepId: string) => void;
};

export function useStepScopedMapState<T>({
  currentStepId,
  resetKey,
  fallbackValue,
  shouldSet,
  normalize,
  onSet,
}: UseStepScopedMapStateParams<T>) {
  const [byStepId, setByStepId] = useState<Record<string, T>>({});

  useEffect(() => {
    setByStepId({});
  }, [resetKey]);

  useEffect(() => {
    if (fallbackValue == null) {
      return;
    }
    setByStepId((previous) => {
      if (previous[currentStepId] === fallbackValue) {
        return previous;
      }
      return {
        ...previous,
        [currentStepId]: fallbackValue,
      };
    });
  }, [currentStepId, fallbackValue]);

  const setForStep = useCallback((value: T, stepId?: string | null) => {
    if (shouldSet && !shouldSet(value)) {
      return;
    }
    const targetStepId = stepId ?? currentStepId;
    const nextValue = normalize ? normalize(value) : value;
    setByStepId((previous) => ({
      ...previous,
      [targetStepId]: nextValue,
    }));
    onSet?.(nextValue, targetStepId);
  }, [currentStepId, normalize, onSet, shouldSet]);

  return {
    byStepId,
    setByStepId,
    setForStep,
  };
}