import UR44Params from "./UR44-params.js";
import {
  encodeParamChange,
  encodeParamChangeReapply,
  encodeParamQuery,
  encodeDumpRequest,
  encodeBulkDump,
  encodeFxInsert,
  encodeFxRemove,
  parseMessage,
  readString,
  meterValueToDb,
  fxAvailableAtSampleRateCode,
  SAMPLE_RATES,
  STORE_COMMAND,
  DUMP_ADDRESS_ALL,
  DUMP_ADDRESS_CURRENT_SCENE,
  FX_CHANNEL_STRIP,
  FX_GUITAR_AMP,
} from "./UR44-protocol.js";
import { canSetFx, getLinkPartner } from "./UR44-fx.js";
import { PARAM_RANGES } from "./channelStripMath.js";

export { canSetFx, getBudgetInUse } from "./UR44-fx.js";

export const AMP_TYPES = [
  "Clean",
  "Crunch",
  "Lead",
  "Drive",
];

export const STRIP_COUNT = 4;
export const MORPH_POINTS = 9;
export const MORPH_MAX = 120;

/* ids of the morphing table, in the order used by .ssd files */
export const MORPH_TABLE_PARAM_IDS = [
  83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
];
const MORPH_SYSTEM_ID_PARAM = 81;
const MORPH_SYSTEM_NAME_PARAM = 82;
const MORPH_SYSTEM_ID_LENGTH = 4;
const MORPH_SYSTEM_NAME_LENGTH = 256;
const MORPH_VALUE_PARAM = 54;
/* channelStripMath keys of the morphing table entries (ids 83..99) */
const MORPH_TABLE_KEYS = [
  "attack", "release", "ratio", "knee", "threshOfst", "makeupOfst",
  "sidechainF", "sidechainG", "sidechainQ", "highFreq", "highGain", "midFreq",
  "midGain", "midQ", "lowFreq", "lowGain", "totalGain",
];

/* the device only stores 7 bit ASCII */
const toDeviceString = (string) => {
  return string
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_");
};

/*
  Params which the device mirrors between the two channels of a linked pair
  (verified on the device). Phase and pan stay independent.
*/
const LINK_MIRRORED_PARAM_IDS = [3, 7, 8, 9, 10, 11, 12, 13, 14];

/* Params which are not part of bulk dumps and have to be queried. */
const QUERIED_PARAM_IDS = [25, 26, 27];

const FX_PATCH_PARAMS = {
  channelStripInsert: 5,
  channelStripMonitor: 6,
  ampInsert: 175,
  ampMonitor: 176,
};
const STEREO_LINK_PARAM = 42;
const LINK_PARAM = 0;
const SAMPLE_RATE_PARAM = 38;

const REQUEST_TIMEOUT = 3000;

/*
  Parses the parameter table. channel is one of
    { kind: "global" }                   -> param has a single value
    { kind: "channels", channels: [..] } -> set on all listed channels, read
                                            from the first one
    { kind: "stack" }                    -> one value per channel strip
*/
export const parseParamTable = (csv) => {
  const params = new Map();
  for (const line of csv.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [
      paramName, paramNumber, channel, min, max, defaultValue, readOnly,
    ] = line.split(",");
    let channelSpec;
    if (channel === "null") {
      channelSpec = { kind: "global" };
    } else if (channel === "stack") {
      channelSpec = { kind: "stack" };
    } else {
      channelSpec = {
        kind: "channels",
        channels: channel.split("+").map((c) => parseInt(c)),
      };
    }
    params.set(paramName, {
      paramNumber: parseInt(paramNumber),
      channel: channelSpec,
      min: parseInt(min),
      max: parseInt(max),
      defaultValue: parseInt(defaultValue),
      readOnly: readOnly === "true",
    });
  }
  return params;
};

const PARAMS = parseParamTable(UR44Params);

