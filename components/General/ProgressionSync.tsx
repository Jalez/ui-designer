'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/hooks/hooks';
import { setCurrentLevel } from '@/store/slices/currentLevel.slice';
import { updateRoom } from '@/store/slices/room.slice';
import { backendStorage } from '@/lib/utils/backendStorage';

/**
 * Component that syncs user progression from backend on app mount.
 * This is the single source of truth for backend → Redux sync.
 */
export function ProgressionSync() {
  const dispatch = useAppDispatch();
  const isSyncing = useRef(false);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (hasSyncedRef.current || isSyncing.current) {
      return;
    }

    const syncProgression = async () => {
      isSyncing.current = true;

      try {
        // Sync current level
        const currentLevelStorage = backendStorage('currentLevel');
        const currentLevel = await currentLevelStorage.getItemAsync(currentLevelStorage.key);
        if (currentLevel) {
          dispatch(setCurrentLevel(parseInt(currentLevel)));
        }

        // Sync room
        const roomStorage = backendStorage('room');
        const room = await roomStorage.getItemAsync(roomStorage.key);
        if (room) {
          try {
            const roomData = JSON.parse(room);
            if (roomData.currentRoom) {
              dispatch(updateRoom(roomData.currentRoom));
            }
          } catch (e) {
            console.error('Failed to parse room data:', e);
          }
        }

        hasSyncedRef.current = true;
      } finally {
        isSyncing.current = false;
      }

      // Levels are synced in updateWeek reducer when map is loaded
    };

    syncProgression();
  }, [dispatch]);

  return null;
}
