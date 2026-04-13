import { createSlice } from "@reduxjs/toolkit";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";
import { eventSequenceDiffStorageKey } from "@/events/core/eventSequenceDiffUrls";

const name = "differenceUrls";

interface differenceUrlsState {
  [key: string]: string;
}
const storage = obfuscate(name);

const initialState: differenceUrlsState = {};

// const currentDifferenceUrls = storage.getItem(storage.key);

// if (currentDifferenceUrls) {
//   initialState = JSON.parse(currentDifferenceUrls) || {};
// }

const differenceUrlsSlice = createSlice({
  name,
  initialState,
  reducers: {
    addDifferenceUrl(state, action) {
      const { differenceUrl, scenarioId, eventSequenceStepId } = action.payload;
      const key =
        eventSequenceStepId && eventSequenceStepId.length > 0
          ? eventSequenceDiffStorageKey(scenarioId, eventSequenceStepId)
          : scenarioId;
      // if (state[scenarioId]) return;
      state[key] = differenceUrl;
      // storage.setItem(storage.key, JSON.stringify(state));
    },
  },
});

export const { addDifferenceUrl } = differenceUrlsSlice.actions;

export default differenceUrlsSlice.reducer;
