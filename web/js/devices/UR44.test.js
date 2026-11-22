import { describe, it, expect, beforeEach, afterEach } from "vitest";
import UR44, { interpolateMorph, getDBFSFromSliderValue } from "./UR44.js";
import UR44VirtualDevice from "./UR44VirtualDevice.js";
import DEFAULT_DUMP from "./UR44-default-dump.js";
import { encodeParamChange } from "./UR44-protocol.js";
import { loadFixture } from "../../../test-fixtures/loadFixture.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("UR44 controller with virtual device", () => {
  let device;
  let ur44;
  let events;

  beforeEach(async () => {
    device = new UR44VirtualDevice({ meters: false });
    ur44 = new UR44(device.portProvider);
    events = [];
    await ur44.open((e) => events.push(e));
  });

  afterEach(() => device.close());

  const lastSent = () => device.received.at(-1);

  it("embeds the captured device state as simulator default", () => {
    const fixture = loadFixture("ur44-dump-all.hex");
    expect(DEFAULT_DUMP.trim().split(/\s+/).map((h) => parseInt(h, 16)))
      .toEqual(fixture);
  });

  it("reads all parameters from the state dump", () => {
    const s = ur44.settings;
    expect(s.Mix0Input0Volume).toBe(103);
    expect(s.Mix0Input2Volume).toBe(84);
    expect(s.Mix0Input4Pan).toBe(-16);
    expect(s.Mix0Input5Pan).toBe(16);
    expect(s.Mix0DAWVolume).toBe(87);
    expect(s.Input45Level).toBe(1);
    expect(s.InputHPFSetting).toBe(2);
    expect(s.PhantomPower01).toBe(0);
    expect(s.SampleRate).toBe(0);
    expect(s.ReverbTime).toBe(41);
    expect(s.AmpType).toBe(0);
    expect(ur44.sampleRate).toBe(44100);
    expect(ur44.fxAvailable).toBe(true);
  });

  it("queries the params which are not part of the dump", () => {
    expect(ur44.settings.DAWReverbSend).toBe(0);
    expect(device.received.some((m) => m[2] === 0x30 && m[9] === 26))
      .toBe(true);
  });

  it("reads channel strip settings per strip", () => {
    expect(ur44.channelStripSettings).toHaveLength(4);
    const strip = ur44.channelStripSettings[0];
    expect(strip.ChannelStripCompAttack).toBe(184);
    expect(strip.ChannelStripCompRelease).toBe(159);
    expect(strip.ChannelStripEQHighFreq).toBe(112);
    expect(strip.ChannelStripMorphing).toBe(0);
    expect(strip.ChannelStripStereoLink).toBe(0);
  });

  it("reads sweet spot data", () => {
    expect(ur44.sweetSpots[0]).toEqual({ id: "0001", name: "01 Basic" });
    const data = ur44.getSweetSpotData(0);
    expect(data.points).toHaveLength(9);
    expect(data.points.map((p) => p[0])).toEqual(
      [184, 165, 147, 181, 215, 200, 185, 135, 95],
    );
  });

  it("sends parameter changes", () => {
    ur44.updateParamValue("Mix1Input3Pan", -5);
    expect(lastSent()).toEqual(encodeParamChange(16, 3, -5));
    expect(device.get(16, 3)).toBe(-5);
    expect(ur44.settings.Mix1Input3Pan).toBe(-5);
  });

  it("sets multi-channel params on all channels", () => {
    ur44.updateParamValue("InputHPFSetting", 4);
    for (let ch = 0; ch < 6; ch++) expect(device.get(4, ch)).toBe(4);
  });

  it("rejects read-only and unknown params", () => {
    expect(() => ur44.updateParamValue("PhantomPower01", 1)).toThrow();
    expect(() => ur44.updateParamValue("SampleRate", 1)).toThrow();
    expect(() => ur44.updateParamValue("Nope", 1)).toThrow();
    expect(() => ur44.updateParamValue("ChannelStripCompAttack", 100))
      .toThrow(/stack index/);
  });

  it("controls the DAW reverb send", () => {
    ur44.updateParamValue("DAWReverbSendEnabled", 1);
    ur44.updateParamValue("DAWReverbSend", 103);
    expect(device.get(25)).toBe(1);
    expect(device.get(26)).toBe(103);
  });

  it("handles parameter changes sent by the device", async () => {
    device.setPhantomPower(1, 1);
    await wait(0);
    expect(ur44.settings.PhantomPower23).toBe(1);
    expect(events).toContainEqual({
      type: "change-parameter", paramName: "PhantomPower23", newValue: 1,
    });
  });

  describe("linked channels", () => {
    beforeEach(async () => {
      await ur44.updateParamValue("Input0Link", 1);
    });

    it("links both channels and copies the left channel's values", () => {
      expect(device.get(0, 0)).toBe(1);
      expect(device.get(0, 1)).toBe(1);
      expect(ur44.isLinked(0)).toBe(true);
      expect(ur44.isLinked(1)).toBe(true);
      expect(ur44.isLinked(2)).toBe(false);
    });

    it("mirrors level, mute, solo, HPF and send", () => {
      ur44.updateParamValue("Mix0Input0Volume", 50);
      ur44.updateParamValue("Mix0Input0Mute", 0);
      ur44.updateParamValue("Mix0Input0Solo", 1);
      ur44.updateParamValue("Input0HPFEnabled", 1);
      ur44.updateParamValue("Input1ReverbSend", 60);
      const s = ur44.settings;
      expect(s.Mix0Input1Volume).toBe(50);
      expect(s.Mix0Input1Mute).toBe(0);
      expect(s.Mix0Input1Solo).toBe(1);
      expect(s.Input1HPFEnabled).toBe(1);
      expect(s.Input0ReverbSend).toBe(60);
      // and so does the device
      expect(device.get(12, 1)).toBe(50);
      expect(device.get(9, 1)).toBe(0);
      expect(device.get(7, 1)).toBe(1);
      expect(device.get(3, 1)).toBe(1);
      expect(device.get(14, 0)).toBe(60);
      expect(device.get(39)).toBe(1);
    });

    it("keeps phase and pan independent", () => {
      ur44.updateParamValue("Input0InvertPhase", 1);
      ur44.updateParamValue("Mix0Input1Pan", 7);
      expect(ur44.settings.Input1InvertPhase).toBe(0);
      expect(ur44.settings.Mix0Input0Pan).toBe(0);
    });

    it("creates a stereo channel strip", async () => {
      await ur44.setFX(1, "channel-strip", "insert");
      expect(ur44.fxState[0]).toEqual({
        type: "channel-strip", mode: "insert", stackIndex: 0, stereo: true,
      });
      expect(ur44.fxState[1]).toEqual({
        type: "channel-strip", mode: "insert", stackIndex: 1, stereo: true,
      });
      expect(ur44.channelStripSettings[1].ChannelStripStereoLink).toBe(1);
    });

    it("mirrors stereo strip settings", async () => {
      await ur44.setFX(0, "channel-strip", "insert");
      ur44.updateParamValue("ChannelStripCompAttack", 200, 0);
      expect(ur44.channelStripSettings[1].ChannelStripCompAttack).toBe(200);
      expect(device.get(45, 1)).toBe(200);
    });

    it("doesn't allow the guitar amp", () => {
      expect(ur44.canSetFx("amp", 0)).toBe(false);
      expect(ur44.canSetFx("amp", 2)).toBe(true);
    });

    it("turns an existing channel strip into a stereo strip", async () => {
      await ur44.updateParamValue("Input0Link", 0);
      await ur44.setFX(0, "channel-strip", "monitor");
      expect(ur44.fxState[0].stereo).toBe(false);
      await ur44.updateParamValue("Input0Link", 1);
      expect(ur44.fxState[0]).toMatchObject({ stereo: true, mode: "monitor" });
      expect(ur44.fxState[1]).toMatchObject({ stereo: true, mode: "monitor" });
    });
  });

  describe("effects", () => {
    it("allocates new strips in front and shifts existing ones", async () => {
      await ur44.setFX(0, "channel-strip", "insert");
      ur44.updateParamValue("ChannelStripCompAttack", 60, 0);
      await ur44.setFX(1, "channel-strip", "insert");
      expect(ur44.fxState[1].stackIndex).toBe(0);
      expect(ur44.fxState[0].stackIndex).toBe(1);
      // settings move with the strip
      expect(ur44.channelStripSettings[1].ChannelStripCompAttack).toBe(60);
      await ur44.setFX(1, "off");
      expect(ur44.fxState[0].stackIndex).toBe(0);
      expect(ur44.fxState[1]).toEqual({ type: "off" });
    });

    it("switches between insert and monitor", async () => {
      await ur44.setFX(2, "channel-strip", "insert");
      await ur44.setFX(2, "channel-strip", "monitor");
      expect(ur44.fxState[2]).toMatchObject({ mode: "monitor" });
      expect(device.get(6, 2)).toBe(1);
      expect(device.get(5, 2)).toBe(0);
    });

    it("inserts a guitar amp with type", async () => {
      await ur44.setFX(4, "amp", "monitor", 3);
      expect(ur44.fxState[4]).toEqual({ type: "amp", mode: "monitor" });
      expect(ur44.settings.AmpType).toBe(3);
    });

    it("enforces the resource limits", async () => {
      await ur44.setFX(0, "channel-strip");
      await ur44.setFX(1, "channel-strip");
      await ur44.setFX(2, "channel-strip");
      expect(ur44.canSetFx("amp", 4)).toBe(false);
      await ur44.setFX(3, "channel-strip");
      expect(ur44.canSetFx("channel-strip", 4)).toBe(false);
      await expect(ur44.setFX(4, "channel-strip")).rejects.toThrow();
    });
  });

  describe("sample rate", () => {
    it("removes effects and disables them at 176.4/192 kHz", async () => {
      await ur44.setFX(0, "channel-strip");
      device.setSampleRateCode(5);
      await wait(10);
      expect(ur44.sampleRate).toBe(192000);
      expect(ur44.fxAvailable).toBe(false);
      expect(ur44.fxState[0]).toEqual({ type: "off" });
      expect(ur44.canSetFx("channel-strip", 0)).toBe(false);
      expect(events.some((e) => e.type === "state-refresh")).toBe(true);

      device.setSampleRateCode(1);
      await wait(10);
      expect(ur44.sampleRate).toBe(48000);
      expect(ur44.canSetFx("channel-strip", 0)).toBe(true);
    });
  });

  describe("sweet spot morphing", () => {
    beforeEach(async () => {
      await ur44.setFX(0, "channel-strip");
    });

    it("interpolates like the device", () => {
      const points = [184, 165, 147, 181, 215, 200, 185, 135, 95];
      expect(interpolateMorph(points, 0)).toBe(184);
      expect(interpolateMorph(points, 120)).toBe(95);
      expect(interpolateMorph(points, 200)).toBe(95);
      // values measured on the device for morph 100
      expect(interpolateMorph(points, 100)).toBe(151);
    });

    it("updates the strip settings when morphing", async () => {
      ur44.updateParamValue("ChannelStripMorphing", 100, 0);
      // optimistic local update before the device state is read back
      expect(ur44.channelStripSettings[0].ChannelStripCompAttack).toBe(151);
      await wait(300);
      expect(ur44.channelStripSettings[0].ChannelStripCompAttack).toBe(151);
      expect(ur44.channelStripSettings[0].ChannelStripCompRelease).toBe(104);
      expect(device.get(45, 0)).toBe(151);
    });

    it("loads sweet spot data and re-applies the morph value", async () => {
      ur44.updateParamValue("ChannelStripMorphing", 30, 0);
      await wait(300);
      // the factory table with a different attack value per point
      const points = ur44.getSweetSpotData(0).points.map((point, p) => {
        return [100 + p, ...point.slice(1)];
      });
      await ur44.loadSweetSpotData(0, { id: "0042", name: "Test", points });
      expect(ur44.sweetSpots[0]).toEqual({ id: "0042", name: "Test" });
      expect(ur44.getSweetSpotData(0).points).toEqual(points);
      // morph 30 = point 2 -> attack 102
      expect(ur44.channelStripSettings[0].ChannelStripCompAttack).toBe(102);
      // other strips are untouched
      expect(ur44.sweetSpots[1]).toEqual({ id: "0001", name: "01 Basic" });
      // sent as morphing table bulk dump
      expect(device.received.some((m) => m[0] === 0xF0 && m[2] === 0x00
        && m[13] === 0x02)).toBe(true);
      // the morph value is re-sent with the re-apply flag
      expect(device.received.some((m) => m.length === 19 && m[6] === 0x03
        && m[9] === 54)).toBe(true);
    });

    it("rejects out of range sweet spot values", async () => {
      const points = Array.from({ length: 9 }, () => new Array(17).fill(100));
      points[3][3] = 3; // knee 0..2
      await expect(ur44.loadSweetSpotData(0, { id: "1", name: "x", points }))
        .rejects.toThrow(/knee/);
    });

    it("stores names as ASCII", async () => {
      const { points } = ur44.getSweetSpotData(0);
      await ur44.loadSweetSpotData(0, { id: "0001", name: "Über ½", points });
      expect(ur44.sweetSpots[0].name).toBe("Uber _");
    });

    it("validates sweet spot data", async () => {
      await expect(ur44.loadSweetSpotData(0, {
        id: "1", name: "x", points: [[1, 2]],
      })).rejects.toThrow();
    });
  });

  describe("consistency", () => {
    it("keeps changes made while a refresh is in flight", async () => {
      const refresh = ur44.refresh();
      // sent after the dump request, so not contained in the dump
      ur44.updateParamValue("Mix0Input2Volume", 10);
      ur44.updateParamValue("Input0InvertPhase", 1);
      await refresh;
      expect(ur44.settings.Mix0Input2Volume).toBe(10);
      expect(ur44.settings.Input0InvertPhase).toBe(1);
      await ur44.refresh();
      expect(ur44.settings.Mix0Input2Volume).toBe(10);
    });

    it("runs effect changes one after another", async () => {
      await ur44.setFX(0, "channel-strip");
      await ur44.setFX(1, "channel-strip");
      await ur44.setFX(2, "channel-strip");
      // both pass the resource check against the current state, but only
      // one of them can be applied
      const results = await Promise.allSettled([
        ur44.setFX(3, "channel-strip"),
        ur44.setFX(4, "channel-strip"),
      ]);
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
      expect(ur44.fxState[3].type).toBe("channel-strip");
      expect(ur44.fxState[4].type).toBe("off");
    });

    it("rejects when the device ignores an insert", async () => {
      await ur44.updateParamValue("Input0Link", 1);
      // bypass the controller's own check to see the device ignoring it
      ur44.canSetFx = () => true;
      await expect(ur44.setFX(0, "amp")).rejects.toThrow(/did not apply/);
      expect(ur44.fxState[0].type).toBe("off");
    });

    it("reports local changes", async () => {
      events.length = 0;
      ur44.updateParamValue("Mix0DAWVolume", 3);
      await ur44.setFX(0, "channel-strip");
      expect(events.filter((e) => e.type === "local-change").length)
        .toBeGreaterThanOrEqual(2);
    });
  });

  describe("scenes", () => {
    it("captures and recalls the current scene", async () => {
      await ur44.setFX(2, "channel-strip", "monitor");
      ur44.updateParamValue("Mix0DAWVolume", 60);
      ur44.updateParamValue("DAWReverbSend", 90);
      const scene = await ur44.captureScene();
      expect(scene.dump.slice(0, 4)).toEqual([0xF0, 0x43, 0x00, 0x3E]);
      expect(scene.extras[26]).toBe(90);

      ur44.updateParamValue("Mix0DAWVolume", 10);
      ur44.updateParamValue("DAWReverbSend", 0);
      await ur44.setFX(2, "off");
      await ur44.setFX(4, "amp", "insert");

      await ur44.recallScene(scene);
      expect(ur44.settings.Mix0DAWVolume).toBe(60);
      expect(device.get(26)).toBe(90);
      ur44.settings.DAWReverbSend = -1;
      await ur44.refreshQueriedParams();
      expect(ur44.settings.DAWReverbSend).toBe(90);
      expect(ur44.fxState[2]).toMatchObject({
        type: "channel-strip", mode: "monitor",
      });
      expect(ur44.fxState[4]).toEqual({ type: "off" });
      // the state is stored in the device memory afterwards
      const store = device.received.findLastIndex((m) => m[2] === 0x30
        && m[5] === 0x03 && m[6] === 0x02 && m[7] === 0x01);
      const bulk = device.received.findLastIndex((m) => m[2] === 0x00);
      expect(store).toBeGreaterThan(bulk);
    });

    it("doesn't change system settings when recalling", async () => {
      const scene = await ur44.captureScene();
      ur44.updateParamValue("Loopback", 1);
      await ur44.recallScene(scene);
      // loopback isn't part of a scene in dspMixFx either
      expect(ur44.settings.Loopback).toBe(1);
    });
  });

  it("converts slider values to dB", () => {
    expect(getDBFSFromSliderValue(0)).toBe(-Infinity);
    expect(getDBFSFromSliderValue(1)).toBe(-74);
    expect(getDBFSFromSliderValue(103)).toBe(0);
    expect(getDBFSFromSliderValue(127)).toBe(6);
  });
});

describe("UR44 controller timeouts", () => {
  it("rejects when the device doesn't answer", async () => {
    const ur44 = new UR44(async () => ({
      input: {},
      output: { send: () => {} },
      name: "dead",
    }));
    await expect(ur44.open()).rejects.toThrow(/Timeout/);
  }, 10000);
});
