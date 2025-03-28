import { arraysAreEqual } from "./utils.js";
import UR44Params from "./UR44-params.js";

export const AMP_TYPES = [
  "Clean",
  "Crunch",
  "Lead",
  "Drive",
];

const getMIDIDevices = async () => {
  const midi = await navigator.requestMIDIAccess({ sysex: true });

  let interfaceInput;

  for (const input of midi.inputs.values()) {
    if (input.name.includes("Steinberg UR44")) {
      interfaceInput = input;
    }
  }

  if (!interfaceInput) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  let interfaceOutput;

  for (const output of midi.outputs.values()) {
    if (output.name.includes("Steinberg UR44")) {
      interfaceOutput = output;
    }
  }

  if (!interfaceOutput) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  return [interfaceInput, interfaceOutput];
};

export default class UR44 {
  #midiOutput;
  vuValues;

  async getParams() {
    const lines = UR44Params.split("\n");
    const params = new Map();
    for (const line of lines) {
      if (line.trim() === "" || line.startsWith("#")) {
        continue;
      }

      const [
        paramName,
        paramNumber,
        channel,
        min,
        max,
        defaultValue,
        initMessageIndex,
        readOnly,
      ] = line.split(",");
      params.set(paramName, {
        paramNumber,
        channel,
        min: parseInt(min),
        max: parseInt(max),
        defaultValue: parseInt(defaultValue),
        initMessageIndex: parseInt(initMessageIndex),
        readOnly: readOnly === "true",
      });

      this.params = params;
    }
  }

  async open(messageHandler) {
    const [midiInput, midiOutput] = await getMIDIDevices();
    this.#midiOutput = midiOutput;
    console.log("Controller initialized");

    await midiInput.open();
    this.sendInitMessages();

    await this.getParams();

    const { promise, resolve } = Promise.withResolvers();

    midiInput.onmidimessage = (message) => {
      const messageParsed = this.parseSysExMessage(message.data);
      if (messageParsed.type === "unknown") {
        console.log("Unknown message received", messageParsed.raw);
      } else if (messageParsed.type === "init") {
        this.settings = new Proxy(messageParsed.values,  {
          get(target, prop, receiver) {
            // Promise checker should be satisfied
            if (prop === "then") {
              return null;
            }

            if (typeof target[prop] === "undefined") {
              throw new Error("Requested unknown param: " + prop);
            }
            return target[prop];
          },
          set(obj, prop, value) {
            if (typeof obj[prop] === "undefined") {
              throw new Error("Tried to set unknown param: " + prop);
            }

            obj[prop] = value;
            return true;
          },
        });

        this.fxState = [...messageParsed.fxState];

        resolve({
          params: this.settings,
          connectionName: this.#midiOutput.name,
          fxState: this.fxState,
        });
      } else if (messageParsed.type === "meter-update") {
        this.vuValues = messageParsed.values;
      } else if (messageParsed.type === "change-parameter") {
        if (messageParsed.param === 40) {
          if (messageParsed.channel === 0) {
            this.settings.PhantomPower01 = messageParsed.value;
            messageHandler?.({
              type: "change-parameter",
              paramName: "PhantomPower01",
              newValue: messageParsed.value,
            });
          } else if (messageParsed.channel === 1) {
            this.settings.PhantomPower23 = messageParsed.value;
            messageHandler?.({
              type: "change-parameter",
              paramName: "PhantomPower23",
              newValue: messageParsed.value,
            });
          }
        } else {
          console.warn("Unknown parameter changed message received");
          console.warn(messageParsed);
        }
      }
    };

    return promise;
  }

