/**
 * @description Converts a number time to minutes and seconds. Eg. 60000 -> 1:00
 * @param time
 * @returns
 */
export const numberTimeToMinutesAndSeconds = (time: number) => {
  if (time < 0) return "0:00";
  const minutes = Math.floor(time / 60000);
  const seconds = ((time % 60000) / 1000).toFixed(0);
  return minutes + ":" + (parseInt(seconds) < 10 ? "0" : "") + seconds;
};
