"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppStore } from "@/store/hooks/hooks";
import { appendEventSequenceStep } from "@/store/slices/levels.slice";
import { apiUrl } from "@/lib/apiUrl";
import { serializeLevelForPersistence } from "@/lib/levels/variants";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import type { EventSequenceStep } from "@/types";

const eventSequencePersistTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

type UsePersistRecordedSequenceStepParams = {
  currentLevel: number;
  scenarioId: string;
};

export function usePersistRecordedSequenceStep({
  currentLevel,
  scenarioId,
}: UsePersistRecordedSequenceStepParams) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { syncLevelFields } = useLevelMetaSync();

  return useCallback((step: EventSequenceStep) => {
    if (!step?.id) {
      return;
    }

    dispatch(
      appendEventSequenceStep({
        levelId: currentLevel,
        scenarioId,
        step,
      }),
    );
    syncLevelFields(currentLevel - 1, ["eventSequence"]);

    const levelIndex = currentLevel - 1;
    const levelAfter = store.getState().levels[levelIndex];
    if (!levelAfter?.identifier) {
      return;
    }

    const persistKey = levelAfter.identifier;
    const previousTimeout = eventSequencePersistTimeouts.get(persistKey);
    if (previousTimeout) {
      clearTimeout(previousTimeout);
    }

    const timeout = setTimeout(() => {
      eventSequencePersistTimeouts.delete(persistKey);
      const freshLevel = store.getState().levels[levelIndex];
      if (!freshLevel?.identifier || !freshLevel.eventSequence) {
        return;
      }
      const byScenarioId = freshLevel.eventSequence.byScenarioId;
      if (!byScenarioId || Object.keys(byScenarioId).length === 0) {
        return;
      }

      const serializedLevel = serializeLevelForPersistence({
        ...freshLevel,
        eventSequence: freshLevel.eventSequence,
      });
      const { name, ...json } = serializedLevel;
      fetch(apiUrl(`/api/levels/${freshLevel.identifier}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...json }),
      }).catch(() => {});
    }, 500);

    eventSequencePersistTimeouts.set(persistKey, timeout);
  }, [currentLevel, dispatch, scenarioId, store, syncLevelFields]);
}
