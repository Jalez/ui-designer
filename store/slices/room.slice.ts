/** @format */

import { createSlice } from "@reduxjs/toolkit";
import { backendStorage } from "@/lib/utils/backendStorage";

// Save the initial state of the room to a variable
let initialState = {
  currentRoom: "game",
  previousRoom: "",
};
const storage = backendStorage("room");

// Get the initial state of the room from sessionStorage (cached) or use default
const localRoom = storage.getItem(storage.key);
if (!localRoom) {
  // Default state, will be synced from backend on mount if available
  initialState = {
    currentRoom: "game",
    previousRoom: "",
  };
} else {
  try {
    initialState = JSON.parse(localRoom);
  } catch (e) {
    console.error("Failed to parse room data:", e);
    initialState = {
      currentRoom: "game",
      previousRoom: "",
    };
  }
}

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
