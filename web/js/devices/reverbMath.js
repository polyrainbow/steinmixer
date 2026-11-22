/*
  Conversions between raw REV-X reverb param values and display values.

  Reference points come from UR44-params.js (taken from dspMixFx).
*/
import { FREQ_TABLE_HZ, formatHz } from "./channelStripMath.js";

export const REVERB_TYPES = Object.freeze(["Hall", "Room", "Plate"]);

/*
  The maximum reverb times in relation to room size, per reverb type.
  E.g. for hall: if room size is 0, max time is 10.3s, if room size is 31,
  max time is 31s.
*/
const HALL_MAX_REVERB_TIMES = [
  10.3, 10.7, 11.1, 11.5, 11.9, 12.3, 12.8, 13.2, 13.7, 14.2,
  14.7, 15.2, 15.8, 16.4, 17.0, 17.6, 18.2, 18.9, 19.6, 20.3,
  21, 21.8, 22.6, 23.4, 24.2, 25.1, 26, 27, 27.9, 29,
  30, 31,
];

const ROOM_MAX_REVERB_TIMES = [
  15.2, 15.8, 16.4, 17.0, 17.6, 18.2, 18.9, 19.6, 20.3, 21.0,
  21.8, 22.6, 23.4, 24.2, 25.1, 26.0, 27.0, 27.9, 29, 30,
  31.0, 32.1, 33.3, 34.4, 35.6, 36.9, 38.2, 39.5, 40.9, 42.3,
  43.8, 45.3,
];

const PLATE_MAX_REVERB_TIMES = [
  17.6, 18.2, 18.9, 19.6, 20.3, 21.0, 21.8, 22.6, 23.4, 24.2,
  25.1, 26, 27, 27.9, 29, 30, 31.0, 32.1, 33.3, 34.4,
  35.6, 36.9, 38.2, 39.5, 40.9, 42.3, 43.8, 45.3, 46.9, 48.6,
  50.3, 52,
];

const MAX_REVERB_TIMES = [
  HALL_MAX_REVERB_TIMES,
  ROOM_MAX_REVERB_TIMES,
  PLATE_MAX_REVERB_TIMES,
];

export const REVERB_TIME_MAX_INDEX = 69;

/*
  Reverb time range depends on room size and reverb type.
  There are always 70 possible values which depend on the maximum value for the
  combination of reverb type (hall, room, plate) and room size (0-31).
  There are 5 key indexes where the values are given: 0, 47, 57, 67, 69
  See also the graph in docs/reverb-time-range-example.png for a visualization.
  Between the key indexes, the values are linearly interpolated.
*/
export const getReverbTime = (max, x) => {
  if (!Number.isInteger(x) || x < 0 || x > REVERB_TIME_MAX_INDEX) {
    throw new Error("x is out of range: " + x);
  }

  const min = max / 100;
  const range = max - min;
  const keyIndexes = [
    [0, min],
    [47, min + range * 0.15832],
    [57, min + range * 0.325952],
    [67, min + range * 0.66395],
    [69, max],
  ];

  for (let i = 1; i < keyIndexes.length; i++) {
    const [prevIndex, prevValue] = keyIndexes[i - 1];
    const [index, value] = keyIndexes[i];
    if (x <= index) {
      const t = (x - prevIndex) / (index - prevIndex);
      return prevValue + t * (value - prevValue);
    }
  }
};

export const getMaxReverbTime = (reverbType, roomSize) => {
  const table = MAX_REVERB_TIMES[reverbType];
  if (!table) {
    throw new Error("Invalid reverb type: " + reverbType);
  }
  const max = table[roomSize];
  if (max === undefined) {
    throw new Error("Invalid room size: " + roomSize);
  }
  return max;
};

// Reverb time in seconds
export const reverbTimeToSeconds = (reverbType, roomSize, x) => {
  return getReverbTime(getMaxReverbTime(reverbType, roomSize), x);
};

/*
  The raw time value which comes closest to `seconds` for the given reverb type
  and room size. Compared in the log domain, like we hear it.
*/
export const secondsToReverbTime = (reverbType, roomSize, seconds) => {
  const max = getMaxReverbTime(reverbType, roomSize);
  const target = Math.log(Math.max(seconds, 1e-6));
  let best = 0;
  let bestDist = Infinity;
  for (let x = 0; x <= REVERB_TIME_MAX_INDEX; x++) {
    const dist = Math.abs(Math.log(getReverbTime(max, x)) - target);
    if (dist < bestDist) {
      best = x;
      bestDist = dist;
    }
  }
  return best;
};

/*
  HPF, LPF and low freq use 1/6 octave steps, which are every second entry of
  the channel strip frequency table, starting at 20 Hz.
  E.g. HPF 0:20Hz, 4:32Hz, 52:8kHz; LPF 34:1kHz, 60:20kHz; low freq 32:800Hz
*/
export const reverbFreqToHz = (raw) => FREQ_TABLE_HZ[4 + 2 * raw];

/*
  Initial delay (pre-delay) 0..127 -> 0.1..200 ms. Known points: 0:0.1ms,
  2:3.2ms, 127:200ms, which fit a linear scale.
*/
export const initialDelayToMs = (raw) => 0.1 + raw * (199.9 / 127);

// Hi ratio 1..10 -> 0.1..1.0, low ratio 1..14 -> 0.1..1.4
export const reverbRatioToValue = (raw) => raw / 10;

/* ---------- formatting ---------- */

export const formatSeconds = (seconds) => {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 10) return `${seconds.toFixed(2)} s`;
  return `${seconds.toFixed(1)} s`;
};

export const formatInitialDelay = (raw) => {
  return `${initialDelayToMs(raw).toFixed(1)} ms`;
};

export const formatReverbFreq = (raw) => formatHz(reverbFreqToHz(raw));

export const formatReverbRatio = (raw) => {
  return `×${reverbRatioToValue(raw).toFixed(1)}`;
};

/* ---------- graph ---------- */

/*
  Pre-delay and the times (in seconds) after which lows, mids and highs have
  decayed by 60 dB. Lows and highs decay in reverb time × their ratio.
*/
export const getReverbDecay = (settings) => {
  const time = reverbTimeToSeconds(
    settings.ReverbType, settings.ReverbRoomSize, settings.ReverbTime,
  );
  return {
    preDelay: initialDelayToMs(settings.ReverbInitialDelay) / 1000,
    low: time * reverbRatioToValue(settings.ReverbLowRatio),
    mid: time,
    high: time * reverbRatioToValue(settings.ReverbHighRatio),
  };
};

const NICE_STEPS = [1, 2, 5];

/*
  The smallest 1/2/5 * 10^n value which is at least `seconds`, and the tick
  distance for it (5 ticks for 1 and 5, 4 for 2).
*/
export const getTimeAxis = (seconds) => {
  let exponent = Math.floor(Math.log10(Math.max(seconds, 1e-3)));
  for (;;) {
    for (const step of NICE_STEPS) {
      const max = step * 10 ** exponent;
      if (max >= seconds) {
        // round off floating point noise, e.g. 0.30000000000000004
        const clean = (v) => parseFloat(v.toPrecision(6));
        return { max: clean(max), tick: clean(max / (step === 2 ? 4 : 5)) };
      }
    }
    exponent++;
  }
};

// Short axis label, e.g. "200ms", "1.5s", "20s"
export const formatSecondsShort = (seconds) => {
  if (seconds === 0) return "0";
  if (seconds < 1) return `${parseFloat((seconds * 1000).toPrecision(3))}ms`;
  return `${parseFloat(seconds.toPrecision(3))}s`;
};