  #sendChangeParameterValue(
    parameter,
    value,
    channelIndex = 0,
  ) {
    const p0 = (parameter >> 7 * 0) & 0x7F;
    const p1 = (parameter >> 7 * 1) & 0x7F;
    const v32 = value & 0xFFFFFFFF;
    const v0 = (v32 >> 7 * 0) & 0x7F;
    const v1 = (v32 >> 7 * 1) & 0x7F;
    const v2 = (v32 >> 7 * 2) & 0x7F;
    const v3 = (v32 >> 7 * 3) & 0x7F;
    const v4 = (v32 >> 7 * 4) & 0x7F;
    const message = [
      0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00,
      p1, p0, 0x00, 0x00, channelIndex, v4, v3, v2, v1, v0, 0xF7,
    ];
    this.#midiOutput.send(message);
  };

  static FX_HEADER = [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x03, 0x08];

  setFX(channelIndex, type, mode) {
    console.log("setFX", channelIndex, type, mode);
    if (!canSetFx(type, channelIndex, this.fxState.map((s) => s.type))) {
      throw new Error("Cannot add FX due to lack of resources: " + type);
    }

    const modeByte = mode === "monitor" ? 0x01 : 0x00;

    const turnOnCSMessage = [
      ...UR44.FX_HEADER, 0x01, 0x00, 0x00, 0x00, channelIndex, modeByte, 0xf7,
    ];
    const turnOnAmpMessage = [
      ...UR44.FX_HEADER, 0x01, 0x01, 0x00, 0x00, channelIndex, modeByte, 0xf7,
    ];

    const turnOffCSMessage = [
      ...UR44.FX_HEADER, 0x02, 0x00, 0x00, 0x00, channelIndex, 0xf7,
    ];
    const turnOffAmpMessage = [
      ...UR44.FX_HEADER, 0x02, 0x01, 0x00, 0x00, channelIndex, 0xf7,
    ];

    if (type === "off") {
      this.#midiOutput.send(turnOffCSMessage);
      this.#midiOutput.send(turnOffAmpMessage);
      this.fxState[channelIndex] = {
        type: "off",
      };
    } else if (type === "channel-strip") {
      this.#midiOutput.send(turnOffAmpMessage);
      this.#midiOutput.send(turnOnCSMessage);
      this.fxState[channelIndex] = {
        type,
        mode,
      };
    } else if (type === "amp") {
      this.#midiOutput.send(turnOffCSMessage);
      this.#midiOutput.send(turnOnAmpMessage);
      this.fxState[channelIndex] = {
        type,
        mode,
      };
    } else {
      throw new Error("Invalid FX type: " + type);
    }
  }

  getVuValues(channelId) {
    if (!this.vuValues) throw new Error(
      "Error getting vu values. No values received yet.",
    );
    return this.vuValues[channelId];
  };

  updateParamValue(paramName, value) {
    if (!this.#midiOutput || !this.params) {
      throw new Error("Controller not initialized!");
    }

    if (!this.params.has(paramName)) {
      throw new Error("Invalid param name: " + paramName);
    }

    const param = this.params.get(paramName);

    if (param.readOnly) {
      throw new Error("This parameter is read-only");
    }

    if (param.channel === "null") {
      console.log(
        "updateParamValue", paramName, value,
      );
      this.#sendChangeParameterValue(
        param.paramNumber, value,
      );
      this.settings[paramName] = value;
      return;
    }

    // Check if we need to provide an input channel
    let channelIndexes;
    if (param.channel.includes("+")) {
      channelIndexes = param.channel.split("+").map((c) => parseInt(c.trim()));
    } else {
      channelIndexes = [parseInt(param.channel)];
    }

    if (channelIndexes.some((c) => c < 0 || c > 5)) {
      throw new Error("Invalid input index: " + param.channel);
    }

    for (const channelIndex of channelIndexes) {
      console.log(
        "updateParamValue", paramName, value, channelIndex,
      );
      this.#sendChangeParameterValue(
        param.paramNumber, value, channelIndex,
      );
      this.settings[paramName] = value;
    }
  };

  selectActiveMix(mix) {
    if (!this.#midiOutput) {
      throw new Error("Controller not initialized!");
    }

    const params = [0x23, 0x24];
    params.forEach((param) => {
      this.#sendChangeParameterValue(param, mix);
    });
  };


  getDBFSFromSliderValue(val) {
    /*
      Vol db steps

      0 = -Infinity
      -74 - -50 2DB steps
      -50 - -20 1DB steps
      -20 - -10 0.5 db steps
      -10 - +6  0.25 db steps
    */

    // This mapping is neither linear nor perfectly logarithmic, therefore we
    // use this lookup table.
    const values = [
      -Infinity,
      -74,
      -72,
      -70,
      -68,
      -66,
      -64,
      -62,
      -60,
      -58,
      -56,
      -54,
      -52,
      -50,
      -49,
      -48,
      -47,
      -46,
      -45,
      -44,
      -43,
      -42,
      -41,
      -40,
      -39,
      -38,
      -37,
      -36,
      -35,
      -34,
      -33,
      -32,
      -31,
      -30,
      -29,
      -28,
      -27,
      -26,
      -25,
      -24,
      -23,
      -22,
      -21,
      -20,
      -19.5,
      -19,
      -18.5,
      -18,
      -17.5,
      -17,
      -16.5,
      -16,
      -15.5,
      -15,
      -14.5,
      -14,
      -13.5,
      -13,
      -12.5,
      -12,
      -11.5,
      -11,
      -10.5,
      -10,
      -9.75,
      -9.5,
      -9.25,
      -9,
      -8.75,
      -8.5,
      -8.25,
      -8,
      -7.75,
      -7.5,
      -7.25,
      -7,
      -6.75,
      -6.5,
      -6.25,
      -6,
      -5.75,
      -5.5,
      -5.25,
      -5,
      -4.75,
      -4.5,
      -4.25,
      -4,
      -3.75,
      -3.5,
      -3.25,
      -3,
      -2.75,
      -2.5,
      -2.25,
      -2,
      -1.75,
      -1.5,
      -1.25,
      -1,
      -0.75,
      -0.5,
      -0.25,
      0,
      0.25,
      0.5,
      0.75,
      1,
      1.25,
      1.5,
      1.75,
      2,
      2.25,
      2.5,
      2.75,
      3,
      3.25,
      3.5,
      3.75,
      4,
      4.25,
      4.5,
      4.75,
      5,
      5.25,
      5.5,
      5.75,
      6,
    ];
    return values[val];
  };


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
  };

  parseSysExMessage(message) {
    // change parameter message
    if (
      message.length === 19
      && arraysAreEqual(
        message.slice(0, 8),
        [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x01, 0x00],
      )
    ) {
      const param = message[8] * 128 + message[9];
      const channel = message[12];
      const v32
        = message[13] * (128 ** 4)
        + message[14] * (128 ** 3)
        + message[15] * (128 ** 2)
        + message[16] * 128
        + message[17];
      const value = (v32 & 0x7FFFFFFF) - (v32 & 0x80000000);
      return {
        "type": "change-parameter",
        "channel": channel,
        "param": param,
        "value": value,
      };
    // query parameter message
    } else if (
      message.length === 15
      && arraysAreEqual(
        message.slice(0, 9),
        [0xF0, 0x43, 0x30, 0x3E, 0x14, 0x01, 0x04, 0x02, 0x00],
      )
    ) {
      const param = message[9] * 128 + message[10];
      const channel = message[13];
      return {
        "type": "query-parameter",
        "channel": channel,
        "param": param,
      };
    // reply parameter message
    } else if (
      message.length === 20
      && arraysAreEqual(
        message.slice(0, 9),
        [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x01, 0x04, 0x02, 0x00],
      )
    ) {
      const param = message[9] * 128 + message[10];
      const channel = message[13];
      const v32
        = message[14] * (128 ** 4)
        + message[15] * (128 ** 3)
        + message[16] * (128 ** 2)
        + message[17] * 128
        + message[18];
      const value = (v32 & 0x7FFFFFFF) - (v32 & 0x80000000);
      return {
        "type": "reply-parameter",
        "channel": channel,
        "param": param,
        "value": value,
      };
      // meter update message
    /*
      Indexes table
      Channel Mom.  Recent maximum
      Analog1 08-09 11-12
      Analog2 14-15 17-18
      Analog3 20-21 23-24
      Analog4 26-27 29-30
      Analog5 32-33 35-36
      Analog6 38-39 41-42
      DAW L   44-45 47-48
      DAW R   50-51 53-54
      MasterL 56-57 59-60
      MasterR 62-63 65-66
    */
    } else if (
      message.length === 140
      && arraysAreEqual(message.slice(0, 7), [240, 67, 16, 62, 20, 2, 2])
    ) {
      const values = {
        analog1: {
          momentary: message[8] * 128 + message[9],
          max: message[11] * 128 + message[12],
        },
        analog2: {
          momentary: message[14] * 128 + message[15],
          max: message[17] * 128 + message[18],
        },
        analog3: {
          momentary: message[20] * 128 + message[21],
          max: message[23] * 128 + message[24],
        },
        analog4: {
          momentary: message[26] * 128 + message[27],
          max: message[29] * 128 + message[30],
        },
        analog5: {
          momentary: message[32] * 128 + message[33],
          max: message[35] * 128 + message[36],
        },
        analog6: {
          momentary: message[38] * 128 + message[39],
          max: message[41] * 128 + message[42],
        },
        dawL: {
          momentary: message[44] * 128 + message[45],
          max: message[47] * 128 + message[48],
        },
        dawR: {
          momentary: message[50] * 128 + message[51],
          max: message[53] * 128 + message[54],
        },
        masterL: {
          momentary: message[56] * 128 + message[57],
          max: message[59] * 128 + message[60],
        },
        masterR: {
          momentary: message[62] * 128 + message[63],
          max: message[65] * 128 + message[66],
        },
      };

      return {
        "type": "meter-update",
        values,
      };
    // keepalive
    } else if (arraysAreEqual(
      message,
      [0xF0, 0x43, 0x10, 0x3E, 0x14, 0x00, 0x04, 0x02, 0xF7],
    )) {
      return { "type": "keepalive" };
    } else if (message.length === 3520) {
      console.log(message);

      const values = {};

      for (const [param, props] of this.params.entries()) {
        const rawValue = message[props.initMessageIndex];

        if ((props.min < 0) && (rawValue > 64)) {
          values[param] = rawValue - 128;
        } else {
          values[param] = rawValue;
        }
      }

      const getFxState = (csInsOn, csMonOn, ampInsOn, ampMonOn) => {
        if (csInsOn === 1) {
          return {
            type: "channel-strip",
            mode: "insert",
          };
        } else if (csMonOn === 1) {
          return {
            type: "channel-strip",
            mode: "monitor",
          };
        } else if (ampInsOn === 1) {
          return {
            type: "amp",
            mode: "insert",
          };
        } else if (ampMonOn === 1) {
          return {
            type: "amp",
            mode: "monitor",
          };
        } else {
          return {
            type: "off",
          };
        }
      };

      return {
        "type": "init",
        values,
        fxState: [
          getFxState(message[971], message[978], message[985], message[992]),
          getFxState(message[972], message[979], message[986], message[993]),
          getFxState(message[974], message[980], message[987], message[994]),
          getFxState(message[975], message[982], message[988], message[995]),
          getFxState(message[976], message[983], message[990], message[996]),
          getFxState(message[977], message[984], message[991], message[998]),
        ],
      };
    }

    return { "type": "unknown", raw: message };
  };


  sendInitMessages() {
    const initMessages = [
      [0xf0, 0x43, 0x10, 0x3e, 0x14, 0x03, 0x09, 0x01, 0x00, 0xf7],
      [
        0xf0, 0x43, 0x10, 0x3e, 0x14, 0x00, 0x01, 0x45, 0x44, 0x49, 0x54, 0x4f,
        0x52, 0x00, 0x32, 0x2e, 0x32, 0x2e, 0x30, 0x00, 0xf7,
      ],
      [
        0xf0, 0x43, 0x20, 0x3e, 0x14, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x03,
        0xf7,
      ],
      [0xf0, 0x43, 0x30, 0x3e, 0x14, 0x00, 0x07, 0x70, 0x02, 0xf7],

      // selecting active mix 1
      [
        0xf0, 0x43, 0x10, 0x3e, 0x14, 0x01, 0x01, 0x00, 0x00, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf7,
      ],
      [
        0xf0, 0x43, 0x10, 0x3e, 0x14, 0x01, 0x01, 0x00, 0x00, 0x23, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf7,
      ],
      [0xf0, 0x43, 0x30, 0x3e, 0x14, 0x02, 0x02, 0x32, 0x7f, 0xf7],
    ];

    initMessages.forEach((m) => this.#midiOutput.send(m));
  };
}


