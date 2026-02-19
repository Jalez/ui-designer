'use client';

import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/store/hooks/hooks';
import { useCollaboration } from '@/lib/collaboration/CollaborationProvider';
import { useGameStore } from '@/components/default/games';

const SAVE_DEBOUNCE_MS = 5000;

/**
 * Auto-saves group game code to the database via updateGameProgress.
 * Only active when the user is in a group collaboration session.
 */
export function GameCodeSync() {
  const { groupId } = useCollaboration();
  const levels = useAppSelector((state) => state.levels);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const updateGameProgress = useGameStore((state) => state.updateGameProgress);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!groupId || !currentGame?.id || levels.length === 0) {
      return;
    }

    const levelCodes = levels.map((level) => ({
      name: level.name,
      code: level.code,
    }));

    const serialized = JSON.stringify(levelCodes);

    // Skip if nothing changed
    if (serialized === lastSavedRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      lastSavedRef.current = serialized;
      const savePromise = groupId
        ? fetch(`/api/groups/${groupId}/game`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progressData: { levels: levelCodes } }),
          }).then(async (response) => {
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload?.error || payload?.message || `Failed to save group progress: ${response.status}`);
            }
          })
        : updateGameProgress(currentGame.id, { levels: levelCodes });

      savePromise.catch((err) => {
        console.error('Failed to save game progress:', err);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [groupId, levels, currentGame?.id, updateGameProgress]);

  return null;
}
