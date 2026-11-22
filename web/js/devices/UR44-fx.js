/*
  DSP resources of the UR44 (manual, "Limitations on the use of effects"):

  Channel Strip   Guitar Amp Classics
  Mono Stereo     Mono Stereo
  4    0          0    -
  2    1          0    -
  2    0          1    -
  0    2          0    -
  0    1          1    -

  There are 4 channel strips. A stereo channel strip (on a linked channel
  pair) uses two of them, the guitar amp uses the resources of two. There is
  only one guitar amp and it can't be used on linked channels. The device
  enforces these rules itself and silently ignores insert commands that
  violate them.
*/

export const FX_BUDGET = 4;

const costOf = (type) => {
  if (type === "channel-strip") return 1;
  if (type === "amp") return 2;
  if (type === "off") return 0;
  throw new Error("Unknown FX type: " + type);
};

export const getBudgetInUse = (existingActiveTypes) => {
  return existingActiveTypes.reduce((sum, type) => sum + costOf(type), 0);
};

export const getLinkPartner = (channelIndex) => {
  return channelIndex % 2 === 0 ? channelIndex + 1 : channelIndex - 1;
};

/*
  existingActiveTypes: FX type per input channel ("off", "channel-strip",
    "amp"). A stereo channel strip appears on both channels of the pair.
  linked: optional array of booleans per input channel.
*/
export const canSetFx = (
  type,
  channelIndex,
  existingActiveTypes,
  linked = [],
) => {
  costOf(type);
  const isLinked = !!linked[channelIndex];
  const affected = isLinked
    ? [channelIndex, getLinkPartner(channelIndex)]
    : [channelIndex];

  if (type === "off") return true;
  if (type === "amp" && isLinked) return false;

  const newTypes = existingActiveTypes.map((t, i) => {
    return affected.includes(i) ? type : t;
  });

  return getBudgetInUse(newTypes) <= FX_BUDGET
    && newTypes.filter((t) => t === "amp").length <= 1;
};
