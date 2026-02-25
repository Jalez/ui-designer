/** @format */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { backendStorage } from "@/lib/utils/backendStorage";

interface CurrentLevelState {
  currentLevel: number;
}

// Create storage reference for use in reducers
const storage = backendStorage("currentLevel");

// Get initial state from sessionStorage cache only (sync).
// Backend sync is handled by ProgressionSync component to avoid duplicate API calls.
const cachedLevel = storage.getItem(storage.key);

const initialState: CurrentLevelState = {
  currentLevel: cachedLevel ? parseInt(cachedLevel) : 1,
};

const currentLevelSlice = createSlice({
  name: "currentLevel",
  initialState,
  reducers: {
    setCurrentLevel(state, action: PayloadAction<number>) {
      state.currentLevel = action.payload;
      // Save to both sessionStorage (cache) and backend
      storage.setItem(storage.key, action.payload.toString());
    },
  },
});

export const { setCurrentLevel } = currentLevelSlice.actions;

export default currentLevelSlice.reducer;