const getWebMIDIPorts = async () => {
  const midi = await navigator.requestMIDIAccess({ sysex: true });

  // The UR44 has two MIDI ports, the second one is used for control. As the
  // port names are localized ("Port 2", "Anschluss 2"), we use the last one.
  let input;
  let output;
  for (const port of midi.inputs.values()) {
    if (port.name.includes("Steinberg UR44")) input = port;
  }
  for (const port of midi.outputs.values()) {
    if (port.name.includes("Steinberg UR44")) output = port;
  }

  if (!input || !output) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  await input.open();
  return { input, output, name: output.name };
};

const createSettingsProxy = (target) => {
  return new Proxy(target, {
    get(obj, prop) {
      // Promise checker should be satisfied
      if (prop === "then") return null;
      if (typeof prop === "symbol") return obj[prop];
      if (typeof obj[prop] === "undefined") {
        throw new Error("Requested unknown param: " + String(prop));
      }
      return obj[prop];
    },
    set(obj, prop, value) {
      if (typeof obj[prop] === "undefined") {
        throw new Error("Tried to set unknown param: " + String(prop));
      }
      obj[prop] = value;
      return true;
    },
  });
};

const deriveFxState = (values, channelIndex) => {
  const get = (id) => values.get(id)?.[channelIndex] ?? 0;
  const stereoOf = (stackIndex) => {
    return (values.get(STEREO_LINK_PARAM)?.[stackIndex] ?? 0) === 1;
  };
  const csIns = get(FX_PATCH_PARAMS.channelStripInsert);
  const csMon = get(FX_PATCH_PARAMS.channelStripMonitor);
  if (csIns > 0 || csMon > 0) {
    const stackIndex = (csIns || csMon) - 1;
    return {
      type: "channel-strip",
      mode: csIns > 0 ? "insert" : "monitor",
      stackIndex,
      stereo: stereoOf(stackIndex),
    };
  }
  if (get(FX_PATCH_PARAMS.ampInsert) > 0) {
    return { type: "amp", mode: "insert" };
  }
  if (get(FX_PATCH_PARAMS.ampMonitor) > 0) {
    return { type: "amp", mode: "monitor" };
  }
  return { type: "off" };
};

/*
  Value of a morphing table entry at a morph position, the same way the
  device and dspMixFx interpolate: 9 points, 15 steps apart.
*/
export const interpolateMorph = (points, morphValue) => {
  const pos = Math.min(MORPH_MAX, Math.max(0, morphValue)) / 15;
  const i = Math.min(MORPH_POINTS - 1, Math.floor(pos));
  const j = Math.min(MORPH_POINTS - 1, i + 1);
  return Math.trunc(points[i] + (points[j] - points[i]) * (pos - i));
};

export default class UR44 {
  #ports;
  #portProvider;
  #messageHandler;
  #pendingDumps = [];
  #pendingAcks = [];
  #pendingQueries = new Map();
  #lastDump = null;
  #morphRefreshTimer = null;
  #changeSeq = 0;
  #localChanges = [];
  #fxQueue = Promise.resolve();
  vuValues;
  params = PARAMS;
  settings;
  channelStripSettings = [];
  sweetSpots = [];
  morphTable = [];
  fxState = [];

  constructor(portProvider = getWebMIDIPorts) {
    this.#portProvider = portProvider;
  }

  async open(messageHandler) {
    this.#messageHandler = messageHandler;
    this.#ports = await this.#portProvider();
    this.#ports.input.onmidimessage = (e) => this.#handleMessage(e.data);

    this.sendInitMessages();
    await this.refresh();
    await this.#queryParams(QUERIED_PARAM_IDS);

    return {
      params: this.settings,
      connectionName: this.#ports.name,
      fxState: this.fxState,
      channelStripSettings: this.channelStripSettings,
    };
  }

  #send(message) {
    if (!this.#ports) throw new Error("Controller not initialized!");
    this.#ports.output.send(message);
  }

