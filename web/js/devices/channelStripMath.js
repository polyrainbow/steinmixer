/*
  Pure math for the UR44 "Sweet Spot Morphing Channel Strip"
  (compressor + 3-band EQ). No DOM access.

  All functions take RAW device integers (as stored in
  `device.channelStripSettings[stackIndex]`) and convert them into display
  values, compressor transfer curves and EQ magnitude responses.

  Value mappings:

  - FREQ_TABLE_HZ, Q_TABLE, RATIO_TABLE, ATTACK_TABLE_MS, RELEASE_TABLE_MS
    map raw values to display values. RATIO_TABLE[120] is 3000, which the
    UI shows as "inf".
  - gain = raw * 0.1 - 18 dB, drive = raw * 0.05,
    threshOfst = raw * 0.2 - 20 dB, makeupOfst = raw * 0.005 (a ratio),
    threshold = -raw(drive) * 0.2 dB.
  - Drive acts as the compressor threshold, so Drive 10.00 is a -40 dB
    threshold before the threshOfst morph parameter is applied.
  - Effective threshold, auto makeup, knee shapes (soft/medium/hard) and the
    shelf/peaking filters model the channel strip's static behaviour.
*/

export const FREQ_TABLE_HZ = Object.freeze([
  16, 17, 18, 19, 20, 21.2, 22.4, 23.6, 25, 26.5,
  28, 30, 31.5, 33.5, 35.5, 37.5, 40, 42.5, 45, 47.5,
  50, 53, 56, 60, 63, 67, 71, 75, 80, 85,
  90, 95, 100, 106, 112, 118, 125, 132, 140, 150,
  160, 170, 180, 190, 200, 212, 224, 236, 250, 265,
  280, 300, 315, 335, 355, 375, 400, 425, 450, 475,
  500, 530, 560, 600, 630, 670, 710, 750, 800, 850,
  900, 950, 1000, 1060, 1120, 1180, 1250, 1320, 1400, 1500,
  1600, 1700, 1800, 1900, 2000, 2120, 2240, 2360, 2500, 2650,
  2800, 3000, 3150, 3350, 3550, 3750, 4000, 4250, 4500, 4750,
  5000, 5300, 5600, 6000, 6300, 6700, 7100, 7500, 8000, 8500,
  9000, 9500, 10000, 10600, 11200, 11800, 12500, 13200, 14000, 15000,
  16000, 17000, 18000, 19000, 20000,
]);

export const Q_TABLE = Object.freeze([
  0.5, 0.53, 0.56, 0.59, 0.63, 0.67, 0.71, 0.75, 0.79, 0.84,
  0.89, 0.94, 1, 1.06, 1.12, 1.19, 1.26, 1.33, 1.41, 1.5,
  1.59, 1.68, 1.78, 1.89, 2, 2.12, 2.24, 2.38, 2.52, 2.67,
  2.83, 3, 3.17, 3.36, 3.56, 3.78, 4, 4.24, 4.49, 4.76,
  5.04, 5.34, 5.66, 5.99, 6.35, 6.73, 7.13, 7.55, 8, 8.48,
  8.98, 9.51, 10.08, 10.68, 11.31, 11.99, 12.7, 13.45, 14.25, 15.1,
  16,
]);

export const RATIO_TABLE = Object.freeze([
  1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45,
  1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95,
  2, 2.05, 2.1, 2.15, 2.2, 2.25, 2.3, 2.35, 2.4, 2.45,
  2.5, 2.55, 2.6, 2.65, 2.7, 2.75, 2.8, 2.85, 2.9, 2.95,
  3, 3.05, 3.1, 3.15, 3.2, 3.25, 3.3, 3.35, 3.4, 3.45,
  3.5, 3.55, 3.6, 3.65, 3.7, 3.75, 3.8, 3.85, 3.9, 3.95,
  4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9,
  5, 5.2, 5.4, 5.6, 5.8, 6, 6.2, 6.4, 6.6, 6.8,
  7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12, 13,
  14, 15, 16, 17, 18, 19, 20, 22, 24, 26,
  28, 30, 32, 34, 36, 38, 40, 45, 50, 55,
  60, 65, 70, 80, 90, 100, 150, 200, 300, 500,
  3000,
]);

