/*
  Hardware-in-the-loop test: runs the UR44 controller against a real UR44
  (macOS only, needs the Xcode command line tools for swiftc).

    npm run test:hardware

  Optional: set TONE_DEVICE to the name of another audio interface whose
  outputs 1/2 are connected to UR44 inputs 5/6 to also test the channel strip
  meters with a real signal, e.g. TONE_DEVICE=UR22 npm run test:hardware

  The device state is captured before and recalled afterwards. Inputs 5/6 are
  linked during the test and the master is muted.
*/
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import UR44, { interpolateMorph } from "../web/js/devices/UR44.js";

const HERE = new URL(".", import.meta.url).pathname;
const TOOLS = HERE + ".build/";
const TONE_DEVICE = process.env.TONE_DEVICE;

mkdirSync(TOOLS, { recursive: true });
for (const tool of ["midibridge", "audiotool"]) {
  if (!existsSync(TOOLS + tool)) {
    execFileSync("swiftc", ["-O", HERE + tool + ".swift", "-o", TOOLS + tool]);
  }
}

/* port provider talking to the device through the CoreMIDI bridge */
const bridge = spawn(TOOLS + "midibridge", [], {
  stdio: ["pipe", "pipe", "inherit"],
});
const input = { onmidimessage: null };
let rest = "";
bridge.stdout.on("data", (chunk) => {
  rest += chunk.toString();
  const lines = rest.split("\n");
  rest = lines.pop();
  for (const line of lines) {
    const data = Uint8Array.from(line.split(" ").map((h) => parseInt(h, 16)));
    input.onmidimessage?.({ data });
  }
});
const toHex = (m) => [...m].map((b) => b.toString(16).padStart(2, "0"));
const provider = async () => ({
  input,
  name: "UR44 (bridge)",
  output: { send: (m) => bridge.stdin.write(toHex(m).join(" ") + "\n") },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, condition, info = "") => {
  console.log(`${condition ? "PASS" : "FAIL"} ${name} ${info}`);
  if (!condition) failures++;
};
const json = (value) => JSON.stringify(value);
const tone = (secs) => spawn(TOOLS + "audiotool", ["tone", `${secs}`, "0,1"], {
  env: { ...process.env, DEV: TONE_DEVICE, NCH: "2", AMP: "0.7" },
});

const ur44 = new UR44(provider);
await ur44.open();
const strips = () => ur44.channelStripSettings;
check("open: sample rate", ur44.sampleRate > 0, ur44.sampleRate);
check(
  "open: DAW send queried",
  typeof ur44.settings.DAWReverbSend === "number",
);
const original = await ur44.captureScene();
const originalSweetSpot0 = ur44.sweetSpots[0];
check("capture scene", original.dump.length === 3456, original.dump.length);

try {
  if (!ur44.fxAvailable) {
    throw new Error("Set the UR44 to 96 kHz or lower to run the tests");
  }
  // start from a clean slate: no effects, master muted
  for (let ch = 0; ch < 6; ch++) await ur44.setFX(ch, "off");
  ur44.updateParamValue("Mix0MainMute", 0);
  ur44.updateParamValue("Mix1MainMute", 0);

  await ur44.updateParamValue("Input4Link", 1);
  check("link 5/6", ur44.isLinked(4) && ur44.isLinked(5));
  ur44.updateParamValue("Mix0Input4Volume", 77);
  await ur44.refresh();
  check(
    "linked volume mirrored on device",
    ur44.settings.Mix0Input5Volume === 77,
  );

  check("amp not allowed on linked", ur44.canSetFx("amp", 4) === false);
  await ur44.setFX(4, "channel-strip", "insert");
  const [left, right] = ur44.fxState.slice(4);
  check(
    "stereo strip",
    left.stereo && right.stereo
      && left.stackIndex === 0 && right.stackIndex === 1,
    json([left, right]),
  );

  await ur44.setFX(0, "channel-strip", "monitor");
  check(
    "mono strip after stereo",
    ur44.fxState[0].stackIndex === 2 && ur44.fxState[4].stackIndex === 0,
    json(ur44.fxState.map((f) => f.stackIndex)),
  );
  check("budget full for amp", ur44.canSetFx("amp", 2) === false);

  ur44.updateParamValue("ChannelStripCompDrive", 200, 0);
  ur44.updateParamValue("ChannelStripCompRatio", 120, 0);
  check(
    "stereo strip mirrored locally",
    strips()[1].ChannelStripCompDrive === 200,
  );
  if (TONE_DEVICE) {
    const player = tone(2.5);
    await wait(1500);
    const meters = [0, 1, 2].map((s) => ur44.getChannelStripMeters(s));
    await new Promise((r) => player.on("exit", r));
    check("GR strip 0 (L)", meters[0].gainReduction < -3, json(meters[0]));
    check("GR strip 1 (R)", meters[1].gainReduction < -3, json(meters[1]));
    check("GR idle strip 2", meters[2].gainReduction > -0.5, json(meters[2]));
  } else {
    console.log("SKIP meter tests with real signal (set TONE_DEVICE)");
  }
  await ur44.refresh();
  check(
    "stereo drive mirrored on device",
    strips()[1].ChannelStripCompDrive === 200,
  );

  // morphing is interpolated by the device
  const attackPoints = () => ur44.getSweetSpotData(2).points.map((p) => p[0]);
  ur44.updateParamValue("ChannelStripMorphing", 100, 2);
  await wait(400);
  check(
    "morph interpolated by device",
    strips()[2].ChannelStripCompAttack
      === interpolateMorph(attackPoints(), 100),
    strips()[2].ChannelStripCompAttack,
  );

  // sweet spot data
  const points = ur44.getSweetSpotData(2).points.reverse();
  await ur44.loadSweetSpotData(2, { id: "0099", name: "Reversed", points });
  check(
    "sweet spot name",
    ur44.sweetSpots[2].name === "Reversed" && ur44.sweetSpots[2].id === "0099",
    json(ur44.sweetSpots[2]),
  );
  check(
    "sweet spot table",
    json(ur44.getSweetSpotData(2).points) === json(points),
  );
  check(
    "sweet spot re-applied at morph 100",
    strips()[2].ChannelStripCompAttack
      === interpolateMorph(points.map((p) => p[0]), 100),
    strips()[2].ChannelStripCompAttack,
  );
  check(
    "other strip untouched",
    json(ur44.sweetSpots[0]) === json(originalSweetSpot0),
  );

  // DAW reverb send
  ur44.updateParamValue("DAWReverbSendEnabled", 1);
  ur44.updateParamValue("DAWReverbSend", 95);

  // scenes
  const scene = await ur44.captureScene();
  const dawVolume = ur44.settings.Mix0DAWVolume;
  ur44.updateParamValue("Mix0DAWVolume", dawVolume === 20 ? 21 : 20);
  ur44.updateParamValue("DAWReverbSend", 0);
  await ur44.setFX(0, "off");
  await ur44.recallScene(scene);
  check("scene: fader", ur44.settings.Mix0DAWVolume === dawVolume);
  ur44.settings.DAWReverbSend = -1;
  await ur44.refreshQueriedParams(); // read back from the device
  check("scene: DAW send", ur44.settings.DAWReverbSend === 95);
  check(
    "scene: FX",
    ur44.fxState[0].type === "channel-strip" && ur44.fxState[4].stereo,
    json(ur44.fxState),
  );
  check("scene: sweet spot", ur44.sweetSpots[2].name === "Reversed");
} catch (e) {
  failures++;
  console.log("ERROR", e);
} finally {
  await ur44.recallScene(original);
  const restored = await ur44.captureScene();
  check("original state restored", json(restored.dump) === json(original.dump));
  ur44.closeSession();
  await wait(300);
  bridge.kill();
  console.log(failures ? `${failures} FAILED` : "ALL PASSED");
  process.exitCode = failures ? 1 : 0;
}
