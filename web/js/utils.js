import { getDBFSFromSliderValue } from "./UR44/utils.js";

export const getDBFSLabel = (val) => {
  const formatter = new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
  return `${formatter.format(getDBFSFromSliderValue(val))} dB`;
};
