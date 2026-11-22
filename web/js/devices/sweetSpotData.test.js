import { describe, it, expect } from "vitest";
import {
  parseSweetSpotData,
  buildSweetSpotData,
  SSD_SIZE,
} from "./sweetSpotData.js";

const points = Array.from({ length: 9 }, (_, p) => {
  return Array.from({ length: 17 }, (__, i) => {
    return p * 20 + i + (i === 0 ? 256 : 0);
  });
});

describe("Sweet Spot Data files", () => {
  it("builds the documented layout", () => {
    const data = buildSweetSpotData({ id: "0042", points });
    expect(data.length).toBe(SSD_SIZE);
    expect(String.fromCharCode(...data.slice(0, 4))).toBe("SSMD");
    expect([...data.slice(8, 12)]).toEqual([1, 0, 0, 0]);
    expect(String.fromCharCode(...data.slice(0x10, 0x14))).toBe("0042");
    // point 0, value 0 = 256 as big endian u16 at 0x20
    expect([...data.slice(0x20, 0x22)]).toEqual([0x01, 0x00]);
    // point 1 starts at 0x20 + 0x28
    const view = new DataView(data.buffer);
    expect(view.getUint16(0x48 + 2)).toBe(21);
    // padding after the 17 values of a point
    expect(view.getUint16(0x20 + 34)).toBe(0);
  });

  it("round-trips", () => {
    const parsed = parseSweetSpotData(
      buildSweetSpotData({ id: "0042", points }), "My Preset.ssd",
    );
    expect(parsed).toEqual({ id: "0042", name: "My Preset", points });
  });

  it("accepts ArrayBuffers and views with an offset", () => {
    const bytes = buildSweetSpotData({ id: "7", points });
    const padded = new Uint8Array(bytes.length + 3);
    padded.set(bytes, 3);
    expect(parseSweetSpotData(padded.subarray(3)).points).toEqual(points);
    expect(parseSweetSpotData(bytes.buffer, "x.SSD").name).toBe("x");
  });

  it("rejects other files", () => {
    expect(() => parseSweetSpotData(new Uint8Array(512))).toThrow();
    const short = buildSweetSpotData({ id: "1", points }).slice(0, 100);
    expect(() => parseSweetSpotData(short)).toThrow();
  });
});
