/** @format */

import { createSlice } from "@reduxjs/toolkit";
import { backendStorage } from "@/lib/utils/backendStorage";

// Create storage reference for use in reducers
const storage = backendStorage("room");

// Get initial state from sessionStorage cache only (sync).
// Backend sync is handled by ProgressionSync component to avoid duplicate API calls.
const getInitialState = () => {
  const defaultState = {
    currentRoom: "game",
    previousRoom: "",
  };
  
  const cachedRoom = storage.getItem(storage.key);
  if (!cachedRoom) {
    return defaultState;
  }
  
  try {
    return JSON.parse(cachedRoom);
  } catch (e) {
    console.error("Failed to parse room data:", e);
    return defaultState;
  }
};

const initialState = getInitialState();

const roomSlice = createSlice({
  name: "screen",
  initialState: initialState,
  reducers: {
    updateRoom: (state, action) => {
      state.previousRoom = state.currentRoom;
      state.currentRoom = action.payload;
      // Save to both sessionStorage (cache) and backend
      storage.setItem(storage.key, JSON.stringify(state));
    },
  },
});

export const { updateRoom } = roomSlice.actions;

export default roomSlice.reducer;
