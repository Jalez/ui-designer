import { createSlice } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";

const name = "differenceUrls";

interface differenceUrlsState {
  [key: string]: string;
}
const storage = obfuscate(name);

let initialState: differenceUrlsState = {};

// const currentDifferenceUrls = storage.getItem(storage.key);

// if (currentDifferenceUrls) {
//   initialState = JSON.parse(currentDifferenceUrls) || {};
// }

const differenceUrlsSlice = createSlice({
  name,
  initialState,
  reducers: {
    addDifferenceUrl(state, action) {
      const { differenceUrl, scenarioId } = action.payload;
      // if (state[scenarioId]) return;
      state[scenarioId] = differenceUrl;
      // storage.setItem(storage.key, JSON.stringify(state));
    },
  },
});

export const { addDifferenceUrl } = differenceUrlsSlice.actions;

export default differenceUrlsSlice.reducer;
