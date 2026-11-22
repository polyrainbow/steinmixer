/*
  A software model of the UR44 that speaks the same SysEx protocol as the
  real device. It is used as simulator (USE_SIMULATOR in SteinMixer.js) and
  in the tests of the UR44 controller.

  The behaviour (FX allocation, mirroring of linked channels, morphing, ...)
  mimics what was observed on a real device, see docs/protocol.md.
*/
import DEFAULT_DUMP from "./UR44-default-dump.js";
import {
  parseBulkDump,
  encodeBulkDump,
  fxAvailableAtSampleRateCode,
  DUMP_TYPE_ALL,
  DUMP_TYPE_CURRENT_SCENE,
  DUMP_TYPE_MORPHING_TABLE,
} from "./UR44-protocol.js";
import { FX_BUDGET } from "./UR44-fx.js";

const hexToBytes = (hex) => {
  return hex.trim().split(/\s+/).map((h) => parseInt(h, 16));
};

const LINK_MIRRORED_PARAM_IDS = [3, 7, 8, 9, 10, 11, 12, 13, 14];
const STRIP_PARAM_IDS = [];
for (let id = 42; id <= 63; id++) STRIP_PARAM_IDS.push(id);
const MORPH_TABLE_IDS = [];
for (let id = 83; id <= 99; id++) MORPH_TABLE_IDS.push(id);
const MORPH_TARGET_IDS = [
  45, 46, 47, 48, 49, 50, 51, 52, 53, 56, 57, 58, 59, 60, 61, 62, 63,
];
const QUERY_ONLY_IDS = [25, 26, 27];
const SOLO_IDS = [7, 8, 17, 18];

const CS_INSERT = 5;
const CS_MONITOR = 6;
const AMP_INSERT = 175;
const AMP_MONITOR = 176;

const encodeU32 = (value) => {
  const v = value >>> 0;
  return [4, 3, 2, 1, 0].map((k) => Math.floor(v / 128 ** k) & 0x7F);
};

const paramChange = (id, ch, value) => [
  0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00, (id >> 7) & 0x7F, id & 0x7F,
  0x00, 0x00, ch, ...encodeU32(value), 0xF7,
];

const decodeU32 = (bytes) => {
  const v = bytes.reduce((a, b) => a * 128 + b, 0) % 2 ** 32;
  return v >= 2 ** 31 ? v - 2 ** 32 : v;
};

export default class UR44VirtualDevice {
  #input = { onmidimessage: null };
  #values;
  #groups;
  #formatHeader;
  #dataHeader;
  #extras = new Map([[25, 0], [26, 0], [27, 0]]);
  #defaultStrip;
  #meterTimer = null;
  #latency;
  #meters;
  sent = [];
  received = [];

  constructor({ latency = 0, meters = true } = {}) {
    const dump = parseBulkDump(hexToBytes(DEFAULT_DUMP));
    this.#values = dump.values;
    this.#groups = dump.groups;
    this.#formatHeader = dump.formatHeader;
    this.#dataHeader = dump.dataHeader;
    this.#latency = latency;
    this.#meters = meters;
    this.#defaultStrip = STRIP_PARAM_IDS.map((id) => this.#values.get(id)[0]);
  }

  /* port provider for the UR44 controller */
  get portProvider() {
    return async () => ({
      input: this.#input,
      output: { send: (message) => this.#receive([...message]) },
      name: "UR44 Simulator",
    });
  }

  get(id, ch = 0) {
    if (QUERY_ONLY_IDS.includes(id)) return this.#extras.get(id);
    return this.#values.get(id)?.[ch];
  }

  #set(id, ch, value) {
    if (QUERY_ONLY_IDS.includes(id)) {
      this.#extras.set(id, value);
      return;
    }
    const values = this.#values.get(id);
    if (!values || ch >= values.length) return;
    values[ch] = value;
  }

  #reply(message) {
    this.sent.push(message);
    const deliver = () => {
      this.#input.onmidimessage?.({ data: Uint8Array.from(message) });
    };
    if (this.#latency > 0) {
      setTimeout(deliver, this.#latency);
    } else {
      queueMicrotask(deliver);
    }
  }

  close() {
    clearInterval(this.#meterTimer);
    this.#meterTimer = null;
  }

  /* --- FX allocation model --- */

  #linked(channel) {
    return this.#values.get(0)[channel - (channel % 2)] === 1;
  }

