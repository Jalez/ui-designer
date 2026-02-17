import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";

export type Mode = "creator" | "test" | "game";

interface OptionsState {
  showWordCloud: boolean;
  creator: boolean; // Kept for backward compatibility, derived from mode
  mode: Mode;
  lastSaved: number | null;
}

const initialState: OptionsState = {
  showWordCloud: false,
  creator: false,
  mode: "test",
  lastSaved: null,
};

const storage = obfuscate("options") as any;

const storedOptions = storage.getItem(storage.key);
if (storedOptions) {
  initialState.showWordCloud = JSON.parse(storedOptions).showWordCloud;
} else {
  initialState.showWordCloud = false;
}

const optionsSlice = createSlice({
  name: "options",
  initialState,
  reducers: {
    setShowWordCloud(state, action: PayloadAction<boolean>) {
      state.showWordCloud = action.payload;
      storage.setItem(storage.key, JSON.stringify(state));
    },

    setMode(state, action: PayloadAction<Mode>) {
      state.mode = action.payload;
      // Update creator for backward compatibility
      state.creator = action.payload === "creator";
    },

    setCreator(state, action: PayloadAction<boolean>) {
      // Keep for backward compatibility
      state.creator = action.payload;
      // Update mode based on creator state
      state.mode = action.payload ? "creator" : "test";
    },

    setLastSaved(state, action: PayloadAction<number>) {
      state.lastSaved = action.payload;
    },
  },
});

export const { setShowWordCloud, setMode, setCreator, setLastSaved } =
  optionsSlice.actions;

export default optionsSlice.reducer;
