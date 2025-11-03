import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";

interface OptionsState {
  darkMode: boolean;
  showWordCloud: boolean;
  creator: boolean;
}

const initialState: OptionsState = {
  darkMode: true,
  showWordCloud: false,
  creator: false,
};

const storage = obfuscate("options") as any;

const storedOptions = storage.getItem(storage.key);
if (storedOptions) {
  initialState.darkMode = JSON.parse(storedOptions).darkMode;
  initialState.showWordCloud = JSON.parse(storedOptions).showWordCloud;
} else {
  initialState.darkMode = true;
  initialState.showWordCloud = false;
}

const optionsSlice = createSlice({
  name: "options",
  initialState,
  reducers: {
    setDarkMode(state, action: PayloadAction<boolean>) {
      state.darkMode = action.payload;

      storage.setItem(storage.key, JSON.stringify(state));
    },
    setShowWordCloud(state, action: PayloadAction<boolean>) {
      state.showWordCloud = action.payload;
      storage.setItem(storage.key, JSON.stringify(state));
    },

    setCreator(state, action: PayloadAction<boolean>) {
      state.creator = action.payload;
    },
  },
});

export const { setDarkMode, setShowWordCloud, setCreator } =
  optionsSlice.actions;

export default optionsSlice.reducer;