export const ATTACK_TABLE_MS = Object.freeze([
  0.01, 0.011, 0.012, 0.013, 0.014, 0.015, 0.016, 0.017, 0.018, 0.019,
  0.02, 0.021, 0.022, 0.023, 0.024, 0.025, 0.026, 0.027, 0.028, 0.029,
  0.03, 0.031, 0.032, 0.033, 0.034, 0.035, 0.036, 0.037, 0.039, 0.04,
  0.041, 0.042, 0.043, 0.045, 0.046, 0.047, 0.049, 0.05, 0.052, 0.054,
  0.055, 0.057, 0.059, 0.06, 0.062, 0.064, 0.066, 0.068, 0.07, 0.072,
  0.074, 0.077, 0.079, 0.081, 0.084, 0.086, 0.089, 0.092, 0.095, 0.097,
  0.1, 0.103, 0.107, 0.11, 0.113, 0.117, 0.12, 0.124, 0.128, 0.131,
  0.135, 0.14, 0.144, 0.148, 0.153, 0.157, 0.162, 0.167, 0.172, 0.177,
  0.183, 0.188, 0.194, 0.2, 0.206, 0.212, 0.219, 0.225, 0.232, 0.239,
  0.247, 0.254, 0.262, 0.27, 0.278, 0.287, 0.295, 0.304, 0.313, 0.323,
  0.333, 0.343, 0.353, 0.364, 0.375, 0.387, 0.398, 0.41, 0.423, 0.436,
  0.449, 0.463, 0.477, 0.491, 0.506, 0.522, 0.537, 0.554, 0.571, 0.588,
  0.606, 0.624, 0.643, 0.663, 0.683, 0.704, 0.725, 0.747, 0.77, 0.793,
  0.818, 0.842, 0.868, 0.894, 0.922, 0.95, 0.979, 1.008, 1.039, 1.071,
  1.103, 1.137, 1.171, 1.207, 1.244, 1.281, 1.32, 1.36, 1.402, 1.444,
  1.488, 1.534, 1.58, 1.628, 1.678, 1.729, 1.781, 1.836, 1.891, 1.949,
  2.008, 2.069, 2.132, 2.197, 2.264, 2.333, 2.404, 2.477, 2.552, 2.63,
  2.71, 2.792, 2.877, 2.965, 3.055, 3.148, 3.243, 3.342, 3.444, 3.548,
  3.656, 3.767, 3.882, 4, 4.122, 4.247, 4.376, 4.509, 4.646, 4.788,
  4.933, 5.083, 5.238, 5.397, 5.561, 5.73, 5.905, 6.084, 6.269, 6.46,
  6.656, 6.859, 7.067, 7.282, 7.504, 7.732, 7.967, 8.209, 8.459, 8.716,
  8.981, 9.254, 9.536, 9.826, 10.12, 10.43, 10.75, 11.08, 11.41, 11.76,
  12.12, 12.49, 12.87, 13.26, 13.66, 14.08, 14.5, 14.95, 15.4, 15.87,
  16.35, 16.85, 17.36, 17.89, 18.43, 18.99, 19.57, 20.17, 20.78, 21.41,
  22.06, 22.73, 23.42, 24.14, 24.87, 25.63, 26.41, 27.21, 28.04, 28.89,
  29.77, 30.67, 31.61, 32.57, 33.56, 34.58, 35.63, 36.71, 37.83, 38.98,
  40.17, 41.39, 42.65, 43.94, 45.28, 46.66, 48.07, 49.54, 51.04, 52.6,
  54.19, 55.84, 57.54, 59.29, 61.09, 62.95, 64.87, 66.84, 68.87, 70.97,
  73.12, 75.35, 77.64, 80,
]);

