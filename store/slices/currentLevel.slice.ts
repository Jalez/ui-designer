/** @format */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { backendStorage } from "@/lib/utils/backendStorage";

interface CurrentLevelState {
  currentLevel: number;
}

const initialState: CurrentLevelState = {
  currentLevel: 1,
};

const storage = backendStorage("currentLevel");

// Try to get from sessionStorage (cached) or default to 1
const currentLevel = storage.getItem(storage.key);
if (currentLevel) {
  initialState.currentLevel = parseInt(currentLevel);
} else {
  initialState.currentLevel = 1;
}

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
