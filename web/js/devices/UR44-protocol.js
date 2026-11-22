/*
  Low-level SysEx protocol of the Steinberg UR44.

  All messages have the form F0 43 <type> 3E 14 ... F7
    type 0x10: parameter change / command (both directions)
    type 0x20: bulk dump request
    type 0x30: request (parameter query, meter start/stop, ...)
    type 0x00: bulk dump

  See docs/protocol.md for the parameter ids.
*/

export const SYSEX_HEADER = [0xF0, 0x43];
export const MODEL_ID = [0x3E, 0x14];

/*
  Bulk dumps are 8-to-7 packed: every group of 7 data bytes is followed by one
  byte holding the most significant bits of those 7 bytes (bit 6 = first byte).
*/
export const unpack7 = (bytes) => {
  const out = [];
  for (let i = 0; i + 7 < bytes.length; i += 8) {
    const msb = bytes[i + 7];
    for (let k = 0; k < 7; k++) {
      out.push(bytes[i + k] | (((msb >> (6 - k)) & 1) << 7));
    }
  }
  return out;
};

export const pack7 = (data) => {
  const out = [];
  for (let i = 0; i < data.length; i += 7) {
    let msb = 0;
    for (let k = 0; k < 7; k++) {
      const byte = data[i + k] ?? 0;
      out.push(byte & 0x7F);
      msb |= ((byte >> 7) & 1) << (6 - k);
    }
    out.push(msb);
  }
  return out;
};

export const checksum = (bytes) => {
  const sum = bytes.reduce((a, b) => a + b, 0);
  return (128 - (sum & 0x7F)) & 0x7F;
};

const split14 = (n) => [(n >> 7) & 0x7F, n & 0x7F];

const encodeValue = (value) => {
  const v32 = value >>> 0;
  return [4, 3, 2, 1, 0].map((k) => Math.floor(v32 / (128 ** k)) & 0x7F);
};

const decodeValue = (bytes) => {
  const v32 = bytes.reduce((acc, b) => acc * 128 + b, 0);
  // the value is a 32 bit two's complement integer split into 5x7 bits
  return (v32 % 2 ** 32) >= 2 ** 31
    ? (v32 % 2 ** 32) - 2 ** 32
    : v32 % 2 ** 32;
};

export const encodeParamChange = (paramId, channel, value) => {
  return [
    0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00,
    ...split14(paramId),
    0x00, 0x00, channel & 0x7F,
    ...encodeValue(value),
    0xF7,
  ];
};

export const encodeParamQuery = (paramId, channel) => {
  return [
    0xF0, 0x43, 0x30, 0x3E, 0x14, 0x01, 0x01, 0x00,
    ...split14(paramId),
    0x00, 0x00, channel & 0x7F,
    0xF7,
  ];
};

export const DUMP_ADDRESS_ALL = [0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x03];
export const DUMP_ADDRESS_CURRENT_SCENE = [
  0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x01,
];

export const encodeDumpRequest = (address = DUMP_ADDRESS_ALL) => {
  return [0xF0, 0x43, 0x20, 0x3E, 0x14, ...address, 0xF7];
};

const startsWith = (message, prefix) => {
  return prefix.every((b, i) => message[i] === b);
};

/*
  A bulk dump consists of two blocks: "F_<name>" (format) describing which
  parameters are contained and how many bytes each value occupies, and
  "D_<name>" (data) with the values in exactly that order.
  Each block has a 32 byte header: 16 bytes name, 14 bytes unknown, 2 bytes
  length of the block body.

  Format block body:
    80 01 hi lo           -> start of a group whose params have hi*256+lo
                             elements (e.g. 6 for the input channels)
    idHi idLo flags size  -> parameter of the current group, `size` bytes per
                             value. flags bit 0x40 means "array": two more
                             bytes follow with the number of values per
                             element. flags bit 0x01 means "unsigned".
*/
export const parseBulkDump = (message) => {
  if (
    !startsWith(message, [0xF0, 0x43, 0x00, 0x3E])
    || message[message.length - 1] !== 0xF7
  ) {
    throw new Error("Not a UR44 bulk dump");
  }
  const address = message.slice(7, 14);
  const data = unpack7(message.slice(14, message.length - 2));

  const readName = (offset) => {
    const chars = data.slice(offset, offset + 16);
    const end = chars.indexOf(0);
    return String.fromCharCode(...chars.slice(0, end === -1 ? 16 : end));
  };

  const truncated = () => new Error("Truncated or malformed bulk dump");
  if (data.length < 64) throw truncated();

  const formatName = readName(0);
  const formatLength = data[30] * 256 + data[31];
  if (32 + formatLength + 32 > data.length) throw truncated();
  const groups = [];
  let i = 32;
  while (i < 32 + formatLength) {
    if (data[i] === 0x80) {
      groups.push({
        elements: data[i + 2] * 256 + data[i + 3],
        params: [],
      });
      i += 4;
      continue;
    }
    if (groups.length === 0) throw truncated();
    const param = {
      id: data[i] * 256 + data[i + 1],
      signed: (data[i + 2] & 0x01) === 0,
      size: data[i + 3],
      valuesPerElement: 1,
    };
    i += 4;
    if (data[i - 2] & 0x40) {
      param.valuesPerElement = data[i] * 256 + data[i + 1];
      i += 2;
    }
    groups.at(-1).params.push(param);
  }

  const dataOffset = 32 + formatLength;
  const dataName = readName(dataOffset);
  const values = new Map();
  let pos = dataOffset + 32;
  for (const group of groups) {
    for (const param of group.params) {
      const count = group.elements * param.valuesPerElement;
      if (pos + count * param.size > data.length) throw truncated();
      const paramValues = [];
      for (let n = 0; n < count; n++) {
        let value = 0;
        for (let k = 0; k < param.size; k++) {
          value = value * 256 + data[pos + k];
        }
        if (param.signed && value >= 2 ** (8 * param.size - 1)) {
          value -= 2 ** (8 * param.size);
        }
        paramValues.push(value);
        pos += param.size;
      }
      values.set(param.id, paramValues);
    }
  }

  return {
    address,
    name: formatName.replace(/^F_/, ""),
    dataName: dataName.replace(/^D_/, ""),
    formatHeader: data.slice(0, 32),
    dataHeader: data.slice(dataOffset, dataOffset + 32),
    groups,
    values,
  };
};

