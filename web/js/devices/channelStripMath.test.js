import { describe, it, expect } from "vitest";
import {
  PARAM_RANGES,
  DEFAULT_PARAMS,
  FREQ_TABLE_HZ,
  Q_TABLE,
  RATIO_TABLE,
  ATTACK_TABLE_MS,
  RELEASE_TABLE_MS,
  clampRaw,
  normalizeParams,
  driveToValue,
  valueToDrive,
  driveToThresholdDb,
  attackToMs,
  msToAttack,
  releaseToMs,
  msToRelease,
  ratioToValue,
  ratioToDspValue,
  valueToRatio,
  kneeToName,
  nameToKnee,
  freqToHz,
  hzToFreq,
  gainToDb,
  dbToGain,
  qToValue,
  valueToQ,
  threshOfstToDb,
  makeupOfstToRatio,
  toDisplay,
  fromDisplay,
  formatParam,
  getEffectiveThresholdDb,
  getMakeupDb,
  getCompressorGainDb,
  computeCompressorCurve,
  computeEQResponse,
  getBandCoefficients,
  biquadMagnitudeDb,
  logFrequencies,
  handleToRaw,
  rawToHandle,
} from "./channelStripMath.js";

const slope = (curve, fromDb, toDb) => {
  const a = curve.find(p => Math.abs(p.inDb - fromDb) < 1e-9);
  const b = curve.find(p => Math.abs(p.inDb - toDb) < 1e-9);
  return (b.outDb - a.outDb) / (b.inDb - a.inDb);
};

// Hard knee, threshold -20 dB, no makeup, 0 dB total gain.
const hardParams = (ratio) => ({
  ...DEFAULT_PARAMS,
  drive: 100,
  threshOfst: 100,
  makeupOfst: 0,
  knee: 2,
  ratio,
});

describe("tables", () => {
  it("have one entry per raw value", () => {
    expect(FREQ_TABLE_HZ).toHaveLength(125);
    expect(Q_TABLE).toHaveLength(61);
    expect(RATIO_TABLE).toHaveLength(121);
    expect(ATTACK_TABLE_MS).toHaveLength(284);
    expect(RELEASE_TABLE_MS).toHaveLength(301);
  });

  it("are strictly increasing", () => {
    for (const table of [
      FREQ_TABLE_HZ, Q_TABLE, RATIO_TABLE, ATTACK_TABLE_MS, RELEASE_TABLE_MS,
    ]) {
      for (let i = 1; i < table.length; i++) {
        expect(table[i]).toBeGreaterThan(table[i - 1]);
      }
    }
  });
});

describe("conversions at documented anchor points", () => {
  it("drive", () => {
    expect(driveToValue(0)).toBe(0);
    expect(driveToValue(100)).toBeCloseTo(5, 10);
    expect(driveToValue(200)).toBeCloseTo(10, 10);
    expect(driveToThresholdDb(200)).toBeCloseTo(-40, 10);
  });

  it("attack", () => {
    expect(attackToMs(57)).toBe(0.092);
    expect(attackToMs(184)).toBe(4.122);
    expect(attackToMs(283)).toBe(80);
  });

  it("release", () => {
    expect(releaseToMs(24)).toBe(9.3);
    expect(releaseToMs(159)).toBe(92);
    expect(releaseToMs(300)).toBe(999);
  });

  it("ratio", () => {
    expect(ratioToValue(0)).toBe(1);
    expect(ratioToValue(30)).toBe(2.5);
    expect(ratioToValue(60)).toBe(4);
    expect(ratioToValue(90)).toBe(14);
    expect(ratioToValue(120)).toBe(Infinity);
    expect(ratioToDspValue(120)).toBe(3000);
  });

  it("knee", () => {
    expect(kneeToName(0)).toBe("soft");
    expect(kneeToName(1)).toBe("medium");
    expect(kneeToName(2)).toBe("hard");
    expect(nameToKnee("hard")).toBe(2);
  });

  it("frequencies", () => {
    expect(freqToHz(4, "lowFreq")).toBe(20);
    expect(freqToHz(32, "lowFreq")).toBe(100);
    expect(freqToHz(72, "lowFreq")).toBe(1000);
    expect(freqToHz(30, "sidechainF")).toBe(90);
    expect(freqToHz(124, "midFreq")).toBe(20000);
    expect(freqToHz(60, "highFreq")).toBe(500);
    expect(freqToHz(112, "highFreq")).toBe(10000);
    expect(freqToHz(124, "highFreq")).toBe(20000);
  });

  it("gains", () => {
    expect(gainToDb(0)).toBe(-18);
    expect(gainToDb(133)).toBe(-4.7);
    expect(gainToDb(180)).toBe(0);
    expect(gainToDb(360)).toBe(18);
  });

  it("Q", () => {
    expect(qToValue(0)).toBe(0.5);
    expect(qToValue(12)).toBe(1);
    expect(qToValue(60)).toBe(16);
  });

  it("hidden morph params", () => {
    expect(threshOfstToDb(100)).toBeCloseTo(0, 10);
    expect(threshOfstToDb(0)).toBeCloseTo(-20, 10);
    expect(makeupOfstToRatio(70)).toBeCloseTo(0.35, 10);
  });

  it("formats labels", () => {
    expect(formatParam("attack", 184)).toBe("4.122 ms");
    expect(formatParam("attack", 283)).toBe("80.00 ms");
    expect(formatParam("release", 159)).toBe("92.0 ms");
    expect(formatParam("ratio", 120)).toBe("inf");
    expect(formatParam("ratio", 30)).toBe("2.50");
    expect(formatParam("midFreq", 72)).toBe("1.00 kHz");
    expect(formatParam("highFreq", 112)).toBe("10.0 kHz");
    expect(formatParam("sidechainF", 30)).toBe("90.0 Hz");
    expect(formatParam("lowGain", 215)).toBe("+3.5 dB");
    expect(formatParam("totalGain", 180)).toBe("0.0 dB");
    expect(formatParam("drive", 100)).toBe("5.00");
    expect(formatParam("eqBypass", 1)).toBe("off");
  });
});

