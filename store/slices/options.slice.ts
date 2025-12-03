import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";

interface OptionsState {
  showWordCloud: boolean;
  creator: boolean;
}

const initialState: OptionsState = {
  showWordCloud: false,
  creator: false,
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

    setCreator(state, action: PayloadAction<boolean>) {
      state.creator = action.payload;
    },
  },
});

export const { setShowWordCloud, setCreator } =
  optionsSlice.actions;

export default optionsSlice.reducer;
