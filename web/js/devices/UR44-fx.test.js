import { describe, it, expect } from "vitest";
import { canSetFx, getBudgetInUse } from "./UR44-fx.js";

describe("getBudgetInUse", () => {
  it(
    "should correctly compute zero budget",
    () => {
      const state = [
        "off",
        "off",
        "off",
        "off",
        "off",
        "off",
      ];

      expect(getBudgetInUse(state)).toBe(
        0,
      );
    },
  );

  it(
    "should correctly compute channel-strip budget",
    () => {
      const state = [
        "off",
        "channel-strip",
        "off",
        "channel-strip",
        "off",
        "channel-strip",
      ];

      expect(getBudgetInUse(state)).toBe(
        3,
      );
    },
  );

  it(
    "should correctly compute amp budget",
    () => {
      const state = [
        "off",
        "off",
        "off",
        "amp",
        "off",
        "off",
      ];

      expect(getBudgetInUse(state)).toBe(
        2,
      );
    },
  );
});

describe("canSetFx", () => {
  it(
    "should allow adding amp when budget is sufficient",
    () => {
      const fxType = "amp";
      const channelIndex = 0;
      const state = [
        "off",
        "off",
        "off",
        "off",
        "off",
        "off",
      ];

      expect(canSetFx(fxType, channelIndex, state)).toBe(
        true,
      );
    },
  );

  it(
    "should allow no-op with amp fx",
    () => {
      const fxType = "amp";
      const channelIndex = 0;
      const state = [
        "amp",
        "off",
        "off",
        "off",
        "off",
        "off",
      ];

      expect(canSetFx(fxType, channelIndex, state)).toBe(
        true,
      );
    },
  );

  it(
    "should disallow adding a second amp",
    () => {
      const fxType = "amp";
      const channelIndex = 1;
      const state = [
        "amp",
        "off",
        "off",
        "off",
        "off",
        "off",
      ];

      expect(canSetFx(fxType, channelIndex, state)).toBe(
        false,
      );
    },
  );

  it(
    "should allow adding a 4th channel strip",
    () => {
      const fxType = "channel-strip";
      const channelIndex = 3;
      const state = [
        "channel-strip",
        "channel-strip",
        "channel-strip",
        "off",
        "off",
        "off",
      ];

      expect(canSetFx(fxType, channelIndex, state)).toBe(
        true,
      );
    },
  );

  it(
    "should disallow adding a 5th channel strip",
    () => {
      const fxType = "channel-strip";
      const channelIndex = 4;
      const state = [
        "channel-strip",
        "channel-strip",
        "channel-strip",
        "channel-strip",
        "off",
        "off",
      ];

      expect(canSetFx(fxType, channelIndex, state)).toBe(
        false,
      );
    },
  );
});

describe("canSetFx with linked channels", () => {
  const off = ["off", "off", "off", "off", "off", "off"];
  const linked01 = [true, true, false, false, false, false];

  it("needs two strips for a stereo channel strip", () => {
    expect(canSetFx("channel-strip", 0, off, linked01)).toBe(true);
    // 3 mono strips in use -> no room for a stereo strip
    const threeMono = [
      "off", "off", "channel-strip", "channel-strip", "channel-strip", "off",
    ];
    expect(canSetFx("channel-strip", 0, threeMono, linked01)).toBe(false);
    // 2 mono strips in use -> exactly enough
    const twoMono = [
      "off", "off", "channel-strip", "channel-strip", "off", "off",
    ];
    expect(canSetFx("channel-strip", 1, twoMono, linked01)).toBe(true);
  });

  it("allows one stereo strip together with the guitar amp", () => {
    const amp = ["off", "off", "amp", "off", "off", "off"];
    expect(canSetFx("channel-strip", 0, amp, linked01)).toBe(true);
    const ampAndStereo = [
      "channel-strip", "channel-strip", "amp", "off", "off", "off",
    ];
    expect(canSetFx("channel-strip", 4, ampAndStereo, linked01)).toBe(false);
  });

  it("doesn't allow the guitar amp on linked channels", () => {
    expect(canSetFx("amp", 0, off, linked01)).toBe(false);
    expect(canSetFx("amp", 1, off, linked01)).toBe(false);
    expect(canSetFx("amp", 2, off, linked01)).toBe(true);
  });

  it("allows replacing an existing stereo strip's mode", () => {
    const full = [
      "channel-strip", "channel-strip", "channel-strip", "channel-strip",
      "off", "off",
    ];
    expect(canSetFx("channel-strip", 0, full, linked01)).toBe(true);
    expect(canSetFx("off", 0, full, linked01)).toBe(true);
  });
});
