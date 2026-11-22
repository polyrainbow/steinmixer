import { describe, it, expect } from "vitest";
import {
  getReverbTime,
  reverbTimeToSeconds,
  secondsToReverbTime,
  reverbFreqToHz,
  initialDelayToMs,
  reverbRatioToValue,
  formatSeconds,
  formatInitialDelay,
  formatReverbFreq,
  formatReverbRatio,
  REVERB_TIME_MAX_INDEX,
} from "./reverbMath.js";

const HALL = 0;
const ROOM = 1;
const PLATE = 2;

describe("reverb time", () => {
  it("matches the dspMixFx values for hall with room size 29", () => {
    // UR44-params.js: 0:0.289; 69:29.0; 23:2.51; 40:4.15
    expect(reverbTimeToSeconds(HALL, 29, 0)).toBeCloseTo(0.29, 2);
    expect(reverbTimeToSeconds(HALL, 29, 23)).toBeCloseTo(2.51, 1);
    expect(reverbTimeToSeconds(HALL, 29, 40)).toBeCloseTo(4.15, 1);
    expect(reverbTimeToSeconds(HALL, 29, 69)).toBe(29);
  });

  it("ranges from max / 100 to max", () => {
    expect(reverbTimeToSeconds(PLATE, 31, 0)).toBeCloseTo(0.52, 5);
    expect(reverbTimeToSeconds(PLATE, 31, 69)).toBe(52);
    expect(reverbTimeToSeconds(ROOM, 0, 69)).toBe(15.2);
  });

  it("increases monotonically", () => {
    for (let x = 1; x <= REVERB_TIME_MAX_INDEX; x++) {
      expect(getReverbTime(30, x)).toBeGreaterThan(getReverbTime(30, x - 1));
    }
  });

  it("rejects invalid input", () => {
    expect(() => getReverbTime(30, -1)).toThrow();
    expect(() => getReverbTime(30, 70)).toThrow();
    expect(() => reverbTimeToSeconds(3, 0, 0)).toThrow();
    expect(() => reverbTimeToSeconds(HALL, 32, 0)).toThrow();
  });

  it("finds the raw value for a time", () => {
    for (let x = 0; x <= REVERB_TIME_MAX_INDEX; x++) {
      const seconds = reverbTimeToSeconds(ROOM, 12, x);
      expect(secondsToReverbTime(ROOM, 12, seconds)).toBe(x);
    }
  });

  it("keeps the time close when the room size changes", () => {
    const seconds = reverbTimeToSeconds(HALL, 29, 23);
    const x = secondsToReverbTime(HALL, 5, seconds);
    expect(x).not.toBe(23);
    const newSeconds = reverbTimeToSeconds(HALL, 5, x);
    expect(Math.abs(newSeconds - seconds) / seconds).toBeLessThan(0.05);
  });

  it("clamps times outside of the range", () => {
    expect(secondsToReverbTime(HALL, 0, 1000)).toBe(REVERB_TIME_MAX_INDEX);
    expect(secondsToReverbTime(HALL, 0, 0)).toBe(0);
  });
});

describe("reverb frequencies", () => {
  it("matches the dspMixFx values", () => {
    // HPF 0:20Hz; 4:32Hz; 52:8.0kHz
    expect(reverbFreqToHz(0)).toBe(20);
    expect(reverbFreqToHz(4)).toBe(31.5);
    expect(reverbFreqToHz(52)).toBe(8000);
    // LPF 34:1kHz; 50:6.3kHz; 60:20kHz
    expect(reverbFreqToHz(34)).toBe(1000);
    expect(reverbFreqToHz(50)).toBe(6300);
    expect(reverbFreqToHz(60)).toBe(20000);
    // Low freq 1:22Hz; 32:800Hz; 59:18kHz
    expect(reverbFreqToHz(1)).toBe(22.4);
    expect(reverbFreqToHz(32)).toBe(800);
    expect(reverbFreqToHz(59)).toBe(18000);
  });
});

describe("other reverb params", () => {
  it("converts the initial delay", () => {
    // 0:0.1ms; 2:3.2ms; 127:200.0ms
    expect(initialDelayToMs(0)).toBeCloseTo(0.1, 5);
    expect(initialDelayToMs(2)).toBeCloseTo(3.2, 1);
    expect(initialDelayToMs(127)).toBeCloseTo(200, 5);
  });

  it("converts the ratios", () => {
    expect(reverbRatioToValue(1)).toBe(0.1);
    expect(reverbRatioToValue(8)).toBe(0.8);
    expect(reverbRatioToValue(14)).toBe(1.4);
  });
});

describe("formatting", () => {
  it("formats seconds", () => {
    expect(formatSeconds(0.289)).toBe("289 ms");
    expect(formatSeconds(2.514)).toBe("2.51 s");
    expect(formatSeconds(29)).toBe("29.0 s");
  });

  it("formats the other params", () => {
    expect(formatInitialDelay(127)).toBe("200.0 ms");
    expect(formatReverbFreq(32)).toBe("800.0 Hz");
    expect(formatReverbFreq(50)).toBe("6.30 kHz");
    expect(formatReverbRatio(12)).toBe("×1.2");
  });
});
