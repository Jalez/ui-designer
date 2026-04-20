import { createSlice } from "@reduxjs/toolkit";
import { eventSequenceSolutionStorageKey } from "@/events/core/eventSequenceSolutionUrls";
import { obfuscate } from "@/lib/utils/obfuscators/obfuscate";
const name = "solutionUrls";

interface solutionUrlsState {
  [key: string]: string;
}
const storage = obfuscate(name);

const noState = {};

let initialState: solutionUrlsState = {};

const currentDifferenceUrls = storage.getItem(storage.key);

if (currentDifferenceUrls) {
  initialState = JSON.parse(currentDifferenceUrls) || {};
}

const solutionUrlsSlice = createSlice({
  name,
  initialState,
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
      storage.setItem(storage.key, JSON.stringify(state));
      // #region agent log
      if (typeof window !== 'undefined') {
        fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',hypothesisId:'H22',location:'solutionUrls.slice.ts:addSolutionUrl:write',message:'store write',data:{key,scenarioId,eventSequenceStepId:eventSequenceStepId??null,hadStorageKey:Boolean(storageKey?.trim()),solutionUrlLen:solutionUrl.length,solutionUrlHead:solutionUrl.slice(0,100)},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
    },
    resetSolutionUrls(state) {
      Object.keys(state).forEach((k) => {
        delete state[k];
      });
      storage.setItem(storage.key, JSON.stringify(noState));
    },
  },
});

export const { addSolutionUrl, resetSolutionUrls } = solutionUrlsSlice.actions;

export default solutionUrlsSlice.reducer;