/*
  Inverse of parseBulkDump. `dump` must contain groups, values, address and
  the two 32 byte block headers (their length fields are recomputed).
*/
export const encodeBulkDump = (dump) => {
  const formatBody = [];
  for (const group of dump.groups) {
    formatBody.push(0x80, 0x01, group.elements >> 8, group.elements & 0xFF);
    for (const param of group.params) {
      const array = param.valuesPerElement > 1;
      formatBody.push(
        param.id >> 8,
        param.id & 0xFF,
        (param.signed ? 0x00 : 0x01) | (array ? 0x40 : 0x00),
        param.size,
      );
      if (array) {
        formatBody.push(
          param.valuesPerElement >> 8,
          param.valuesPerElement & 0xFF,
        );
      }
    }
  }

  const dataBody = [];
  for (const group of dump.groups) {
    for (const param of group.params) {
      const count = group.elements * param.valuesPerElement;
      const paramValues = dump.values.get(param.id) ?? [];
      for (let n = 0; n < count; n++) {
        let value = paramValues[n] ?? 0;
        if (value < 0) value += 2 ** (8 * param.size);
        for (let k = param.size - 1; k >= 0; k--) {
          dataBody.push(Math.floor(value / 256 ** k) & 0xFF);
        }
      }
    }
  }

  const withLength = (header, length) => {
    const h = [...header];
    h[30] = (length >> 8) & 0xFF;
    h[31] = length & 0xFF;
    return h;
  };

  const data = [
    ...withLength(dump.formatHeader, formatBody.length),
    ...formatBody,
    ...withLength(dump.dataHeader, dataBody.length),
    ...dataBody,
  ];
  const body = [0x14, ...dump.address, ...pack7(data)];
  const size = body.length - 1;
  return [
    0xF0, 0x43, 0x00, 0x3E,
    (size >> 7) & 0x7F, size & 0x7F,
    ...body,
    checksum(body.slice(1)),
    0xF7,
  ];
};

export const readString = (values, paramId, element, length) => {
  const chars = (values.get(paramId) ?? [])
    .slice(element * length, (element + 1) * length);
  const end = chars.indexOf(0);
  return String.fromCharCode(...chars.slice(0, end === -1 ? undefined : end));
};

/* Meter message: F0 43 10 3E 14 02 02 00 + 44 values + F7 */
export const METER_CHANNELS = [
  "analog1", "analog2", "analog3", "analog4", "analog5", "analog6",
  "dawL", "dawR", "masterL", "masterR",
];

/*
  44 values of 3 x 7 bit from byte 7 on, alternating level and peak. Only the
  lower 13 bits are the value, on a logarithmic scale with 102.4 steps per dB
  and 8191 = 0 dBFS (see meterValueToDb). The upper bits are flags.

  Measured on a UR44 with digital test signals on the DAW channels: sines at
  -60/-40/-20 dBFS read 2026/4074/6122 (exactly 102.4 per dB), a 0 dBFS square
  wave reads 8190, a 0 dBFS sine about 8170 (sines read ~0.2 dB low).
*/
export const meterValueToDb = (value) => {
  return Math.max(-80, ((value & 0x1FFF) - 8191) / 102.4);
};