export const RELEASE_TABLE_MS = Object.freeze([
  6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 7, 7.1, 7.2,
  7.4, 7.5, 7.6, 7.7, 7.9, 8, 8.1, 8.3, 8.4, 8.6,
  8.7, 8.9, 9, 9.2, 9.3, 9.5, 9.7, 9.8, 10, 10.2,
  10.3, 10.5, 10.7, 10.9, 11.1, 11.2, 11.4, 11.6, 11.8, 12,
  12.2, 12.5, 12.7, 12.9, 13.1, 13.3, 13.6, 13.8, 14, 14.3,
  14.5, 14.8, 15, 15.3, 15.5, 15.8, 16.1, 16.3, 16.6, 16.9,
  17.2, 17.5, 17.8, 18.1, 18.4, 18.7, 19, 19.4, 19.7, 20,
  20.4, 20.7, 21.1, 21.4, 21.8, 22.2, 22.6, 22.9, 23.3, 23.7,
  24.1, 24.5, 25, 25.4, 25.8, 26.3, 26.7, 27.2, 27.6, 28.1,
  28.6, 29.1, 29.6, 30.1, 30.6, 31.1, 31.7, 32.2, 32.7, 33.3,
  33.9, 34.4, 35, 35.6, 36.2, 36.9, 37.5, 38.1, 38.8, 39.4,
  40.1, 40.8, 41.5, 42.2, 42.9, 43.7, 44.4, 45.2, 45.9, 46.7,
  47.5, 48.3, 49.2, 50, 50.9, 51.7, 52.6, 53.5, 54.4, 55.3,
  56.3, 57.3, 58.2, 59.2, 60.2, 61.3, 62.3, 63.4, 64.5, 65.6,
  66.7, 67.8, 69, 70.1, 71.3, 72.6, 73.8, 75.1, 76.3, 77.6,
  79, 80.3, 81.7, 83.1, 84.5, 85.9, 87.4, 88.9, 90.4, 92,
  93.5, 95.1, 96.7, 98.4, 100.1, 101.8, 103.5, 105.3, 107.1, 108.9,
  110.8, 112.7, 114.6, 116.5, 118.5, 120.6, 122.6, 124.7, 126.8, 129,
  131.2, 133.4, 135.7, 138, 140.4, 142.8, 145.2, 147.7, 150.2, 152.8,
  155.4, 158, 160.7, 163.5, 166.3, 169.1, 172, 174.9, 177.9, 180.9,
  184, 187.2, 190.4, 193.6, 196.9, 200.3, 203.7, 207.2, 210.7, 214.3,
  218, 221.7, 225.5, 229.3, 233.2, 237.2, 241.2, 245.4, 249.5, 253.8,
  258.1, 262.5, 267, 271.6, 276.2, 280.9, 285.7, 290.6, 295.5, 300.6,
  305.7, 310.9, 316.2, 321.6, 327.1, 332.7, 338.4, 344.1, 350, 356,
  362.1, 368.2, 374.5, 380.9, 387.4, 394, 400.7, 407.6, 414.5, 421.6,
  428.8, 436.1, 443.5, 451.1, 458.8, 466.6, 474.6, 482.7, 490.9, 499.3,
  507.8, 516.5, 525.3, 534.2, 543.4, 552.6, 562.1, 571.6, 581.4, 591.3,
  601.4, 611.7, 622.1, 632.7, 643.5, 654.5, 665.6, 677, 688.5, 700.3,
  712.2, 724.4, 736.7, 749.3, 762.1, 775.1, 788.3, 801.8, 815.4, 829.3,
  843.5, 857.9, 872.5, 887.4, 902.5, 917.9, 933.6, 949.5, 965.7, 982.2,
  999,
]);


export const KNEE_NAMES = Object.freeze(["soft", "medium", "hard"]);

/*
  Raw ranges of every channel strip parameter (inclusive) and the device
  defaults (from UR44-params.js).
*/
export const PARAM_RANGES = Object.freeze({
  compBypass: { min: 0, max: 1, default: 0 },
  eqBypass: { min: 0, max: 1, default: 0 },
  drive: { min: 0, max: 200, default: 100 },
  attack: { min: 57, max: 283, default: 184 },
  release: { min: 24, max: 300, default: 159 },
  ratio: { min: 0, max: 120, default: 30 },
  knee: { min: 0, max: 2, default: 1 },
  threshOfst: { min: 0, max: 200, default: 100 },
  makeupOfst: { min: 0, max: 200, default: 70 },
  sidechainF: { min: 4, max: 124, default: 30 },
  sidechainG: { min: 0, max: 360, default: 133 },
  sidechainQ: { min: 0, max: 60, default: 12 },
  lowFreq: { min: 4, max: 72, default: 32 },
  lowGain: { min: 0, max: 360, default: 180 },
  midFreq: { min: 4, max: 124, default: 71 },
  midGain: { min: 0, max: 360, default: 180 },
  midQ: { min: 0, max: 60, default: 12 },
  highFreq: { min: 60, max: 124, default: 112 },
  highGain: { min: 0, max: 360, default: 180 },
  totalGain: { min: 0, max: 360, default: 180 },
});