/*
According to the UR44 manual, the following FX combinations are possible

Channel Strip Guitar Amp Emulation
Mono Stereo   Mono Stereo
4    0        0    -
2    1        0    -
2    0        1    -
0    2        0    -
0    1        1    -

This means we have a total budget of 4 (counting stereo channel strip and
guitar amp emulation with 2, with the additional requirement that there
can be only one guitar amp emulation active)
*/

export const getBudgetInUse = (existingActiveTypes) => {
  return existingActiveTypes
    .reduce((a, b) => {
      if (b === "channel-strip") {
        return a + 1;
      } else if (b === "amp") {
        return a + 2;
      } else if (b === "off") {
        return a;
      }
      throw new Error("Unknown FX type: " + b);
    }, 0);
};

// TODO: consider stereo channel strips
export const canSetFx = (type, channelIndex, existingActiveTypes) => {
  const budgetInUse = getBudgetInUse(existingActiveTypes);
  const existingChannelType = existingActiveTypes[channelIndex];

  if (type === "channel-strip") {
    /*
      Adding a channel-strip is allowed if the budget is not exceeded
      or if there is already some fx on that channel. If there is already one,
      the budget can't increase by setting this channel to channel-strip.
    */
    return budgetInUse < 4
      || existingChannelType !== "off";
  } else if (type === "amp") {
    /*
      Adding an amp is allowed if the budget is not exceeded and there is no
      other amp in use.
      Only if this channel uses already the amp, it should be allowed to
      re-set it to amp.
    */
    return (
      (
        budgetInUse < 3
        && existingActiveTypes.filter((s) => s === "amp").length === 0
      )
      || existingChannelType === "amp"
    );
  } else if (type === "off") {
    return true;
  } else {
    throw new Error("Unknown FX type: " + type);
  }
};
