import { createSlice } from "@reduxjs/toolkit";

interface solutionsState {
  [key: string]: {
    SCSS: string;
    SHTML: string;
    SJS: string;
    drawn: boolean;
  };
}
const initialState: solutionsState = {};

const solutionsSlice = createSlice({
  name: "solutions",
  initialState,
  reducers: {
    addSolution(state, action) {
      const { solutionCode, levelId } = action.payload;
      state[levelId] = { ...solutionCode, drawn: false };
    },
    setSolutions(state, action) {
      // add to each drawn state of false before returning
      const solutions = action.payload;
      Object.keys(solutions).forEach((key) => {
        solutions[key] = { ...solutions[key], drawn: false };
      });
      return solutions;
    },
    updateDrawnState(state, action) {
      const { levelId, drawn } = action.payload;
      state[levelId].drawn = drawn;
    },
  },
});

export const { addSolution, setSolutions, updateDrawnState } =
  solutionsSlice.actions;

export default solutionsSlice.reducer;
