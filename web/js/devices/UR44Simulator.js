import { canSetFx } from "./UR44.js";

const INIT_PARAMS = {
  Input0Link: 0,
  Input2Link: 0,
  Input4Link: 1,
  Input0InvertPhase: 0,
  Input1InvertPhase: 0,
  Input2InvertPhase: 0,
  Input3InvertPhase: 1,
  Input4InvertPhase: 1,
  Input5InvertPhase: 1,
  Input0HPFEnabled: 1,
  Input1HPFEnabled: 0,
  Input2HPFEnabled: 0,
  Input3HPFEnabled: 0,
  InputHPFSetting: 2,
  Mix0Input0Solo: 1,
  Mix0Input1Solo: 0,
  Mix0Input2Solo: 0,
  Mix0Input3Solo: 0,
  Mix0Input4Solo: 1,
  Mix0Input5Solo: 1,
  Mix1Input0Solo: 0,
  Mix1Input1Solo: 0,
  Mix1Input2Solo: 0,
  Mix1Input3Solo: 0,
  Mix1Input4Solo: 0,
  Mix1Input5Solo: 0,
  Mix0Input0Mute: 1,
  Mix0Input1Mute: 1,
  Mix0Input2Mute: 0,
  Mix0Input3Mute: 0,
  Mix0Input4Mute: 1,
  Mix0Input5Mute: 1,
  Mix1Input0Mute: 0,
  Mix1Input1Mute: 0,
  Mix1Input2Mute: 0,
  Mix1Input3Mute: 0,
  Mix1Input4Mute: 0,
  Mix1Input5Mute: 0,
  Mix0Input0Volume: 98,
  Mix0Input1Volume: 92,
  Mix0Input2Volume: 27,
  Mix0Input3Volume: 55,
  Mix0Input4Volume: 0,
  Mix0Input5Volume: 0,
  Mix1Input0Volume: 0,
  Mix1Input1Volume: 0,
  Mix1Input2Volume: 0,
  Mix1Input3Volume: 0,
  Mix1Input4Volume: 0,
  Mix1Input5Volume: 0,
  Input0ReverbSend: 100,
  Input1ReverbSend: 0,
  Input2ReverbSend: 80,
  Input3ReverbSend: 80,
  Input4ReverbSend: 0,
  Input5ReverbSend: 0,
  Mix0Input0Pan: 0,
  Mix0Input1Pan: 0,
  Mix0Input2Pan: -9,
  Mix0Input3Pan: 5,
  Mix0Input4Pan: -16,
  Mix0Input5Pan: 16,
  Mix1Input0Pan: 0,
  Mix1Input1Pan: 0,
  Mix1Input2Pan: 0,
  Mix1Input3Pan: 0,
  Mix1Input4Pan: 0,
  Mix1Input5Pan: 0,
  Mix0DAWSolo: 0,
  Mix1DAWSolo: 0,
  Mix0DAWMute: 1,
  Mix1DAWMute: 0,
  Mix0DAWVolume: 88,
  Mix1DAWVolume: 0,
  Mix0DAWPan: 0,
  Mix1DAWPan: 0,
  ReverbType: 0,
  ReverbTime: 0,
  ReverbDiffusion: 0,
  ReverbInitialDelay: 40,
  ReverbHPF: 0,
  ReverbLPF: 0,
  ReverbRoomSize: 0,
  ReverbHighRatio: 0,
  ReverbLowRatio: 0,
  ReverbDecay: 0,
  ReverbLowFreq: 0,
  Mix0ReverbVolume: 100,
  Mix1ReverbVolume: 0,
  Mix0MainMute: 1,
  Mix1MainMute: 0,
  Mix0MainVolume: 103,
  Mix1MainVolume: 0,
  Mix0MainPan: 0,
  Mix1MainPan: 0,
  Phones2Output: 0,
  Loopback: 0,
  ReverbInputMix: 0,
  PhantomPower01: 1,
  PhantomPower23: 0,
  Input45Level: 0,
  AmpType: 0,
};

const vuValues = {
  analog1: {
    momentary: 4000,
    max: 5000,
  },
  analog2: {
    momentary: 0,
    max: 0,
  },
  analog3: {
    momentary: 0,
    max: 0,
  },
  analog4: {
    momentary: 0,
    max: 0,
  },
  analog5: {
    momentary: 0,
    max: 0,
  },
  analog6: {
    momentary: 0,
    max: 0,
  },
  dawL: {
    momentary: 7000,
    max: 7150,
  },
  dawR: {
    momentary: 7000,
    max: 7150,
  },
  masterL: {
    momentary: 6600,
    max: 6750,
  },
  masterR: {
    momentary: 6600,
    max: 6750,
  },
};

export default class UR44Simulator {
  async open(messageHandler) {
    this.settings = INIT_PARAMS;
    this.fxState = [
      {
        type: "amp",
        mode: "monitor",
      },
      {
        type: "off",
      },
      {
        type: "off",
      },
      {
        type: "channel-strip",
        mode: "monitor",
      },
      {
        type: "off",
      },
      {
        type: "off",
      },
    ];

    console.log("UR44 Simulator opened");

    return {
      params: this.settings,
      connectionName: "UR44 Simulator",
      fxState: this.fxState,
    };
  }

  getVuValues(channelId) {
    return vuValues[channelId];
  };

  setFX(channelIndex, type, mode) {
    if (!canSetFx(type, channelIndex, this.fxState.map((fx) => fx.type))) {
      throw new Error("Cannot add FX due to lack of resources: " + type);
    }

    this.fxState[channelIndex] = {
      type,
      mode,
    };
  }

  updateParamValue(paramName, value) {
    if (typeof value !== "number") {
      console.warn(
        `Value for ${paramName} is not a number. Continuing anyway.`,
      );
    }
    if (typeof this.settings[paramName] === "undefined") {
      console.error(`Unknown parameter: ${paramName}`);
    }
    this.settings[paramName] = value;
    console.log(`Updated ${paramName} to ${value}`);
  };

  selectActiveMix(mix) {};

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

  getChannelIndexFromChannelId(channelId) {
    return this.constructor.INPUT_CHANNEL_IDS.indexOf(channelId);
  };
}
