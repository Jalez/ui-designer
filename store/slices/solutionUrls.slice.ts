import { createSlice } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";
const name = "solutionUrls";

interface solutionUrlsState {
  [key: string]: string;
}
const storage = obfuscate(name);

let noState = {};

let initialState: solutionUrlsState = {};

const currentDifferenceUrls = storage.getItem(storage.key);

if (currentDifferenceUrls) {
  initialState = JSON.parse(currentDifferenceUrls) || {};
}

const solutionUrlsSlice = createSlice({
  name,
  initialState,
  reducers: {
    addSolutionUrl(state, action) {
      const { solutionUrl, scenarioId } = action.payload;
      state[scenarioId] = solutionUrl;
      storage.setItem(storage.key, JSON.stringify(state));
    },
    resetSolutionUrls(state) {
      storage.setItem(storage.key, JSON.stringify(noState));
      return noState;
    },
  },
});

export const { addSolutionUrl, resetSolutionUrls } = solutionUrlsSlice.actions;

export default solutionUrlsSlice.reducer;
