import { useCallback, useEffect, useMemo, useState } from "react";

type UseStepScopedMapStateParams<T> = {
  currentStepId: string;
  resetKey: string | null;
  fallbackValue?: T | null;
  shouldSet?: (value: T) => boolean;
  normalize?: (value: T) => T;
  isEqual?: (previous: T | undefined, next: T) => boolean;
  onSet?: (value: T, stepId: string) => void;
};

export function useStepScopedMapState<T>({
  currentStepId,
  resetKey,
  fallbackValue,
  shouldSet,
  normalize,
  isEqual,
  onSet,
}: UseStepScopedMapStateParams<T>) {
  const [byStepId, setByStepId] = useState<Record<string, T>>({});
  const compare = useMemo(
    () => isEqual ?? ((previous: T | undefined, next: T) => Object.is(previous, next)),
    [isEqual],
  );

  useEffect(() => {
    // Internal cache is intentionally reset when the scenario-scoped key changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setByStepId((previous) => (Object.keys(previous).length === 0 ? previous : {}));
  }, [resetKey]);

  useEffect(() => {
    if (fallbackValue == null) {
      return;
    }
    // Internal cache mirrors a new fallback snapshot for the active step.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setByStepId((previous) => {
      if (compare(previous[currentStepId], fallbackValue)) {
        return previous;
      }
      return {
        ...previous,
        [currentStepId]: fallbackValue,
      };
    });
  }, [compare, currentStepId, fallbackValue]);

  const setForStep = useCallback((value: T, stepId?: string | null) => {
    if (shouldSet && !shouldSet(value)) {
      return;
    }
    const targetStepId = stepId ?? currentStepId;
    const nextValue = normalize ? normalize(value) : value;
    let changed = false;
    setByStepId((previous) => {
      if (compare(previous[targetStepId], nextValue)) {
        return previous;
      }
      changed = true;
      return {
        ...previous,
        [targetStepId]: nextValue,
      };
    });
    if (!changed) {
      return;
    }
    onSet?.(nextValue, targetStepId);
  }, [compare, currentStepId, normalize, onSet, shouldSet]);

  return {
    byStepId,
    setByStepId,
    setForStep,
  };
}
