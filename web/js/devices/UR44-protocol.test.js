import { describe, it, expect } from "vitest";
import { loadFixture } from "../../../test-fixtures/loadFixture.js";
import {
  unpack7,
  pack7,
  checksum,
  encodeParamChange,
  encodeParamQuery,
  encodeDumpRequest,
  parseBulkDump,
  encodeBulkDump,
  parseMessage,
  readString,
  DUMP_ADDRESS_CURRENT_SCENE,
  rawDumpToPayload,
  payloadToRawDump,
  encodeFxInsert,
  encodeFxRemove,
  encodeParamChangeReapply,
  meterValueToDb,
} from "./UR44-protocol.js";

describe("8-to-7 packing", () => {
  it("round-trips arbitrary bytes", () => {
    const data = [0, 1, 127, 128, 255, 200, 3, 77, 129, 0xAA];
    const packed = pack7(data);
    expect(packed.every((b) => b < 128)).toBe(true);
    expect(unpack7(packed).slice(0, data.length)).toEqual(data);
  });

  it("puts the MSB byte after each group of 7", () => {
    expect(pack7([0x80, 0, 0, 0, 0, 0, 0x81])).toEqual([
      0, 0, 0, 0, 0, 0, 1, 0b1000001,
    ]);
  });
});

describe("parameter messages", () => {
  it("encodes a parameter change", () => {
    expect(encodeParamChange(21, 0, 87)).toEqual([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00, 0x00, 0x15,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x57, 0xF7,
    ]);
  });

  it("encodes negative values as 32 bit two's complement", () => {
    // captured from the device: param 27 set to -5
    expect(encodeParamChange(27, 0, -5).slice(13, 18)).toEqual([
      0x0F, 0x7F, 0x7F, 0x7F, 0x7B,
    ]);
  });

  it("encodes 14 bit parameter ids", () => {
    const msg = encodeParamChange(175, 3, 1);
    expect(msg[8] * 128 + msg[9]).toBe(175);
    expect(msg[12]).toBe(3);
  });

  it("encodes a parameter query", () => {
    expect(encodeParamQuery(26, 0)).toEqual([
      0xF0, 0x43, 0x30, 0x3E, 0x14, 0x01, 0x01, 0x00, 0x00, 0x1A,
      0x00, 0x00, 0x00, 0xF7,
    ]);
  });

  it("parses parameter change messages incl. negative values", () => {
    expect(parseMessage(encodeParamChange(27, 0, -5))).toEqual({
      type: "change-parameter", param: 27, channel: 0, value: -5,
    });
    // device reply captured for a morph table query (id 83, ch 9)
    expect(parseMessage([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00, 0x00, 0x53,
      0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x01, 0x38, 0xF7,
    ])).toEqual({
      type: "change-parameter", param: 83, channel: 9, value: 184,
    });
  });

  it("encodes dump requests", () => {
    expect(encodeDumpRequest()).toEqual([
      0xF0, 0x43, 0x20, 0x3E, 0x14, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x03,
      0xF7,
    ]);
    expect(encodeDumpRequest(DUMP_ADDRESS_CURRENT_SCENE).at(-2)).toBe(0x01);
  });
});

