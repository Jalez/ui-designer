/** @format */

import { Action, configureStore, ThunkAction } from "@reduxjs/toolkit";
import levelsReducer from "./slices/levels.slice";
import currentLevelReducer from "./slices/currentLevel.slice";
import scoreReducer from "./slices/score.slice";
import roomReducer from "./slices/room.slice";
import optionsReducer from "./slices/options.slice";
import drawingUrlsReducer from "./slices/drawingUrls.slice";
import pointsReducer from "./slices/points.slice";

export const store = configureStore({
  reducer: {
    levels: levelsReducer,
    currentLevel: currentLevelReducer,
    score: scoreReducer,
    room: roomReducer,
    options: optionsReducer,
    drawingUrls: drawingUrlsReducer,
    points: pointsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["levels/evaluateLevel"],
      },
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type:
export type AppDispatch = typeof store.dispatch;
// AppThunk is a type for the thunk action creator
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