  #strips() {
    // slot index -> { channels, mode }
    const slots = [];
    for (let ch = 0; ch < 6; ch++) {
      const ins = this.#values.get(CS_INSERT)[ch];
      const mon = this.#values.get(CS_MONITOR)[ch];
      const slot = (ins || mon) - 1;
      if (slot < 0) continue;
      slots[slot] ??= { channels: [], mode: ins ? 0 : 1 };
      slots[slot].channels.push(ch);
    }
    // a stereo strip occupies two slots, keep only one entry for it
    const entries = [];
    slots.forEach((entry, slot) => {
      if (!entry) return;
      const stereo = this.#values.get(42)[slot] === 1;
      const block = STRIP_PARAM_IDS.map((id) => this.#values.get(id)[slot]);
      if (stereo && entries.some((e) => e.stereo && e.slot === slot - 1)) {
        return;
      }
      entries.push({
        slot,
        stereo,
        channels: stereo
          ? [entry.channels[0] & ~1, entry.channels[0] | 1]
          : entry.channels,
        mode: entry.mode,
        block,
      });
    });
    return entries;
  }

  #writeStrips(entries) {
    // stereo strips first, keep the order otherwise
    const ordered = [
      ...entries.filter((e) => e.stereo),
      ...entries.filter((e) => !e.stereo),
    ];
    this.#values.get(CS_INSERT).fill(0);
    this.#values.get(CS_MONITOR).fill(0);
    let slot = 0;
    const blocks = [];
    for (const entry of ordered) {
      const slots = entry.stereo ? [slot, slot + 1] : [slot];
      slots.forEach((s, i) => {
        blocks[s] = { block: entry.block, stereo: entry.stereo };
        const ch = entry.channels[entry.stereo ? i : 0];
        const param = entry.mode === 0 ? CS_INSERT : CS_MONITOR;
        this.#values.get(param)[ch] = (entry.stereo ? slot : s) + 1 + i;
      });
      slot += slots.length;
    }
    for (let s = 0; s < 4; s++) {
      const block = blocks[s]?.block ?? this.#defaultStrip;
      STRIP_PARAM_IDS.forEach((id, i) => {
        this.#values.get(id)[s] = block[i];
      });
      this.#values.get(42)[s] = blocks[s]?.stereo ? 1 : 0;
    }
  }

  #budgetInUse(entries) {
    const strips = entries.reduce((a, e) => a + (e.stereo ? 2 : 1), 0);
    const amp = this.#ampChannel() === -1 ? 0 : 2;
    return strips + amp;
  }

  #ampChannel() {
    for (let ch = 0; ch < 6; ch++) {
      if (
        this.#values.get(AMP_INSERT)[ch] || this.#values.get(AMP_MONITOR)[ch]
      ) {
        return ch;
      }
    }
    return -1;
  }

  #insertChannelStrip(channel, mode) {
    const entries = this.#strips();
    const existing = entries.find((e) => e.channels.includes(channel));
    if (existing) {
      existing.mode = mode;
      this.#writeStrips(entries);
      return;
    }
    const stereo = this.#linked(channel);
    const channels = stereo ? [channel & ~1, channel | 1] : [channel];
    if (channels.includes(this.#ampChannel())) return;
    if (this.#budgetInUse(entries) + (stereo ? 2 : 1) > FX_BUDGET) return;
    const entry = { stereo, channels, mode, block: [...this.#defaultStrip] };
    entry.block[0] = stereo ? 1 : 0;
    // new strips are put in front of the existing ones of their kind
    const stereoEntries = entries.filter((e) => e.stereo);
    const monoEntries = entries.filter((e) => !e.stereo);
    this.#writeStrips(stereo
      ? [entry, ...stereoEntries, ...monoEntries]
      : [...stereoEntries, entry, ...monoEntries]);
  }

  #removeChannelStrip(channel) {
    const entries = this.#strips();
    this.#writeStrips(entries.filter((e) => !e.channels.includes(channel)));
  }

  #insertAmp(channel, mode) {
    if (this.#linked(channel)) return;
    const current = this.#ampChannel();
    if (current !== -1 && current !== channel) return;
    const entries = this.#strips();
    if (entries.some((e) => e.channels.includes(channel))) return;
    const strips = entries.reduce((a, e) => a + (e.stereo ? 2 : 1), 0);
    if (strips + 2 > FX_BUDGET) return;
    this.#values.get(AMP_INSERT)[channel] = mode === 0 ? 1 : 0;
    this.#values.get(AMP_MONITOR)[channel] = mode === 1 ? 1 : 0;
  }

  #removeAmp(channel) {
    this.#values.get(AMP_INSERT)[channel] = 0;
    this.#values.get(AMP_MONITOR)[channel] = 0;
  }

  /* --- parameter handling --- */

  #applyMorph(strip) {
    const morph = Math.min(120, Math.max(0, this.#values.get(54)[strip]));
    const pos = morph / 15;
    const i = Math.min(8, Math.floor(pos));
    const j = Math.min(8, i + 1);
    MORPH_TABLE_IDS.forEach((tableId, n) => {
      const table = this.#values.get(tableId);
      const a = table[strip * 9 + i];
      const b = table[strip * 9 + j];
      this.#values.get(MORPH_TARGET_IDS[n])[strip] = Math.trunc(
        a + (b - a) * (pos - i),
      );
    });
  }

  #setParam(id, ch, value, reapply = false) {
    if (id === 54) value = Math.min(120, Math.max(0, value));
    // like the real device, the morphing table is only applied when the
    // morph value changes or when it's re-sent with the re-apply flag
    const applyMorph = id === 54 && (reapply || this.get(54, ch) !== value);
    this.#set(id, ch, value);

    if (id === 0) {
      const left = ch - (ch % 2);
      this.#values.get(0)[left] = value;
      this.#values.get(0)[left + 1] = value;
      if (value === 1) {
        for (const mirrored of LINK_MIRRORED_PARAM_IDS) {
          const values = this.#values.get(mirrored);
          if (values) values[left + 1] = values[left];
        }
        // a mono channel strip becomes a stereo strip, amps are removed
        if (left === this.#ampChannel() || left + 1 === this.#ampChannel()) {
          this.#removeAmp(this.#ampChannel());
        }
        const entries = this.#strips();
        const entry = entries.find((e) => {
          return e.channels.includes(left) || e.channels.includes(left + 1);
        });
        if (entry) {
          const others = entries.filter((e) => e !== entry);
          if (this.#budgetInUse(others) + 2 <= FX_BUDGET) {
            entry.stereo = true;
            entry.channels = [left, left + 1];
            entry.block[0] = 1;
          }
          this.#writeStrips(entries);
        }
      } else {
        const entries = this.#strips();
        entries.forEach((e) => {
          if (e.stereo && e.channels[0] === left) {
            e.stereo = false;
            e.channels = [left];
            e.block[0] = 0;
          }
        });
        this.#writeStrips(entries);
      }
    } else if (
      LINK_MIRRORED_PARAM_IDS.includes(id) && ch < 6 && this.#linked(ch)
    ) {
      this.#set(id, ch % 2 === 0 ? ch + 1 : ch - 1, value);
    }

    if (id >= 43 && id <= 63 && this.#values.get(42)[ch] === 1) {
      this.#set(id, ch ^ 1, value);
      if (applyMorph) this.#applyMorph(ch ^ 1);
    }
    if (applyMorph) this.#applyMorph(ch);

    if (SOLO_IDS.includes(id)) {
      const anySolo = SOLO_IDS.some((s) => this.#values.get(s).includes(1));
      this.#values.get(39)[0] = anySolo ? 1 : 0;
    }
  }

  /* simulates changing the sample rate in the OS audio settings */
  setSampleRateCode(code) {
    this.#values.get(38)[0] = code;
    if (!fxAvailableAtSampleRateCode(code)) {
      this.#writeStrips([]);
      for (let ch = 0; ch < 6; ch++) this.#removeAmp(ch);
    }
    this.#reply(paramChange(38, 0, code));
  }

  /* simulates someone pressing a hardware switch */
  setPhantomPower(pair, value) {
    this.#values.get(40)[pair] = value;
    this.#reply(paramChange(40, pair, value));
  }

  /* --- dumps --- */

  #dump(type) {
    let groups = this.#groups;
    let name = "All";
    if (type === DUMP_TYPE_CURRENT_SCENE) {
      name = "CurrentScene";
      groups = this.#groups
        .map((g) => ({
          ...g,
          params: g.params.filter((p) => ![34, 35, 36, 100, 38, 39, 40, 41]
            .includes(p.id)),
        }))
        .filter((g) => g.params.length > 0);
    }
    const header = (h, prefix) => {
      const bytes = new Array(16).fill(0);
      [...prefix + name].forEach((c, i) => {
        bytes[i] = c.charCodeAt(0);
      });
      return [...bytes, ...h.slice(16)];
    };
    return encodeBulkDump({
      address: [0x01, 0x01, 0x00, 0x00, 0x00, 0x00, type],
      formatHeader: header(this.#formatHeader, "F_"),
      dataHeader: header(this.#dataHeader, "D_"),
      groups,
      values: this.#values,
    });
  }

  #receiveBulk(message) {
    const type = message[13];
    const dump = parseBulkDump(message);
    for (const [id, values] of dump.values) {
      const target = this.#values.get(id);
      if (!target) continue;
      if (type === DUMP_TYPE_MORPHING_TABLE && !(id >= 81 && id <= 99)) {
        continue;
      }
      values.forEach((v, i) => {
        if (i < target.length) target[i] = v;
      });
    }
    if (!fxAvailableAtSampleRateCode(this.#values.get(38)[0])) {
      this.#writeStrips([]);
      for (let ch = 0; ch < 6; ch++) this.#removeAmp(ch);
    }
    this.#reply([
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x02, 0x02, 0x00, 0x00, 0x00, 0x00,
      type, 0xF7,
    ]);
  }

  /* --- meters --- */

  #startMeters() {
    if (!this.#meters || this.#meterTimer) return;
    let t = 0;
    this.#meterTimer = setInterval(() => {
      t += 1;
      const values = new Array(44).fill(0);
      const level = (base, speed, phase) => {
        return Math.round(base + 600 * Math.sin(t / speed + phase));
      };
      [0, 1, 2, 3, 4, 5].forEach((ch) => {
        const muted = this.#values.get(12)[ch] === 0;
        values[ch * 2] = muted ? 0 : level(5200 - ch * 300, 7, ch);
        values[ch * 2 + 1] = values[ch * 2] + 150;
      });
      [12, 14].forEach((k) => {
        values[k] = level(6000, 5, 1);
        values[k + 1] = values[k] + 150;
      });
      [16, 18].forEach((k) => {
        values[k] = level(6600, 6, 2);
        values[k + 1] = values[k] + 150;
      });
      for (let s = 0; s < 4; s++) {
        const active = this.#values.get(CS_INSERT).includes(s + 1)
          || this.#values.get(CS_MONITOR).includes(s + 1);
        values[20 + s * 2] = active ? level(7600, 4, s) : 8191;
        values[21 + s * 2] = values[20 + s * 2];
        values[28 + s * 2] = active ? level(6200, 5, s) : 0;
        values[29 + s * 2] = values[28 + s * 2] + 150;
      }
      // values start at byte 7, 3 x 7 bit each
      const message = [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x02, 0x02];
      values.forEach((v) => {
        message.push((v >> 14) & 0x7F, (v >> 7) & 0x7F, v & 0x7F);
      });
      message.push(0xF7);
      this.#input.onmidimessage?.({ data: Uint8Array.from(message) });
    }, 50);
  }

  /* --- message dispatch --- */

  #receive(message) {
    this.received.push(message);
    const is = (...prefix) => prefix.every((b, i) => message[i] === b);

    // parameter change (01 01) or change + re-apply (01 03)
    if (is(0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01) && message.length === 19) {
      const id = message[8] * 128 + message[9];
      const ch = message[12];
      this.#setParam(id, ch, decodeU32(message.slice(13, 18)),
        message[6] === 0x03);
      return;
    }
    // parameter query
    if (is(0xF0, 0x43, 0x30, 0x3E, 0x14, 0x01, 0x01) && message.length === 14) {
      const id = message[8] * 128 + message[9];
      const ch = message[12];
      const value = this.get(id, ch);
      if (value !== undefined) this.#reply(paramChange(id, ch, value));
      return;
    }
    // dump request
    if (is(0xF0, 0x43, 0x20, 0x3E, 0x14)) {
      const type = message[11];
      if (type === DUMP_TYPE_ALL || type === DUMP_TYPE_CURRENT_SCENE) {
        this.#reply(this.#dump(type));
      }
      return;
    }
    // bulk dump to the device
    if (is(0xF0, 0x43, 0x00, 0x3E)) {
      this.#receiveBulk(message);
      return;
    }
    // FX insert / remove
    if (is(0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x08)) {
      const [, , , , , , , action, fxType, , chHi, chLo, insertPoint]
        = message;
      const ch = chHi * 128 + chLo;
      const available = fxAvailableAtSampleRateCode(this.#values.get(38)[0]);
      if (action === 0x01 && available) {
        if (fxType === 0) this.#insertChannelStrip(ch, insertPoint);
        else this.#insertAmp(ch, insertPoint);
      } else if (action === 0x02) {
        if (fxType === 0) this.#removeChannelStrip(ch);
        else this.#removeAmp(ch);
      }
      return;
    }
    // store
    if (is(0xF0, 0x43, 0x30, 0x3E, 0x14, 0x03, 0x02, 0x01)) {
      this.#reply([
        0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x02, 0x01, 0x00, 0x00, 0x01, 0xF7,
      ]);
      return;
    }
    // meters on/off
    if (is(0xF0, 0x43, 0x30, 0x3E, 0x14, 0x02, 0x02, 0x32)) {
      if (message[8] === 0x7F) this.#startMeters();
      else this.close();
      return;
    }
  }
}