/*
  On the level meters (inputs, DAW, master), bit 15 is the device's "over"
  flag. It is set from about -0.13 dBFS sample peak on; a sine at that level
  reads 8158. Bit 15 is also set on idle gain reduction meters, so it means
  something else there.
*/
export const METER_OVER_FLAG = 0x8000;
export const METER_OVER_VALUE = 8158;

/* whether a level meter reading ({ momentary, max, over }) is clipping */
export const isMeterOver = ({ momentary, max, over }) => {
  return over || Math.max(momentary, max) >= METER_OVER_VALUE;
};

const parseMeters = (message) => {
  const read = (k) => {
    const offset = 7 + k * 3;
    return message[offset] * 16384
      + message[offset + 1] * 128
      + message[offset + 2];
  };
  const pair = (k) => {
    const level = read(k);
    const peak = read(k + 1);
    return {
      momentary: level & 0x1FFF,
      max: peak & 0x1FFF,
      over: ((level | peak) & METER_OVER_FLAG) !== 0,
    };
  };
  const values = {};
  METER_CHANNELS.forEach((channelId, i) => {
    values[channelId] = pair(i * 2);
  });
  values.channelStripGainReduction = [0, 1, 2, 3].map((s) => pair(20 + s * 2));
  values.channelStripOutput = [0, 1, 2, 3].map((s) => pair(28 + s * 2));
  values.guitarAmpInput = [pair(36), pair(38)];
  values.guitarAmpOutput = [pair(40), pair(42)];
  return values;
};

export const parseMessage = (message) => {
  const msg = Array.from(message);
  if (
    msg.length === 19
    && startsWith(msg, [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00])
  ) {
    return {
      type: "change-parameter",
      param: msg[8] * 128 + msg[9],
      channel: msg[12],
      value: decodeValue(msg.slice(13, 18)),
    };
  }
  if (
    msg.length === 140
    && startsWith(msg, [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x02, 0x02])
  ) {
    return { type: "meter-update", values: parseMeters(msg) };
  }
  if (startsWith(msg, [0xF0, 0x43, 0x00, 0x3E]) && msg.length > 100) {
    return { type: "bulk-dump", dump: parseBulkDump(msg) };
  }
  if (
    msg.length === 9
    && startsWith(msg, [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x00, 0x04, 0x02])
  ) {
    return { type: "keepalive" };
  }
  if (startsWith(msg, [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x02, 0x01])) {
    return { type: "store-ack" };
  }
  if (startsWith(msg, [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x02, 0x02])) {
    return { type: "bulk-ack", dumpType: msg.at(-2) };
  }
  return { type: "unknown", raw: msg };
};

export const SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000];

/* DSP effects (channel strip, guitar amp) don't work at 176.4/192 kHz. */
export const fxAvailableAtSampleRateCode = (code) => code < 4;

/*
  The unpacked payload of a bulk dump (both blocks incl. headers) is what
  dspMixFx stores in its scene files (base64 encoded).
*/
export const DUMP_TYPE_CURRENT_SCENE = 1;
export const DUMP_TYPE_MORPHING_TABLE = 2;
export const DUMP_TYPE_ALL = 3;

export const rawDumpToPayload = (raw) => unpack7(raw.slice(14, raw.length - 2));

export const payloadToRawDump = (payload, type = DUMP_TYPE_CURRENT_SCENE) => {
  const body = [0x14, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, type & 0x7F,
    ...pack7(payload)];
  const size = body.length - 1;
  return [
    0xF0, 0x43, 0x00, 0x3E,
    (size >> 7) & 0x7F, size & 0x7F,
    ...body,
    checksum(body.slice(1)),
    0xF7,
  ];
};

const u16 = (n) => [0x00, (n >> 7) & 0x7F, n & 0x7F];

/*
  Like a parameter change, but makes the device re-apply dependent values.
  Used for the morph value (id 54) after the morphing table was changed.
*/
export const encodeParamChangeReapply = (paramId, channel, value) => {
  const msg = encodeParamChange(paramId, channel, value);
  msg[6] = 0x03;
  return msg;
};

export const FX_CHANNEL_STRIP = 0;
export const FX_GUITAR_AMP = 1;

/* insertPoint: 0 = insert (monitor + recording), 1 = monitor only */
export const encodeFxInsert = (fxType, channel, insertPoint) => {
  return [
    0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x08, 0x01, fxType, ...u16(channel),
    insertPoint, 0xF7,
  ];
};

export const encodeFxRemove = (fxType, channel) => {
  return [
    0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x08, 0x02, fxType, ...u16(channel),
    0xF7,
  ];
};

/*
  Makes the device store its current state in its memory, so that it is
  restored after power cycling. Acknowledged by F0 43 10 3E 14 03 02 01 ...
*/
export const STORE_COMMAND = [
  0xF0, 0x43, 0x30, 0x3E, 0x14, 0x03, 0x02, 0x01, 0x00, 0x00, 0x01, 0xF7,
];
