/**
 * Converts milliseconds into a formatted string representing days, hours, minutes, and seconds.
 *
 * @param {number} millisecond - The input value in milliseconds to convert.
 * @return {string} The formatted string representing the time in days, hours, minutes, and seconds.
 */
const millisecondChangeFormat = (millisecond: number): string => {
  const days = Math.floor(millisecond / 1000 / 60 / 60 / 24);
  const hours = Math.floor(millisecond / 1000 / 60 / 60) % 24;
  const mins = Math.floor(millisecond / 1000 / 60) % 60;
  const secs = Math.floor(millisecond / 1000) % 60;

  let resultFormat = "";
  if (days > 0) resultFormat += `${days}d`;
  if (hours > 0) resultFormat += `${hours}h`;
  if (mins > 0) resultFormat += `${mins}m`;
  if (secs > 0) resultFormat += `${secs}s`;
  if (!resultFormat) resultFormat += `${millisecond}ms`;
  return resultFormat;
};

export default millisecondChangeFormat;
