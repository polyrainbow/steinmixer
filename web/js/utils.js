export const getDBFSLabel = (val, valueTransformer) => {
  const formatter = new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
  return `${formatter.format(valueTransformer(val))} dB`;
};