describe("bulk dump", () => {
  const all = loadFixture("ur44-dump-all.hex");

  it("has a valid checksum and size field", () => {
    expect(checksum(all.slice(7, -2))).toBe(all.at(-2));
    expect(all[4] * 128 + all[5]).toBe(all.length - 9);
  });

  it("parses the format and data blocks", () => {
    const dump = parseBulkDump(all);
    expect(dump.name).toBe("All");
    expect(dump.dataName).toBe("All");
    expect(dump.groups.map((g) => g.elements)).toEqual(
      [6, 1, 4, 36, 4, 1, 1, 1, 1, 1, 3],
    );
  });

  it("decodes known values of the captured device state", () => {
    const { values } = parseBulkDump(all);
    // fader link is on by default for all channels
    expect(values.get(1)).toEqual([1, 1, 1, 1, 1, 1]);
    // HPF frequency 80 Hz
    expect(values.get(4)).toEqual([2, 2, 2, 2, 2, 2]);
    // mix 1 input levels
    expect(values.get(12)).toEqual([103, 103, 84, 84, 103, 103]);
    // signed pan values
    expect(values.get(15)).toEqual([0, 0, 0, 0, -16, 16]);
    // DAW level mix 1
    expect(values.get(21)).toEqual([87]);
    // phantom power (3 elements) and input 5/6 level
    expect(values.get(40)).toEqual([0, 0, 0]);
    expect(values.get(41)).toEqual([0, 0, 1]);
    // morph table: 4 strips x 9 points, 2 byte values
    expect(values.get(83).length).toBe(36);
    expect(values.get(83).slice(0, 9)).toEqual(
      [184, 165, 147, 181, 215, 200, 185, 135, 95],
    );
    // sample rate code 0 = 44.1 kHz
    expect(values.get(38)).toEqual([0]);
  });

  it("reads strings stored in array params", () => {
    const { values } = parseBulkDump(all);
    expect(readString(values, 82, 0, 256)).toBe("01 Basic");
    expect(readString(values, 82, 3, 256)).toBe("01 Basic");
    expect(readString(values, 81, 1, 4)).toBe("0001");
  });

  it("parses the current scene dump", () => {
    const dump = parseBulkDump(loadFixture("ur44-dump-current-scene.hex"));
    expect(dump.name).toBe("CurrentScene");
    expect(dump.values.get(12)).toEqual([103, 103, 84, 84, 103, 103]);
  });

  it("is recognized by parseMessage", () => {
    const parsed = parseMessage(all);
    expect(parsed.type).toBe("bulk-dump");
    expect(parsed.dump.values.get(0)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("bulk dump encoding", () => {
  for (const name of [
    "ur44-dump-all.hex",
    "ur44-dump-current-scene.hex",
    "ur44-dump-stereo-cs.hex",
    "ur44-dump-amp.hex",
  ]) {
    it(`re-encodes ${name} byte-exactly`, () => {
      const raw = loadFixture(name);
      expect(encodeBulkDump(parseBulkDump(raw))).toEqual(raw);
    });
  }

  it("encodes modified values", () => {
    const dump = parseBulkDump(loadFixture("ur44-dump-all.hex"));
    dump.values.get(15)[0] = -7;
    dump.values.get(83)[35] = 300;
    const reparsed = parseBulkDump(encodeBulkDump(dump));
    expect(reparsed.values.get(15)[0]).toBe(-7);
    expect(reparsed.values.get(83)[35]).toBe(300);
  });
});

describe("payload conversion", () => {
  it("round-trips a raw dump through its payload", () => {
    const raw = loadFixture("ur44-dump-current-scene.hex");
    expect(payloadToRawDump(rawDumpToPayload(raw), 1)).toEqual(raw);
  });
});

describe("other messages", () => {
  it("encodes FX insert/remove like the device expects", () => {
    expect(encodeFxInsert(0, 4, 1)).toEqual([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x08, 0x01, 0x00, 0x00, 0x00, 0x04,
      0x01, 0xF7,
    ]);
    expect(encodeFxRemove(1, 2)).toEqual([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x08, 0x02, 0x01, 0x00, 0x00, 0x02,
      0xF7,
    ]);
  });

  it("encodes the re-apply form of a parameter change", () => {
    expect(encodeParamChangeReapply(54, 2, 0).slice(0, 13)).toEqual([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x03, 0x00, 0x00, 0x36, 0x00, 0x00,
      0x02,
    ]);
  });

  it("parses acks", () => {
    expect(parseMessage([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x02, 0x02, 0x00, 0x00, 0x00, 0x00,
      0x01, 0xF7,
    ])).toEqual({ type: "bulk-ack", dumpType: 1 });
    expect(parseMessage([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x02, 0x01, 0x00, 0x00, 0x01, 0xF7,
    ]).type).toBe("store-ack");
  });

  it("parses meters on the logarithmic scale", () => {
    const msg = new Array(140).fill(0);
    [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x02, 0x02, 0x00].forEach((b, i) => {
      msg[i] = b;
    });
    msg[139] = 0xF7;
    // channel strip 0 gain reduction idle: 02 3F 7F (flag + 8191)
    msg.splice(67, 3, 0x02, 0x3F, 0x7F);
    // analog 1 level 32 125 -> 4221
    msg.splice(7, 3, 0x00, 32, 125);
    const { values } = parseMessage(msg);
    expect(values.analog1.momentary).toBe(4221);
    expect(values.channelStripGainReduction[0].momentary).toBe(8191);
    expect(meterValueToDb(8191)).toBe(0);
    expect(meterValueToDb(4221)).toBeCloseTo(-38.77, 1);
    expect(meterValueToDb(0)).toBeCloseTo(-80, 1);
  });
});

describe("malformed bulk dumps", () => {
  it("rejects huge element counts without looping over them", () => {
    const dump = parseBulkDump(loadFixture("ur44-dump-current-scene.hex"));
    dump.groups = [{
      elements: 0xFFFF,
      params: [{ id: 82, signed: false, size: 1, valuesPerElement: 0xFFFF }],
    }];
    const raw = encodeBulkDumpUnchecked(dump);
    const start = Date.now();
    expect(() => parseBulkDump(raw)).toThrow(/Truncated/);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("rejects truncated dumps", () => {
    const raw = loadFixture("ur44-dump-all.hex");
    const cut = [...raw.slice(0, 2000), 0x00, 0xF7];
    expect(() => parseBulkDump(cut)).toThrow(/Truncated/);
    expect(() => parseBulkDump([0xF0, 0x43, 0x00, 0x3E, 0xF7])).toThrow();
  });
});

/* like encodeBulkDump, but without writing any values */
const encodeBulkDumpUnchecked = (dump) => {
  const raw = encodeBulkDump({ ...dump, groups: [] });
  const payload = rawDumpToPayload(raw);
  const format = [0x80, 0x01, 0xFF, 0xFF, 0x00, 82, 0x41, 0x01, 0xFF, 0xFF];
  payload.splice(32, 0, ...format);
  payload[31] = format.length;
  return payloadToRawDump(payload, 1);
};