  #emit(event) {
    this.#messageHandler?.(event);
  }

  #waitFor(list, predicate, description) {
    return new Promise((resolve, reject) => {
      const entry = { predicate, resolve };
      list.push(entry);
      setTimeout(() => {
        const index = list.indexOf(entry);
        if (index !== -1) {
          list.splice(index, 1);
          reject(new Error("Timeout waiting for " + description));
        }
      }, REQUEST_TIMEOUT);
    });
  }

  #resolveFirst(list, value) {
    const index = list.findIndex((e) => e.predicate(value));
    if (index !== -1) {
      const [entry] = list.splice(index, 1);
      entry.resolve(value);
      return true;
    }
    return false;
  }

  #handleMessage(data) {
    const message = parseMessage(data);
    switch (message.type) {
    case "meter-update":
      this.vuValues = message.values;
      break;
    case "bulk-dump":
      this.#resolveFirst(this.#pendingDumps, { message, raw: [...data] });
      break;
    case "bulk-ack":
    case "store-ack":
      this.#resolveFirst(this.#pendingAcks, message);
      break;
    case "change-parameter":
      this.#handleParamChange(message);
      break;
    case "keepalive":
      break;
    default:
      console.log("Unknown message received", message.raw);
    }
  }

  #handleParamChange({ param, channel, value }) {
    const queryKey = `${param}:${channel}`;
    if (this.#pendingQueries.has(queryKey)) {
      this.#pendingQueries.get(queryKey)(value);
      this.#pendingQueries.delete(queryKey);
    }

    let changed = false;
    for (const [paramName, spec] of this.params) {
      if (spec.paramNumber !== param) continue;
      if (spec.channel.kind === "stack") {
        if (this.channelStripSettings[channel]) {
          this.channelStripSettings[channel][paramName] = value;
          changed = true;
        }
      } else if (
        spec.channel.kind === "global"
        || spec.channel.channels[0] === channel
      ) {
        this.settings[paramName] = value;
        changed = true;
        this.#emit({ type: "change-parameter", paramName, newValue: value });
      }
    }

    if (param === SAMPLE_RATE_PARAM) {
      // Effects are removed by the device at high sample rates.
      this.refresh()
        .then(() => this.#emit({ type: "state-refresh" }))
        .catch((e) => console.error(e));
    }

    if (!changed) {
      console.warn("Unknown parameter changed", param, channel, value);
    }
  }

  async #queryParams(ids) {
    const replies = ids.map((id) => {
      return new Promise((resolve) => {
        this.#pendingQueries.set(`${id}:0`, resolve);
        setTimeout(() => {
          this.#pendingQueries.delete(`${id}:0`);
          resolve(null);
        }, REQUEST_TIMEOUT);
      });
    });
    ids.forEach((id) => this.#send(encodeParamQuery(id, 0)));
    await Promise.all(replies);
  }

  /* Re-reads the params which are not contained in dumps. */
  refreshQueriedParams() {
    return this.#queryParams(QUERIED_PARAM_IDS);
  }

  /* Requests the complete device state and updates everything from it. */
  async refresh() {
    // Changes sent after the request are not contained in the dump, they
    // are re-applied to the local state afterwards.
    const requestSeq = this.#changeSeq;
    const reply = this.#waitFor(
      this.#pendingDumps,
      ({ message }) => message.dump.name === "All",
      "state dump",
    );
    this.#send(encodeDumpRequest(DUMP_ADDRESS_ALL));
    const { message } = await reply;
    this.#applyDump(message.dump);
    const newer = this.#localChanges.filter((c) => c.seq > requestSeq);
    newer.forEach((c) => this.#setLocal(c.paramName, c.value, c.stackIndex));
    this.#localChanges = newer;
    return this.settings;
  }

  #applyDump(dump) {
    this.#lastDump = dump;
    const { values } = dump;
    const settings = {};
    const strips = Array.from({ length: STRIP_COUNT }, () => ({}));

    for (const [paramName, spec] of this.params) {
      const paramValues = values.get(spec.paramNumber);
      if (spec.channel.kind === "stack") {
        strips.forEach((strip, i) => {
          strip[paramName] = paramValues?.[i] ?? spec.defaultValue;
        });
      } else {
        const channel = spec.channel.kind === "global"
          ? 0
          : spec.channel.channels[0];
        // keep values of params which are not contained in dumps
        settings[paramName] = paramValues?.[channel]
          ?? this.settings?.[paramName]
          ?? spec.defaultValue;
      }
    }

    if (this.settings) {
      Object.assign(this.settings, settings);
    } else {
      this.settings = createSettingsProxy(settings);
    }
    this.channelStripSettings = strips;

    this.fxState = [0, 1, 2, 3, 4, 5].map((c) => deriveFxState(values, c));

    this.sweetSpots = strips.map((_, strip) => ({
      id: readString(
        values, MORPH_SYSTEM_ID_PARAM, strip, MORPH_SYSTEM_ID_LENGTH,
      ),
      name: readString(
        values, MORPH_SYSTEM_NAME_PARAM, strip, MORPH_SYSTEM_NAME_LENGTH,
      ),
    }));

    this.morphTable = strips.map((_, strip) => {
      return Array.from({ length: MORPH_POINTS }, (__, point) => {
        return MORPH_TABLE_PARAM_IDS.map((id) => {
          return values.get(id)?.[strip * MORPH_POINTS + point] ?? 0;
        });
      });
    });
  }

  get sampleRateCode() {
    return this.settings.SampleRate;
  }

  get sampleRate() {
    return SAMPLE_RATES[this.settings.SampleRate];
  }

  get fxAvailable() {
    return fxAvailableAtSampleRateCode(this.settings.SampleRate);
  }

  isLinked(channelIndex) {
    const left = channelIndex - (channelIndex % 2);
    return this.settings[`Input${left}Link`] === 1;
  }

  canSetFx(type, channelIndex) {
    if (type !== "off" && !this.fxAvailable) return false;
    return canSetFx(
      type,
      channelIndex,
      this.fxState.map((s) => s.type),
      [0, 1, 2, 3, 4, 5].map((c) => this.isLinked(c)),
    );
  }

  /*
    Inserts/removes effects. The device allocates channel strips itself
    (stereo strips first, new mono strips at the front, existing ones get
    shifted), so we read the resulting state back from the device.
  */
  setFX(channelIndex, type, mode = "insert", ampType) {
    // run one after another, each one needs the state of the previous one
    const run = this.#fxQueue.then(() => {
      return this.#setFX(channelIndex, type, mode, ampType);
    });
    this.#fxQueue = run.catch(() => {});
    return run;
  }

  async #setFX(channelIndex, type, mode, ampType) {
    if (!this.canSetFx(type, channelIndex)) {
      throw new Error("Cannot add FX due to lack of resources: " + type);
    }
    const insertPoint = mode === "monitor" ? 1 : 0;
    const current = this.fxState[channelIndex];

    if (type === "off" || current.type !== type) {
      if (current.type === "channel-strip") {
        this.#send(encodeFxRemove(FX_CHANNEL_STRIP, channelIndex));
      } else if (current.type === "amp") {
        this.#send(encodeFxRemove(FX_GUITAR_AMP, channelIndex));
      }
    }

    if (type === "channel-strip") {
      this.#send(encodeFxInsert(FX_CHANNEL_STRIP, channelIndex, insertPoint));
    } else if (type === "amp") {
      this.#send(encodeFxInsert(FX_GUITAR_AMP, channelIndex, insertPoint));
      if (typeof ampType === "number") {
        this.updateParamValue("AmpType", ampType);
      }
    } else if (type !== "off") {
      throw new Error("Invalid FX type: " + type);
    }

    await this.refresh();
    this.#emit({ type: "local-change" });
    // the device silently ignores inserts it can't fulfil
    if (this.fxState[channelIndex].type !== type) {
      throw new Error(
        `The device did not apply ${type} on input ${channelIndex + 1}`,
      );
    }
  }

  getVuValues(channelId) {
    if (!this.vuValues) {
      throw new Error("Error getting vu values. No values received yet.");
    }
    return this.vuValues[channelId];
  }

  /* gain reduction (<= 0 dB) and output level (dBFS) of a channel strip */
  getChannelStripMeters(stackIndex) {
    if (!this.vuValues) return null;
    const gr = this.vuValues.channelStripGainReduction[stackIndex];
    const out = this.vuValues.channelStripOutput[stackIndex];
    return {
      gainReduction: Math.min(0, meterValueToDb(gr.momentary)),
      output: meterValueToDb(out.momentary),
      outputPeak: meterValueToDb(out.max),
    };
  }

  #setLocal(paramName, value, stackIndex) {
    const spec = this.params.get(paramName);
    if (spec.channel.kind === "stack") {
      const strips = [stackIndex];
      // the device mirrors parameters of stereo strips
      if (this.channelStripSettings[stackIndex]?.ChannelStripStereoLink) {
        strips.push(stackIndex ^ 1);
      }
      strips.forEach((s) => {
        if (this.channelStripSettings[s]) {
          this.channelStripSettings[s][paramName] = value;
        }
      });
      return;
    }
    this.settings[paramName] = value;

    // mirror locally what the device mirrors for linked channels
    if (
      spec.channel.kind === "channels"
      && spec.channel.channels.length === 1
      && LINK_MIRRORED_PARAM_IDS.includes(spec.paramNumber)
    ) {
      const channel = spec.channel.channels[0];
      if (this.isLinked(channel)) {
        const partner = getLinkPartner(channel);
        const partnerName = this.#findParamName(spec.paramNumber, partner);
        if (partnerName) this.settings[partnerName] = value;
      }
    }
  }

  #findParamName(paramNumber, channel) {
    for (const [name, spec] of this.params) {
      if (
        spec.paramNumber === paramNumber
        && spec.channel.kind === "channels"
        && spec.channel.channels.length === 1
        && spec.channel.channels[0] === channel
      ) {
        return name;
      }
    }
    return null;
  }

  updateParamValue(paramName, value, stackIndex) {
    if (!this.#ports || !this.settings) {
      throw new Error("Controller not initialized!");
    }

    const param = this.params.get(paramName);
    if (!param) {
      throw new Error("Invalid param name: " + paramName);
    }
    if (param.readOnly) {
      throw new Error("This parameter is read-only");
    }

    let channelIndexes;
    if (param.channel.kind === "global") {
      channelIndexes = [0];
    } else if (param.channel.kind === "stack") {
      if (
        typeof stackIndex !== "number"
        || stackIndex < 0
        || stackIndex >= STRIP_COUNT
      ) {
        throw new Error("Invalid stack index: " + stackIndex);
      }
      channelIndexes = [stackIndex];
    } else {
      channelIndexes = param.channel.channels;
    }

    for (const channelIndex of channelIndexes) {
      this.#send(encodeParamChange(param.paramNumber, channelIndex, value));
    }
    this.#setLocal(paramName, value, stackIndex);
    this.#localChanges.push({
      seq: ++this.#changeSeq, paramName, value, stackIndex,
    });
    if (this.#localChanges.length > 1000) this.#localChanges.shift();
    this.#emit({ type: "local-change", paramName });

    if (param.paramNumber === LINK_PARAM) {
      // Linking copies values from the left to the right channel and turns
      // channel strips into stereo strips.
      return this.refresh();
    }

    if (param.paramNumber === MORPH_VALUE_PARAM) {
      // The device interpolates the compressor and EQ values from the
      // morphing table, read them back (debounced while dragging).
      this.#applyMorphLocally(stackIndex, value);
      clearTimeout(this.#morphRefreshTimer);
      this.#morphRefreshTimer = setTimeout(() => {
        this.refresh()
          .then(() => this.#emit({ type: "state-refresh" }))
          .catch((e) => console.error(e));
      }, 250);
    }

    return Promise.resolve();
  }

  #applyMorphLocally(stackIndex, morphValue) {
    const points = this.morphTable[stackIndex];
    const strip = this.channelStripSettings[stackIndex];
    if (!points || !strip) return;
    MORPH_TABLE_PARAM_IDS.forEach((morphId, i) => {
      // morph table ids 83..99 correspond to strip params 45..63 (without 54)
      const targetId = MORPH_TARGET_IDS[i];
      for (const [name, spec] of this.params) {
        if (spec.paramNumber === targetId && spec.channel.kind === "stack") {
          strip[name] = interpolateMorph(points.map((p) => p[i]), morphValue);
        }
      }
    });
  }

  /*
    Sweet Spot Data: the morphing table of one channel strip.
    { id: "0001", name: "01 Basic", points: number[9][17] }
  */
  getSweetSpotData(stackIndex) {
    return {
      id: this.sweetSpots[stackIndex]?.id ?? "",
      name: this.sweetSpots[stackIndex]?.name ?? "",
      points: this.morphTable[stackIndex]?.map((p) => [...p]) ?? [],
    };
  }

  async loadSweetSpotData(stackIndex, { id, name, points }) {
    if (!this.#lastDump) throw new Error("Controller not initialized!");
    if (
      points.length !== MORPH_POINTS
      || points.some((p) => p.length !== MORPH_TABLE_PARAM_IDS.length)
    ) {
      throw new Error("Invalid sweet spot data");
    }
    points.forEach((point) => point.forEach((value, i) => {
      const range = PARAM_RANGES[MORPH_TABLE_KEYS[i]];
      if (
        !Number.isInteger(value) || value < range.min || value > range.max
      ) {
        throw new Error(
          `Invalid sweet spot data: ${MORPH_TABLE_KEYS[i]} = ${value}`,
        );
      }
    }));
    id = toDeviceString(id ?? "");
    name = toDeviceString(name ?? "");

    // a stereo strip consists of two strips which share their settings
    const strips = this.channelStripSettings[stackIndex]?.ChannelStripStereoLink
      ? [stackIndex & ~1, stackIndex | 1]
      : [stackIndex];

    const values = new Map(
      [...this.#lastDump.values].map(([k, v]) => [k, [...v]]),
    );
    const writeString = (paramId, length, strip, string) => {
      const array = values.get(paramId);
      for (let i = 0; i < length; i++) {
        array[strip * length + i] = i < string.length
          ? string.charCodeAt(i)
          : 0;
      }
    };
    for (const strip of strips) {
      writeString(MORPH_SYSTEM_ID_PARAM, MORPH_SYSTEM_ID_LENGTH, strip, id);
      writeString(
        MORPH_SYSTEM_NAME_PARAM, MORPH_SYSTEM_NAME_LENGTH, strip, name,
      );
      points.forEach((point, p) => {
        MORPH_TABLE_PARAM_IDS.forEach((paramId, i) => {
          values.get(paramId)[strip * MORPH_POINTS + p] = point[i];
        });
      });
    }

    const groups = this.#lastDump.groups.filter((g) => {
      return g.params.some((p) => p.id >= MORPH_SYSTEM_ID_PARAM && p.id <= 99);
    });
    const blockHeader = (header, prefix) => {
      const nameBytes = new Array(16).fill(0);
      [...`${prefix}MorphingTable`].forEach((c, i) => {
        nameBytes[i] = c.charCodeAt(0);
      });
      return [...nameBytes, ...header.slice(16)];
    };
    const ack = this.#waitFor(
      this.#pendingAcks,
      (m) => m.type === "bulk-ack" && m.dumpType === 2,
      "morphing table ack",
    );
    this.#send(encodeBulkDump({
      address: [0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x02],
      formatHeader: blockHeader(this.#lastDump.formatHeader, "F_"),
      dataHeader: blockHeader(this.#lastDump.dataHeader, "D_"),
      groups,
      values,
    }));
    await ack;

    // make the device apply the new table at the current morph position
    for (const strip of strips) {
      const morph = this.channelStripSettings[strip].ChannelStripMorphing;
      this.#send(encodeParamChangeReapply(MORPH_VALUE_PARAM, strip, morph));
    }
    await this.refresh();
    this.#emit({ type: "local-change" });
  }

  /* Scenes are stored on the host, like dspMixFx does. */
  async captureScene() {
    const reply = this.#waitFor(
      this.#pendingDumps,
      ({ message }) => message.dump.name === "CurrentScene",
      "scene dump",
    );
    this.#send(encodeDumpRequest(DUMP_ADDRESS_CURRENT_SCENE));
    const { raw } = await reply;
    const extras = {};
    for (const id of QUERIED_PARAM_IDS) {
      const name = [...this.params].find(([, s]) => s.paramNumber === id)?.[0];
      if (name) extras[id] = this.settings[name];
    }
    return { dump: raw, extras };
  }

  async recallScene({ dump, extras = {} }) {
    // like dspMixFx: remove all effects first, the dump re-inserts them
    for (let channel = 0; channel < 6; channel++) {
      this.#send(encodeFxRemove(FX_CHANNEL_STRIP, channel));
      this.#send(encodeFxRemove(FX_GUITAR_AMP, channel));
    }
    const ack = this.#waitFor(
      this.#pendingAcks,
      (m) => m.type === "bulk-ack" && m.dumpType === 1,
      "scene ack",
    );
    this.#send(dump);
    await ack;
    for (const [id, value] of Object.entries(extras)) {
      this.#send(encodeParamChange(parseInt(id), 0, value));
      const name = [...this.params]
        .find(([, s]) => s.paramNumber === parseInt(id))?.[0];
      if (name) this.settings[name] = value;
    }
    await this.storeToDevice();
    await this.refresh();
  }

  /* Makes the device keep the current state after power cycling. */
  async storeToDevice() {
    const ack = this.#waitFor(
      this.#pendingAcks,
      (m) => m.type === "store-ack",
      "store ack",
    );
    this.#send(STORE_COMMAND);
    await ack;
  }

  selectActiveMix(mix) {
    // PatchDawMeter and PatchMasterMeter: which mix the meters show
    [35, 36].forEach((param) => {
      this.#send(encodeParamChange(param, 0, mix));
    });
  }

  getDBFSFromSliderValue(val) {
    return getDBFSFromSliderValue(val);
  }

  static INPUT_CHANNEL_IDS = [
    "analog1",
    "analog2",
    "analog3",
    "analog4",
    "analog5",
    "analog6",
  ];

  static INPUT_CHANNEL_TITLES = [
    "Analog 1",
    "Analog 2",
    "Analog 3",
    "Analog 4",
    "Analog 5",
    "Analog 6",
  ];

  getChannelIndexFromChannelId(channelId) {
    return UR44.INPUT_CHANNEL_IDS.indexOf(channelId);
  }

  sendInitMessages() {
    const initMessages = [
      // monitor matrix control mode
      [0xf0, 0x43, 0x10, 0x3e, 0x14, 0x03, 0x09, 0x01, 0x00, 0xf7],
      // "EDITOR 2.2.0"
      [
        0xf0, 0x43, 0x10, 0x3e, 0x14, 0x00, 0x01, 0x45, 0x44, 0x49, 0x54, 0x4f,
        0x52, 0x00, 0x32, 0x2e, 0x32, 0x2e, 0x30, 0x00, 0xf7,
      ],
      // version request
      [0xf0, 0x43, 0x30, 0x3e, 0x14, 0x00, 0x07, 0x70, 0x02, 0xf7],
      // meters of mix 1
      encodeParamChange(36, 0, 0),
      encodeParamChange(35, 0, 0),
      // start meters
      [0xf0, 0x43, 0x30, 0x3e, 0x14, 0x02, 0x02, 0x32, 0x7f, 0xf7],
    ];

    initMessages.forEach((m) => this.#send(m));
  }

  closeSession() {
    const CLOSE_MESSAGE = [
      0xf0, 0x43, 0x30, 0x3e, 0x14, 0x02, 0x02, 0x32, 0x00, 0xf7,
    ];
    this.#send(CLOSE_MESSAGE);
  }
}

/* strip param ids in the order of MORPH_TABLE_PARAM_IDS */
const MORPH_TARGET_IDS = [
  45, 46, 47, 48, 49, 50, 51, 52, 53, 56, 57, 58, 59, 60, 61, 62, 63,
];

/*
  Vol db steps
  0 = -Infinity
  -74 - -50 2DB steps
  -50 - -20 1DB steps
  -20 - -10 0.5 db steps
  -10 - +6  0.25 db steps
*/
const DB_STEPS = (() => {
  const values = [-Infinity];
  for (let db = -74; db < -50; db += 2) values.push(db);
  for (let db = -50; db < -20; db += 1) values.push(db);
  for (let db = -20; db < -10; db += 0.5) values.push(db);
  for (let db = -10; db <= 6; db += 0.25) values.push(db);
  return values;
})();

export const getDBFSFromSliderValue = (val) => DB_STEPS[val];
