/**
 * @description Converts a number time to hours, minutes and seconds. Eg. 3661000 -> 1:01:01
 * @param time
 * @returns
 */
export const numberTimeToMinutesAndSeconds = (time: number) => {
  if (time < 0) return "0:00:00";
  const hours = Math.floor(time / 3600000);
  const minutes = Math.floor((time % 3600000) / 60000);
  const seconds = Math.floor((time % 60000) / 1000);

  const formattedHours = hours.toString();
  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes.toString();
  const formattedSeconds = seconds < 10 ? "0" + seconds : seconds.toString();

  return formattedHours + ":" + formattedMinutes + ":" + formattedSeconds;
};