export const DEFAULT_PARAMS = Object.freeze(Object.fromEntries(
  Object.entries(PARAM_RANGES).map(([key, range]) => [key, range.default]),
));

export const EQ_BANDS = Object.freeze({
  low: Object.freeze({ freq: "lowFreq", gain: "lowGain" }),
  mid: Object.freeze({ freq: "midFreq", gain: "midGain", q: "midQ" }),
  high: Object.freeze({ freq: "highFreq", gain: "highGain" }),
});

export const EQ_GAIN_MIN_DB = -18;
export const EQ_GAIN_MAX_DB = 18;
export const DEFAULT_SAMPLE_RATE = 48000;

/* ---------- generic helpers ---------- */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/*
  Clamps a raw value to the param's range and rounds it to an integer.
  Non-finite input yields the param's default.
*/
export const clampRaw = (param, raw) => {
  const range = PARAM_RANGES[param];
  if (!range) {
    throw new Error(`Unknown channel strip param: ${param}`);
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return range.default;
  }
  return clamp(Math.round(num), range.min, range.max);
};

/*
  Returns a full param object: every known key is present, taken from
  `params` when it is a finite number, otherwise the device default.
  Values are clamped to their raw range.
*/
export const normalizeParams = (params) => {
  const result = {};
  for (const key of Object.keys(PARAM_RANGES)) {
    const value = params ? params[key] : undefined;
    result[key] = (value === undefined || value === null || value === "")
      ? PARAM_RANGES[key].default
      : clampRaw(key, value);
  }
  return result;
};

const tableLookup = (table, raw) => {
  return table[clamp(Math.round(Number(raw) || 0), 0, table.length - 1)];
};

