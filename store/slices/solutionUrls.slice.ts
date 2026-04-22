import { createSlice } from "@reduxjs/toolkit";
import { eventSequenceSolutionStorageKey } from "@/events/core/eventSequenceSolutionUrls";
const name = "solutionUrls";

const solutionUrlsSlice = createSlice({
  name,
  initialState: {},
  reducers: {
    addSolutionUrl(
      state,
      action: {
        payload: {
          solutionUrl: string;
          storageKey?: string;
          scenarioId: string;
          /** Game + event sequence: store per timeline step so the iframe can unmount after each capture. */
          eventSequenceStepId?: string | null;
        };
      },
    ) {
      const { solutionUrl, storageKey, scenarioId, eventSequenceStepId } = action.payload;
      const key = storageKey?.trim()
        || (
          eventSequenceStepId && eventSequenceStepId.length > 0
            ? eventSequenceSolutionStorageKey(scenarioId, eventSequenceStepId)
            : scenarioId
        );
      if (state[key] === solutionUrl) {
        return;
      }
      state[key] = solutionUrl;
    },
    resetSolutionUrls(state) {
      Object.keys(state).forEach((k) => {
        delete state[k];
      });
    },
  },
});

export const { addSolutionUrl, resetSolutionUrls } = solutionUrlsSlice.actions;

export default solutionUrlsSlice.reducer;