describe("inverse round trips", () => {
  for (const param of Object.keys(PARAM_RANGES)) {
    it(`fromDisplay(toDisplay(raw)) === raw for ${param}`, () => {
      const { min, max } = PARAM_RANGES[param];
      for (let raw = min; raw <= max; raw++) {
        expect(fromDisplay(param, toDisplay(param, raw))).toBe(raw);
      }
    });
  }

  it("specific inverses", () => {
    expect(valueToDrive(5)).toBe(100);
    expect(msToAttack(4.122)).toBe(184);
    expect(msToRelease(92)).toBe(159);
    expect(valueToRatio(Infinity)).toBe(120);
    expect(valueToRatio(4)).toBe(60);
    expect(hzToFreq(1000, "midFreq")).toBe(72);
    expect(dbToGain(-4.7)).toBe(133);
    expect(valueToQ(1)).toBe(12);
  });

  it("picks the nearest value in between table entries", () => {
    expect(hzToFreq(1029, "midFreq")).toBe(72);
    expect(hzToFreq(1030, "midFreq")).toBe(73);
    expect(dbToGain(3.04)).toBe(210);
    expect(valueToQ(0.99)).toBe(12);
  });
});

describe("clamping", () => {
  it("clamps raw values to the param range", () => {
    expect(clampRaw("attack", 0)).toBe(57);
    expect(clampRaw("attack", 1000)).toBe(283);
    expect(clampRaw("lowFreq", 124)).toBe(72);
    expect(clampRaw("highFreq", 4)).toBe(60);
    expect(clampRaw("midGain", 179.6)).toBe(180);
    expect(clampRaw("midGain", NaN)).toBe(180);
    expect(() => clampRaw("nope", 1)).toThrow();
  });

  it("clamps inverse conversions to the param range", () => {
    expect(hzToFreq(5, "lowFreq")).toBe(4);
    expect(hzToFreq(5000, "lowFreq")).toBe(72);
    expect(hzToFreq(100, "highFreq")).toBe(60);
    expect(hzToFreq(30000, "highFreq")).toBe(124);
    expect(dbToGain(-30)).toBe(0);
    expect(dbToGain(30)).toBe(360);
    expect(valueToQ(100)).toBe(60);
    expect(msToAttack(0.001)).toBe(57);
    expect(msToRelease(5000)).toBe(300);
    expect(valueToDrive(20)).toBe(200);
  });

  it("fills missing params with defaults", () => {
    const params = normalizeParams({ lowGain: 400 });
    expect(params.lowGain).toBe(360);
    expect(params.midFreq).toBe(DEFAULT_PARAMS.midFreq);
    expect(normalizeParams(undefined)).toEqual(DEFAULT_PARAMS);
  });
});

describe("handle mapping", () => {
  it("maps handle positions to raw values", () => {
    expect(handleToRaw("low", { freqHz: 100, gainDb: 6 }))
      .toEqual({ lowFreq: 32, lowGain: 240 });
    expect(handleToRaw("mid", { freqHz: 1000, gainDb: -3, q: 2 }))
      .toEqual({ midFreq: 72, midGain: 150, midQ: 24 });
    expect(handleToRaw("high", { freqHz: 10, gainDb: 99 }))
      .toEqual({ highFreq: 60, highGain: 360 });
    expect(handleToRaw("low", { gainDb: 0 })).toEqual({ lowGain: 180 });
  });

  it("round trips with rawToHandle", () => {
    const params = { ...DEFAULT_PARAMS, midFreq: 90, midGain: 250, midQ: 30 };
    expect(handleToRaw("mid", rawToHandle(params, "mid")))
      .toEqual({ midFreq: 90, midGain: 250, midQ: 30 });
  });
});

