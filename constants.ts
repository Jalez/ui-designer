export let mainColor = "#222";
export let secondaryColor = "#fff";
export const drawBoardWidth = 400;
export const drawBoardheight = 300;

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
export const gameMaxTime = 12 * hour;

const difficulties = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const mapUrl = "/api/maps";
export const levelUrl = "/api/levels";
export const chatGPTURl = "/api/ai";
export const appVersion = "0.1.0";