/*
  Index (within [min, max]) of the table entry closest to `value`.
  `log` compares in the log domain (frequencies, Q, times, ratios).
*/
const nearestIndex = (table, value, min, max, log = true) => {
  const target = log ? Math.log(Math.max(value, 1e-9)) : value;
  let best = min;
  let bestDist = Infinity;
  for (let i = min; i <= max; i++) {
    const v = log ? Math.log(table[i]) : table[i];
    const dist = Math.abs(v - target);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
};

/* ---------- raw <-> display conversions ---------- */

// Drive: 0..200 -> 0.00..10.00
export const driveToValue = (raw) => clampRaw("drive", raw) * 0.05;
export const valueToDrive = (value) => clampRaw("drive", value / 0.05);

// Threshold derived from Drive (before threshOfst): 0..200 -> 0..-40 dB
export const driveToThresholdDb = (raw) => -clampRaw("drive", raw) * 0.2;

export const attackToMs = (raw) => {
  return ATTACK_TABLE_MS[clampRaw("attack", raw)];
};
export const msToAttack = (ms) => {
  const { min, max } = PARAM_RANGES.attack;
  return nearestIndex(ATTACK_TABLE_MS, ms, min, max);
};

export const releaseToMs = (raw) => {
  return RELEASE_TABLE_MS[clampRaw("release", raw)];
};
export const msToRelease = (ms) => {
  const { min, max } = PARAM_RANGES.release;
  return nearestIndex(RELEASE_TABLE_MS, ms, min, max);
};

/*
  Ratio as displayed: 1.00..500, raw 120 is Infinity ("inf").
  Use ratioToDspValue() for the value the DSP actually uses (3000 at 120).
*/
export const ratioToValue = (raw) => {
  const index = clampRaw("ratio", raw);
  return index === PARAM_RANGES.ratio.max ? Infinity : RATIO_TABLE[index];
};
export const ratioToDspValue = (raw) => RATIO_TABLE[clampRaw("ratio", raw)];
export const valueToRatio = (ratio) => {
  if (ratio === Infinity || ratio >= RATIO_TABLE[120]) {
    return PARAM_RANGES.ratio.max;
  }
  const { min, max } = PARAM_RANGES.ratio;
  return nearestIndex(RATIO_TABLE, ratio, min, max - 1);
};

export const kneeToName = (raw) => KNEE_NAMES[clampRaw("knee", raw)];
export const nameToKnee = (name) => {
  const index = KNEE_NAMES.indexOf(name);
  return index === -1 ? PARAM_RANGES.knee.default : index;
};

/*
  Frequency index -> Hz. `param` selects the clamp range
  ("lowFreq", "midFreq", "highFreq", "sidechainF"); without a param the full
  table (0..124, 16 Hz..20 kHz) is used.
*/
export const freqToHz = (raw, param) => {
  return param
    ? FREQ_TABLE_HZ[clampRaw(param, raw)]
    : tableLookup(FREQ_TABLE_HZ, raw);
};
export const hzToFreq = (hz, param = "midFreq") => {
  const { min, max } = PARAM_RANGES[param];
  return nearestIndex(FREQ_TABLE_HZ, hz, min, max);
};

// Gains (EQ bands, sidechain, total gain): 0..360 -> -18.0..+18.0 dB
export const gainToDb = (raw) => {
  return Math.round(clampRaw("totalGain", raw) - 180) / 10;
};
export const dbToGain = (db) => {
  return clampRaw("totalGain", Math.round(Number(db) * 10) + 180);
};

export const qToValue = (raw) => Q_TABLE[clampRaw("midQ", raw)];
export const valueToQ = (q) => nearestIndex(Q_TABLE, q, 0, 60);

// Hidden morph params
export const threshOfstToDb = (raw) => clampRaw("threshOfst", raw) * 0.2 - 20;
export const makeupOfstToRatio = (raw) => clampRaw("makeupOfst", raw) * 0.005;

const PARAM_KIND = Object.freeze({
  compBypass: "bool",
  eqBypass: "bool",
  drive: "drive",
  attack: "attack",
  release: "release",
  ratio: "ratio",
  knee: "knee",
  threshOfst: "threshOfst",
  makeupOfst: "makeupOfst",
  sidechainF: "freq",
  lowFreq: "freq",
  midFreq: "freq",
  highFreq: "freq",
  sidechainG: "gain",
  lowGain: "gain",
  midGain: "gain",
  highGain: "gain",
  totalGain: "gain",
  sidechainQ: "q",
  midQ: "q",
});

/*
  Generic raw -> display number (bypass params: boolean "is bypassed",
  knee: name string, ratio 120: Infinity).
*/
export const toDisplay = (param, raw) => {
  switch (PARAM_KIND[param]) {
  case "bool": return clampRaw(param, raw) === 1;
  case "drive": return driveToValue(raw);
  case "attack": return attackToMs(raw);
  case "release": return releaseToMs(raw);
  case "ratio": return ratioToValue(raw);
  case "knee": return kneeToName(raw);
  case "threshOfst": return threshOfstToDb(raw);
  case "makeupOfst": return makeupOfstToRatio(raw);
  case "freq": return freqToHz(raw, param);
  case "gain": return gainToDb(raw);
  case "q": return Q_TABLE[clampRaw(param, raw)];
  default: throw new Error(`Unknown channel strip param: ${param}`);
  }
};

// Generic display -> nearest raw value (inverse of toDisplay), clamped.
export const fromDisplay = (param, value) => {
  switch (PARAM_KIND[param]) {
  case "bool": return value ? 1 : 0;
  case "drive": return valueToDrive(value);
  case "attack": return msToAttack(value);
  case "release": return msToRelease(value);
  case "ratio": return valueToRatio(value);
  case "knee": return typeof value === "string"
    ? nameToKnee(value)
    : clampRaw("knee", value);
  case "threshOfst": return clampRaw(param, (value + 20) / 0.2);
  case "makeupOfst": return clampRaw(param, value / 0.005);
  case "freq": return hzToFreq(value, param);
  case "gain": return clampRaw(param, dbToGain(value));
  case "q": return clampRaw(param, valueToQ(value));
  default: throw new Error(`Unknown channel strip param: ${param}`);
  }
};

export const formatHz = (hz) => {
  if (hz < 1000) return `${hz.toFixed(1)} Hz`;
  if (hz < 10000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${(hz / 1000).toFixed(1)} kHz`;
};

const formatMs = (ms, decimals) => `${ms.toFixed(decimals)} ms`;

const formatDb = (db) => {
  const rounded = Math.round(db * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
};

// Human readable label, e.g. "4.122 ms", "1.00 kHz", "+3.5 dB", "inf".
export const formatParam = (param, raw) => {
  const value = toDisplay(param, raw);
  switch (PARAM_KIND[param]) {
  case "bool": return value ? "off" : "on";
  case "drive": return value.toFixed(2);
  case "attack": return formatMs(value, value < 10 ? 3 : 2);
  case "release": return formatMs(value, 1);
  case "ratio": return value === Infinity ? "inf" : value.toFixed(2);
  case "knee": return value;
  case "threshOfst": return formatDb(value);
  case "makeupOfst": return value.toFixed(3);
  case "freq": return formatHz(value);
  case "gain": return formatDb(value);
  case "q": return value.toFixed(2);
  default: return String(value);
  }
};

/* ---------- compressor ---------- */

const MIN_THRESHOLD_DB = -54;
// Knee half widths in units of (dB over threshold) / 20.
const KNEE_HALF_WIDTH = [1.3, 0.5, 0];

/*
  Effective threshold in dBFS: Drive threshold shifted by threshOfst.
  Negative offsets are faded in over the first 6.2 dB so that Drive 0 never
  compresses. Clamped to -54..0 dB.
*/
export const getEffectiveThresholdDb = (params) => {
  const p = normalizeParams(params);
  const threshold = driveToThresholdDb(p.drive);
  const offset = threshOfstToDb(p.threshOfst);
  let effective = threshold + offset;
  if (offset < 0 && threshold >= -6.2) {
    effective = threshold * (threshold + offset) / -6.2;
  }
  return clamp(effective, MIN_THRESHOLD_DB, 0) + 0;
};

/*
  Auto makeup gain in dB: makeupOfst ratio times the static gain reduction
  a 0 dBFS signal would get with a hard knee.
*/
export const getMakeupDb = (params) => {
  const p = normalizeParams(params);
  const slope = 1 - 1 / ratioToDspValue(p.ratio);
  return -getEffectiveThresholdDb(p) * slope * makeupOfstToRatio(p.makeupOfst)
    + 0;
};

/*
  Static gain change (<= 0 dB) the compressor applies to a steady signal at
  `inDb` dBFS, without makeup/total gain.
  Ignores compBypass.
*/
export const getCompressorGainDb = (inDb, params) => {
  const p = normalizeParams(params);
  const threshold = getEffectiveThresholdDb(p);
  const slope = 1 - 1 / ratioToDspValue(p.ratio);
  const x = Math.max(inDb - threshold, -30) / 20;
  // With a 0 dB threshold the DSP always uses a hard knee.
  const w = threshold === 0 ? 0 : KNEE_HALF_WIDTH[p.knee];
  let over;
  if (x > w) {
    over = x;
  } else if (x <= -w) {
    over = 0;
  } else {
    over = (x + w) * (x + w) / (4 * w);
  }
  return -20 * over * slope + 0;
};

/*
  Static transfer curve: [{ inDb, outDb }] from minDb to maxDb (inclusive).
  options:
    minDb (-60), maxDb (0), step (0.5 dB),
    includeMakeup (true): add auto makeup gain,
    includeTotalGain (true): add total gain.
  dspMixFx's own graph draws the curve without makeup/total gain; pass
  { includeMakeup: false, includeTotalGain: false } to match it.
  With compBypass = 1 the curve is the identity (+ total gain).
*/
export const computeCompressorCurve = (params, options = {}) => {
  const {
    minDb = -60,
    maxDb = 0,
    step = 0.5,
    includeMakeup = true,
    includeTotalGain = true,
  } = options;
  const p = normalizeParams(params);
  const bypassed = p.compBypass === 1;
  const offset = (includeTotalGain ? gainToDb(p.totalGain) : 0)
    + (!bypassed && includeMakeup ? getMakeupDb(p) : 0);
  const points = [];
  const count = Math.max(1, Math.round((maxDb - minDb) / step));
  for (let i = 0; i <= count; i++) {
    const inDb = minDb + (maxDb - minDb) * i / count;
    const gr = bypassed ? 0 : getCompressorGainDb(inDb, p);
    points.push({ inDb, outDb: inDb + gr + offset });
  }
  return points;
};

/* ---------- EQ ---------- */

/*
  Biquad coefficients use the convention
    H(z) = (b0 + b1 z^-1 + b2 z^-2) / (1 + a1 z^-1 + a2 z^-2).
*/
const IDENTITY = Object.freeze({ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 });

// Per-band filter design constants.
const SHELF_SLOPE = 0.32;
const PEQ_GAIN_Q_EXPONENT = 0.7;
const DESIGN_GAIN_DB = 18;

const isPassthrough = (fs, f0) => fs < 44100 && f0 > fs / 2 - 10;

/* First order low shelf whose corner moves with gain. */
export const lowShelfCoefficients = (fs, f0, gainDb) => {
  if (isPassthrough(fs, f0)) return { ...IDENTITY };
  const v = Math.pow(10, Math.abs(gainDb) / 20);
  const w = Math.pow(10, DESIGN_GAIN_DB / 20);
  const k = Math.tan(Math.PI * f0 / fs)
    * Math.pow(v, 1 - SHELF_SLOPE) * Math.pow(w, SHELF_SLOPE);
  if (gainDb >= 0) {
    const n = v + k;
    return {
      b0: v * (k + 1) / n,
      b1: -v * (1 - k) / n,
      b2: 0,
      a1: -(v - k) / n,
      a2: 0,
    };
  }
  const n = k + 1;
  return {
    b0: (k / v + 1) / n,
    b1: -(1 - k / v) / n,
    b2: 0,
    a1: -(1 - k) / n,
    a2: 0,
  };
};

// First order high shelf.
export const highShelfCoefficients = (fs, f0, gainDb) => {
  if (isPassthrough(fs, f0)) return { ...IDENTITY };
  const v = Math.pow(10, gainDb / 20);
  const w = Math.pow(10, DESIGN_GAIN_DB / 20);
  const t = Math.tan(Math.PI * f0 / fs) * Math.pow(w, -SHELF_SLOPE);
  if (gainDb < 0) {
    const k = t * Math.pow(v, 1 - SHELF_SLOPE);
    const n = k + 1;
    return {
      b0: (v + k) / n,
      b1: (k - v) / n,
      b2: 0,
      a1: -(1 - k) / n,
      a2: 0,
    };
  }
  const k = t * Math.pow(v, SHELF_SLOPE - 1);
  const n = v * k + 1;
  return {
    b0: v * (k + 1) / n,
    b1: -v * (1 - k) / n,
    b2: 0,
    a1: -(1 - v * k) / n,
    a2: 0,
  };
};

// High frequency Q compensation [fsLimit, f0Limit, c(log2 Q), c0, c(f0)].
const Q_COMPENSATION = [
  [48000, 2000, -0.0301, 1.25513, -4.817e-05],
  [88200, 2000, -0.02143, 1.25686, -4.103e-05],
  [96000, 4000, -0.0317, 1.29486, -2.462e-05],
  [Infinity, 4000, -0.02382, 1.21531, -2.004e-05],
];

/*
  Peaking EQ (Zoelzer bilinear design).
  The effective Q widens for small gains: Q * (10^((|g| - 18) / 20))^0.7,
  and is compensated near Nyquist.
*/
export const peakingCoefficients = (fs, f0, gainDb, q) => {
  if (isPassthrough(fs, f0)) return { ...IDENTITY };
  let qc = q;
  const [, f0Limit, cq, c0, cf] = Q_COMPENSATION
    .find(([fsLimit]) => fs < fsLimit);
  if (f0 > f0Limit) {
    const factor = Math.log2(q) * cq + c0 + f0 * cf;
    if (factor <= 1) {
      qc = Math.max(factor * q, 0.1);
    }
  }
  const absGain = Math.abs(gainDb);
  const v = Math.pow(10, absGain / 20);
  const qEff = qc * Math.pow(
    Math.pow(10, (absGain - DESIGN_GAIN_DB) / 20),
    PEQ_GAIN_Q_EXPONENT,
  );
  const k = Math.tan(Math.PI * f0 / fs);
  const kk = k * k;
  const plain = k / qEff;
  const scaled = v * k / qEff;
  const num = gainDb < 0 ? plain : scaled;
  const den = gainDb < 0 ? scaled : plain;
  const a0 = 1 + den + kk;
  return {
    b0: (1 + num + kk) / a0,
    b1: 2 * (kk - 1) / a0,
    b2: (1 - num + kk) / a0,
    a1: 2 * (kk - 1) / a0,
    a2: (1 - den + kk) / a0,
  };
};

// |H(e^jw)| in dB.
export const biquadMagnitudeDb = (coefs, freq, sampleRate) => {
  const w = 2 * Math.PI * freq / sampleRate;
  const cos1 = Math.cos(w);
  const sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w);
  const sin2 = Math.sin(2 * w);
  const nr = coefs.b0 + coefs.b1 * cos1 + coefs.b2 * cos2;
  const ni = -(coefs.b1 * sin1 + coefs.b2 * sin2);
  const dr = 1 + coefs.a1 * cos1 + coefs.a2 * cos2;
  const di = -(coefs.a1 * sin1 + coefs.a2 * sin2);
  const num = nr * nr + ni * ni;
  const den = dr * dr + di * di;
  return 10 * Math.log10(Math.max(num, 1e-30) / Math.max(den, 1e-30));
};

/*
  Coefficients of one EQ band ("low" | "mid" | "high") for raw params.
*/
export const getBandCoefficients = (
  params,
  band,
  sampleRate = DEFAULT_SAMPLE_RATE,
) => {
  const p = normalizeParams(params);
  const keys = EQ_BANDS[band];
  if (!keys) {
    throw new Error(`Unknown EQ band: ${band}`);
  }
  const f0 = freqToHz(p[keys.freq], keys.freq);
  const gain = gainToDb(p[keys.gain]);
  if (band === "low") return lowShelfCoefficients(sampleRate, f0, gain);
  if (band === "high") return highShelfCoefficients(sampleRate, f0, gain);
  return peakingCoefficients(sampleRate, f0, gain, qToValue(p[keys.q]));
};

/*
  EQ magnitude response in dB for each frequency in `freqs`.
  options:
    sampleRate (48000),
    includeTotalGain (true): add total gain,
    bands (["low", "mid", "high"]): restrict to some bands (e.g. to draw a
      single band's contribution).
  With eqBypass = 1 the response is flat (0 dB + total gain).
  Like dspMixFx, frequencies above 0.48 * sampleRate are evaluated at
  0.48 * sampleRate.
*/
export const computeEQResponse = (params, freqs, options = {}) => {
  const {
    sampleRate = DEFAULT_SAMPLE_RATE,
    includeTotalGain = true,
    bands = ["low", "mid", "high"],
  } = options;
  const p = normalizeParams(params);
  const offset = includeTotalGain ? gainToDb(p.totalGain) : 0;
  if (p.eqBypass === 1) {
    return freqs.map(() => offset);
  }
  const coefs = bands.map(band => getBandCoefficients(p, band, sampleRate));
  const maxFreq = sampleRate * 0.48;
  return freqs.map((freq) => {
    const f = Math.min(freq, maxFreq);
    let sum = offset;
    for (const c of coefs) {
      sum += biquadMagnitudeDb(c, f, sampleRate);
    }
    return sum;
  });
};

// `count` log-spaced frequencies from fMin to fMax (inclusive).
export const logFrequencies = (count = 200, fMin = 20, fMax = 20000) => {
  const result = [];
  const ratio = Math.log(fMax / fMin);
  for (let i = 0; i < count; i++) {
    result.push(fMin * Math.exp(ratio * i / Math.max(1, count - 1)));
  }
  return result;
};

/* ---------- handle mapping ---------- */

/*
  Maps a dragged EQ handle position back to the nearest raw device values.
  Returns e.g. { lowFreq: 32, lowGain: 205 }; only the keys for which a
  value was given (freqHz / gainDb / q) are included.
*/
export const handleToRaw = (band, { freqHz, gainDb, q } = {}) => {
  const keys = EQ_BANDS[band];
  if (!keys) {
    throw new Error(`Unknown EQ band: ${band}`);
  }
  const result = {};
  if (Number.isFinite(freqHz)) {
    result[keys.freq] = hzToFreq(freqHz, keys.freq);
  }
  if (Number.isFinite(gainDb)) {
    result[keys.gain] = dbToGain(gainDb);
  }
  if (keys.q && Number.isFinite(q)) {
    result[keys.q] = valueToQ(q);
  }
  return result;
};

// Handle position for a band: { freqHz, gainDb, q? } from raw params.
export const rawToHandle = (params, band) => {
  const p = normalizeParams(params);
  const keys = EQ_BANDS[band];
  const handle = {
    freqHz: freqToHz(p[keys.freq], keys.freq),
    gainDb: gainToDb(p[keys.gain]),
  };
  if (keys.q) {
    handle.q = qToValue(p[keys.q]);
  }
  return handle;
};
