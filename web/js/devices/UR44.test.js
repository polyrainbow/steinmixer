import { describe, it, expect } from "vitest";
import { canSetFx, getBudgetInUse } from "./ur44";

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
