'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/hooks';
import { setCurrentLevel } from '@/store/slices/currentLevel.slice';
import { updateRoom } from '@/store/slices/room.slice';
import { backendStorage } from '@/lib/utils/backendStorage';

/**
 * Component that syncs user progression from backend on app mount
 */
export function ProgressionSync() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const syncProgression = async () => {
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

      // Levels are synced in updateWeek reducer when map is loaded
    };

    syncProgression();
  }, [dispatch]);

  return null;
}

