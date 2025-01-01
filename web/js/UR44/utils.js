export const getChannelIndexFromChannelId = (channelId) => {
  const map = {
    "analog1": 0,
    "analog2": 1,
    "analog3": 2,
    "analog4": 3,
    "analog5": 4,
    "analog6": 5,
  };

  return map[channelId];
};


export const getDBFSFromSliderValue = (val) => {
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


const arraysAreEqual = (array1, array2) => {
  return array1.length === array2.length
    && array1.every(
      function (value, index) { return value === array2[index]; },
    );
};


export const parseSysExMessage = (message) => {
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
  } else if (message.length === 3520) { console.log(message);
    const values = {
      input0Linked: message[937], // and 938
      input2Linked: message[939], // and 940
      // 941 empty
      input4Linked: message[942], // and 943
      input0InvertPhaseEnabled: message[951],
      input1InvertPhaseEnabled: message[952],
      input2InvertPhaseEnabled: message[953],
      input3InvertPhaseEnabled: message[954],
      input4InvertPhaseEnabled: message[955],
      input5InvertPhaseEnabled: message[956],
      input0HpfEnabled: message[958],
      input1HpfEnabled: message[959],
      input2HpfEnabled: message[960],
      input3HpfEnabled: message[961],
      hpfSetting: message[964],
      mix1Input0Solo: message[999],
      mix1Input1Solo: message[1000],
      mix1Input2Solo: message[1001],
      mix1Input3Solo: message[1002],
      mix1Input4Solo: message[1003],
      mix1Input5Solo: message[1004],
      // 1005 empty
      mix2Input0Solo: message[1006],
      mix2Input1Solo: message[1007],
      mix2Input2Solo: message[1008],
      mix2Input3Solo: message[1009],
      mix2Input4Solo: message[1010],
      mix2Input5Solo: message[1011],
      mix1Input0Mute: message[1012],
      // 1013 empty
      mix1Input1Mute: message[1014],
      mix1Input2Mute: message[1015],
      mix1Input3Mute: message[1016],
      mix1Input4Mute: message[1017],
      mix1Input5Mute: message[1018],
      mix2Input0Mute: message[1019],
      mix2Input1Mute: message[1020],
      // 1021 empty
      mix2Input2Mute: message[1022],
      mix2Input3Mute: message[1023],
      mix2Input4Mute: message[1024],
      mix2Input5Mute: message[1025],
      mix1Input0Volume: message[1033],
      mix1Input1Volume: message[1034],
      mix1Input2Volume: message[1035],
      mix1Input3Volume: message[1036],
      // 1037 empty
      mix1Input4Volume: message[1038],
      mix1Input5Volume: message[1039],
      mix2Input0Volume: message[1040],
      mix2Input1Volume: message[1041],
      mix2Input2Volume: message[1042],
      mix2Input3Volume: message[1043],
      mix2Input4Volume: message[1044],
      // 1045 empty
      mix2Input5Volume: message[1046],
      // 1053 empty
      mix1Input0Pan: message[1054] > 64 ? message[1054] - 128 : message[1054],
      mix1Input1Pan: message[1055] > 64 ? message[1055] - 128 : message[1055],
      mix1Input2Pan: message[1056] > 64 ? message[1056] - 128 : message[1056],
      mix1Input3Pan: message[1057] > 64 ? message[1057] - 128 : message[1057],
      mix1Input4Pan: message[1058] > 64 ? message[1058] - 128 : message[1058],
      mix1Input5Pan: message[1059] > 64 ? message[1059] - 128 : message[1059],
      mix2Input0Pan: message[1060] > 64 ? message[1060] - 128 : message[1060],
      // 1061 empty
      mix2Input1Pan: message[1062] > 64 ? message[1062] - 128 : message[1062],
      mix2Input2Pan: message[1063] > 64 ? message[1063] - 128 : message[1063],
      mix2Input3Pan: message[1064] > 64 ? message[1064] - 128 : message[1064],
      mix2Input4Pan: message[1065] > 64 ? message[1065] - 128 : message[1065],
      mix2Input5Pan: message[1066] > 64 ? message[1066] - 128 : message[1066],
      mix1DawSolo: message[1067],
      mix2DawSolo: message[1068],
      // 1069 empty
      mix1DawMute: message[1070],
      mix2DawMute: message[1071],
      mix1DawVolume: message[1072],
      mix2DawVolume: message[1073],
      mix1DawPan: message[1074] > 64 ? message[1074] - 128 : message[1074],
      mix2DawPan: message[1075] > 64 ? message[1075] - 128 : message[1075],
      mix1MainMute: message[3489],
      mix2MainMute: message[3490],
      mix1MainVolume: message[3491],
      mix2MainVolume: message[3492],
      mix1MainPan: message[3494] > 64 ? message[3494] - 128 : message[3494],
      mix2MainPan: message[3495] > 64 ? message[3495] - 128 : message[3495],
      phones2Output: message[3496],
      loopback: message[3499],
      phantomPower0: message[3504],
      phantomPower1: message[3505],
      input45Level: message[3507],
    };

    return {
      "type": "init",
      values,
    };
  }

  return { "type": "unknown", raw: message };
};


export const sendInitMessages = (midiOutput) => {
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

  initMessages.forEach((m) => midiOutput.send(m));
};
