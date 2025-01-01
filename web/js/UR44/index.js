import {
  getChannelIndexFromChannelId,
  parseSysExMessage,
  sendInitMessages,
} from "./utils.js";
import { UR44Params } from "./params.js";

export const getMIDIDevices = async () => {
  const midi = await navigator.requestMIDIAccess({ sysex: true });

  let interfaceInput;

  for (const input of midi.inputs.values()) {
    if (input.name.includes("Steinberg UR44")) {
      interfaceInput = input;
    }
  }

  if (!interfaceInput) {
    throw new Error("Could not find MIDI input interface of audio interface");
  }

  let interfaceOutput;

  for (const output of midi.outputs.values()) {
    if (output.name.includes("Steinberg UR44")) {
      interfaceOutput = output;
    }
  }

  if (!interfaceOutput) {
    throw new Error("Could not find MIDI output interface of audio interface");
  }

  return [interfaceInput, interfaceOutput];
};

export const sendChangeParameterValue = (
  midiOutput,
  parameter,
  value,
  channelIndex = 0,
) => {
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
  midiOutput.send(message);
};


let midiInput;
let midiOutput;
let vuValues;

export const init = async (messageHandler) => {
  [midiInput, midiOutput] = await getMIDIDevices();
  console.log("Controller initialized");

  await midiInput.open();
  sendInitMessages(midiOutput);

  const { promise, resolve } = Promise.withResolvers();

  midiInput.onmidimessage = (message) => {
    const messageParsed = parseSysExMessage(message.data);
    if (messageParsed.type === "unknown") {
      console.log("Unknown message received", messageParsed.raw);
    } else if (messageParsed.type === "init") {
      resolve(messageParsed.values);
    } else if (messageParsed.type === "meter-update") {
      vuValues = messageParsed.values;
    } else {
      messageHandler?.(messageParsed);
    }
  };

  return promise;
};

export const getVuValues = (channelId) => {
  if (!vuValues) throw new Error(
    "Error getting vu values. No values received yet.",
  );
  return vuValues[channelId];
};


export const updateParamValue = (paramName, value, channelId) => {
  if (!midiOutput) {
    throw new Error("Controller not initialized!");
  }

  if (!UR44Params.has(paramName)) {
    throw new Error("Invalid param name: " + paramName);
  }

  const param = UR44Params.get(paramName);

  // Check if we need to provide an input channel
  const channelIndex = param[5] === true
    ? getChannelIndexFromChannelId(channelId)
    : "";
  console.log("updateParamValue", paramName, value, channelId, channelIndex);

  if (channelIndex < 0 || channelIndex > 5) {
    throw new Error("Invalid input index: " + channelIndex);
  }

  const paramNumber = param[0];
  sendChangeParameterValue(midiOutput, paramNumber, value, channelIndex);
};

export const selectActiveMix = (mix) => {
  if (!midiOutput) {
    throw new Error("Controller not initialized!");
  }

  const params = [0x23, 0x24];
  params.forEach((param) => {
    sendChangeParameterValue(midiOutput, param, mix);
  });
};