describe("compressor threshold and makeup", () => {
  it("uses -0.2 dB per drive step plus the threshold offset", () => {
    expect(getEffectiveThresholdDb({ drive: 100, threshOfst: 100 }))
      .toBeCloseTo(-20, 10);
    expect(getEffectiveThresholdDb({ drive: 100, threshOfst: 150 }))
      .toBeCloseTo(-10, 10);
    expect(getEffectiveThresholdDb({ drive: 200, threshOfst: 0 }))
      .toBeCloseTo(-54, 10);
  });

  it("never compresses with drive 0", () => {
    expect(getEffectiveThresholdDb({ drive: 0, threshOfst: 0 })).toBe(0);
    expect(getMakeupDb({ drive: 0 })).toBe(0);
  });

  it("is continuous where negative offsets fade in", () => {
    const at = drive => getEffectiveThresholdDb({ drive, threshOfst: 50 });
    // drive 31 -> -6.2 dB
    expect(at(31)).toBeCloseTo(-16.2, 10);
    expect(at(30)).toBeCloseTo(-6 * -16 / -6.2, 10);
  });

  it("makeup is a fraction of the gain reduction at 0 dBFS", () => {
    // thr -20, ratio 2.5 -> 12 dB reduction at 0 dBFS, 35 % -> 4.2 dB
    expect(getMakeupDb({ drive: 100, ratio: 30, makeupOfst: 70 }))
      .toBeCloseTo(4.2, 10);
    expect(getMakeupDb({ drive: 100, ratio: 0, makeupOfst: 200 }))
      .toBeCloseTo(0, 10);
  });
});

describe("compressor curve", () => {
  it("spans -60..0 dBFS by default", () => {
    const curve = computeCompressorCurve(DEFAULT_PARAMS);
    expect(curve[0].inDb).toBe(-60);
    expect(curve[curve.length - 1].inDb).toBe(0);
    expect(curve).toHaveLength(121);
  });

  it("has slope 1 below and 1/ratio above the threshold", () => {
    for (const ratio of [0, 30, 60, 90]) {
      const curve = computeCompressorCurve(hardParams(ratio));
      expect(slope(curve, -60, -21)).toBeCloseTo(1, 10);
      expect(slope(curve, -19, 0))
        .toBeCloseTo(1 / ratioToValue(ratio), 10);
    }
  });

  it("is (almost) flat above the threshold with ratio inf", () => {
    const curve = computeCompressorCurve(hardParams(120));
    expect(slope(curve, -20, 0)).toBeCloseTo(0, 3);
    expect(curve[curve.length - 1].outDb).toBeCloseTo(-20, 1);
  });

  it("is identity plus total gain when bypassed", () => {
    const curve = computeCompressorCurve({
      ...DEFAULT_PARAMS,
      drive: 200,
      compBypass: 1,
      totalGain: 240,
    });
    for (const { inDb, outDb } of curve) {
      expect(outDb).toBeCloseTo(inDb + 6, 10);
    }
  });

  it("adds makeup and total gain unless disabled", () => {
    const params = { ...hardParams(30), makeupOfst: 70, totalGain: 200 };
    const withAll = computeCompressorCurve(params);
    const bare = computeCompressorCurve(params, {
      includeMakeup: false,
      includeTotalGain: false,
    });
    withAll.forEach((point, i) => {
      expect(point.outDb - bare[i].outDb).toBeCloseTo(4.2 + 2, 10);
    });
  });

  it("soft knees bend around the threshold symmetrically", () => {
    const base = { ...DEFAULT_PARAMS, drive: 150, makeupOfst: 0, ratio: 60 };
    // threshold -30 dB; medium knee +-10 dB, soft knee +-26 dB
    const medium = { ...base, knee: 1 };
    const soft = { ...base, knee: 0 };
    const hard = { ...base, knee: 2 };
    expect(getCompressorGainDb(-40, medium)).toBeCloseTo(0, 10);
    expect(getCompressorGainDb(-20, medium))
      .toBeCloseTo(getCompressorGainDb(-20, hard), 10);
    expect(getCompressorGainDb(-30, hard)).toBe(0);
    // halfway through the knee: a quarter of the hard knee reduction at w
    expect(getCompressorGainDb(-30, medium)).toBeCloseTo(-10 * 0.75 / 4, 10);
    expect(getCompressorGainDb(-30, soft)).toBeCloseTo(-26 * 0.75 / 4, 10);
    expect(getCompressorGainDb(-4, soft))
      .toBeCloseTo(getCompressorGainDb(-4, hard), 10);
    expect(getCompressorGainDb(-56, soft)).toBeCloseTo(0, 10);
  });

  it("is monotonic for every knee and ratio", () => {
    for (const knee of [0, 1, 2]) {
      for (const ratio of [0, 30, 120]) {
        const curve = computeCompressorCurve({
          ...DEFAULT_PARAMS, knee, ratio, drive: 200,
        });
        for (let i = 1; i < curve.length; i++) {
          expect(curve[i].outDb).toBeGreaterThanOrEqual(curve[i - 1].outDb);
        }
      }
    }
  });

  it("degrades gracefully with missing params", () => {
    const curve = computeCompressorCurve({});
    expect(curve.every(p => Number.isFinite(p.outDb))).toBe(true);
  });
});

