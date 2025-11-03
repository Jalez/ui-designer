/** @format */

import { createSlice } from '@reduxjs/toolkit';

const scoreSlice = createSlice({
	name: 'score',
	initialState: {
		points: 0,
		maxPoints: 10,
	},
	reducers: {
		updatePoints: (state, action) => {
			state.points = action.payload;
		},
		updateMaxPoints: (state, action) => {
			state.maxPoints = action.payload;
		},
	},
});

export const { updatePoints, updateMaxPoints } = scoreSlice.actions;

export default scoreSlice.reducer;
