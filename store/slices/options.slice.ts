import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";

export type Mode = "creator" | "test" | "game";

interface OptionsState {
  showWordCloud: boolean;
  mode: Mode;
  lastSaved: number | null;
  isSavingLevel: boolean;
  autoSaveLevels: boolean;
  activeArtTab: number; // 0 = "Model solution", 1 = "Your design"
}

const initialState: OptionsState = {
  showWordCloud: false,
  mode: "game",
  lastSaved: null,
  isSavingLevel: false,
  autoSaveLevels: true,
  activeArtTab: 0,
};

const storage = obfuscate("options") as any;

const storedOptions = storage.getItem(storage.key);
if (storedOptions) {
  const parsed = JSON.parse(storedOptions);
  initialState.showWordCloud = parsed.showWordCloud;
  if (typeof parsed.autoSaveLevels === "boolean") {
    initialState.autoSaveLevels = parsed.autoSaveLevels;
  }
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
    },

    setLastSaved(state, action: PayloadAction<number>) {
      state.lastSaved = action.payload;
    },

    setIsSavingLevel(state, action: PayloadAction<boolean>) {
      state.isSavingLevel = action.payload;
    },

    setAutoSaveLevels(state, action: PayloadAction<boolean>) {
      state.autoSaveLevels = action.payload;
      storage.setItem(storage.key, JSON.stringify(state));
    },

    setActiveArtTab(state, action: PayloadAction<number>) {
      state.activeArtTab = action.payload;
    },
  },
});

export const {
  setShowWordCloud,
  setMode,
  setLastSaved,
  setIsSavingLevel,
  setAutoSaveLevels,
  setActiveArtTab,
} =
  optionsSlice.actions;

export default optionsSlice.reducer;