describe("EQ response", () => {
  const freqs = logFrequencies(100);
  const flat = { ...DEFAULT_PARAMS };

  it("logFrequencies spans 20 Hz..20 kHz", () => {
    expect(freqs[0]).toBeCloseTo(20, 10);
    expect(freqs[99]).toBeCloseTo(20000, 6);
  });

  it("is flat at total gain with 0 dB band gains", () => {
    for (const db of computeEQResponse(flat, freqs)) {
      expect(db).toBeCloseTo(0, 6);
    }
    for (const db of computeEQResponse({ ...flat, totalGain: 300 }, freqs)) {
      expect(db).toBeCloseTo(12, 6);
    }
  });

  it("is flat at total gain when bypassed", () => {
    const params = {
      ...flat, eqBypass: 1, lowGain: 360, midGain: 0, totalGain: 150,
    };
    for (const db of computeEQResponse(params, freqs)) {
      expect(db).toBe(-3);
    }
  });

  it("peaking band reaches its gain at the center frequency", () => {
    for (const midFreq of [30, 72, 100]) {
      for (const midGain of [0, 120, 300, 360]) {
        const params = { ...flat, midFreq, midGain, midQ: 24 };
        const f0 = freqToHz(midFreq);
        const [db] = computeEQResponse(params, [f0]);
        expect(db).toBeCloseTo(gainToDb(midGain), 6);
      }
    }
  });

  it("peaking band falls off away from the center", () => {
    const params = { ...flat, midFreq: 72, midGain: 300, midQ: 36 };
    const [lo, center, hi] = computeEQResponse(params, [100, 1000, 10000]);
    expect(center).toBeCloseTo(12, 6);
    expect(lo).toBeLessThan(1);
    expect(hi).toBeLessThan(1);
  });

  it("cut and boost are mirror images", () => {
    const boost = computeEQResponse({ ...flat, midGain: 270 }, freqs);
    const cut = computeEQResponse({ ...flat, midGain: 90 }, freqs);
    boost.forEach((db, i) => expect(db).toBeCloseTo(-cut[i], 6));
  });

  it("low shelf asymptotes", () => {
    const params = { ...flat, lowFreq: 32, lowGain: 300 };
    const [dc, hf] = computeEQResponse(params, [1, 20000]);
    expect(dc).toBeCloseTo(12, 2);
    expect(Math.abs(hf)).toBeLessThan(0.05);
    const [cutDc] = computeEQResponse({ ...params, lowGain: 60 }, [1]);
    expect(cutDc).toBeCloseTo(-12, 2);
  });

  it("high shelf asymptotes", () => {
    const params = { ...flat, highFreq: 60, highGain: 60 };
    const [lf] = computeEQResponse(params, [1]);
    expect(Math.abs(lf)).toBeLessThan(0.05);
    const nyquist = getBandCoefficients(params, "high", 48000);
    expect(biquadMagnitudeDb(nyquist, 24000, 48000)).toBeCloseTo(-12, 6);
    const [boost] = computeEQResponse(
      { ...params, highGain: 300 },
      [20000],
    );
    expect(boost).toBeGreaterThan(11);
  });

  it("can isolate a single band", () => {
    const params = { ...flat, lowGain: 360, midGain: 0, highGain: 360 };
    const [mid] = computeEQResponse(params, [freqToHz(71)], {
      bands: ["mid"],
      includeTotalGain: false,
    });
    expect(mid).toBeCloseTo(-18, 6);
  });

  it("works at 44.1 kHz", () => {
    const params = { ...flat, midFreq: 112, midGain: 300 };
    const [db] = computeEQResponse(params, [10000], { sampleRate: 44100 });
    expect(db).toBeCloseTo(12, 6);
  });

  it("degrades gracefully with missing params", () => {
    expect(computeEQResponse(null, [100, 1000])).toEqual([0, 0]);
  });
});
