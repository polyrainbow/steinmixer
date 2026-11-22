import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SceneLibrary,
  SLOT_COUNT,
  MAX_NAME_LENGTH,
  STORAGE_KEY,
  normalizeName,
  exportUR44File,
  importUR44File,
  bytesToBase64,
  escapeXml,
  unescapeXml,
} from "./scenes.js";
import { rawDumpToPayload, parseBulkDump } from "./devices/UR44-protocol.js";

const loadFixture = (name) => {
  const url = new URL(`../../test-fixtures/${name}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8")
    .trim()
    .split(/\s+/)
    .map((h) => parseInt(h, 16));
};

const FIXTURE = loadFixture("ur44-dump-current-scene.hex");
const PAYLOAD_B64 = bytesToBase64(rawDumpToPayload(FIXTURE));

const makeScene = (extras = { 1234: 5 }) => ({ dump: [...FIXTURE], extras });

class FakeStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }
}

const brokenStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
};

describe("SceneLibrary", () => {
  let storage;
  let library;

  beforeEach(() => {
    storage = new FakeStorage();
    library = new SceneLibrary({ storage });
  });

  it("starts with 20 empty slots", () => {
    const list = library.list();
    expect(list).toHaveLength(SLOT_COUNT);
    expect(list[0]).toEqual({ slot: 1, name: null, empty: true });
    expect(list[19]).toEqual({ slot: 20, name: null, empty: true });
    expect(library.get(1)).toBeNull();
    expect(library.current)
      .toEqual({ slot: null, name: null, modified: false });
  });

  it("stores and returns scenes", () => {
    library.store(3, "Live set", makeScene());
    expect(library.list()[2])
      .toEqual({ slot: 3, name: "Live set", empty: false });
    const entry = library.get(3);
    expect(entry.slot).toBe(3);
    expect(entry.name).toBe("Live set");
    expect(entry.scene.dump).toEqual(FIXTURE);
    expect(entry.scene.extras).toEqual({ 1234: 5 });
  });

  it("returns copies that can't modify the library", () => {
    library.store(1, "A", makeScene());
    const entry = library.get(1);
    entry.scene.dump[20] = 0;
    entry.scene.extras.x = 1;
    expect(library.get(1).scene.dump).toEqual(FIXTURE);
    expect(library.get(1).scene.extras).toEqual({ 1234: 5 });
  });

  it("persists scenes and current state compactly", () => {
    library.store(1, "First", makeScene());
    library.store(20, "Last", makeScene({}));
    library.setCurrent(20, "Last");
    library.markModified();

    const stored = storage.getItem(STORAGE_KEY);
    expect(stored).toContain(PAYLOAD_B64);
    // base64 payload is much smaller than a JSON array of the bytes
    expect(stored.length).toBeLessThan(JSON.stringify(FIXTURE).length * 1.5);

    const reloaded = new SceneLibrary({ storage });
    expect(reloaded.list().filter((s) => !s.empty).map((s) => s.name))
      .toEqual(["First", "Last"]);
    expect(reloaded.get(1).scene).toEqual(makeScene());
    expect(reloaded.get(20).scene).toEqual(makeScene({}));
    expect(reloaded.current)
      .toEqual({ slot: 20, name: "Last", modified: true });
    expect(reloaded.persistent).toBe(true);
  });

  it("ignores corrupt storage content", () => {
    storage.setItem(STORAGE_KEY, "{not json");
    const lib = new SceneLibrary({ storage });
    expect(lib.list().every((s) => s.empty)).toBe(true);

    storage.setItem(STORAGE_KEY, JSON.stringify({
      slots: { 2: { name: "ok", payload: PAYLOAD_B64 }, 99: { name: "x" } },
      current: { slot: 7, name: "gone", modified: "yes" },
    }));
    const lib2 = new SceneLibrary({ storage });
    expect(lib2.list().filter((s) => !s.empty).map((s) => s.slot))
      .toEqual([2]);
    expect(lib2.get(2).scene.dump).toEqual(FIXTURE);
    expect(lib2.current).toEqual({ slot: null, name: "gone", modified: false });
  });

  it("works in memory when storage is unavailable", () => {
    const lib = new SceneLibrary({ storage: brokenStorage });
    expect(lib.persistent).toBe(false);
    lib.store(5, "Mem", makeScene());
    expect(lib.get(5).scene.dump).toEqual(FIXTURE);
    lib.setCurrent(5);
    expect(lib.current.name).toBe("Mem");
    expect(lib.persistent).toBe(false);
  });

  it("works without storage", () => {
    const lib = new SceneLibrary({ storage: null });
    expect(lib.persistent).toBe(false);
    lib.store(1, "Mem", makeScene());
    expect(lib.get(1).name).toBe("Mem");
  });

  it("reports when saving starts failing", () => {
    const flaky = new FakeStorage();
    const lib = new SceneLibrary({ storage: flaky });
    flaky.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    lib.store(1, "A", makeScene());
    expect(lib.persistent).toBe(false);
    expect(lib.get(1).name).toBe("A");
  });

  it("validates slots", () => {
    for (const slot of [0, 21, -1, 1.5, "3", null, undefined, NaN]) {
      expect(() => library.store(slot, "x", makeScene())).toThrow(RangeError);
      expect(() => library.get(slot)).toThrow(RangeError);
      expect(() => library.clear(slot)).toThrow(RangeError);
      expect(() => library.rename(slot, "x")).toThrow(RangeError);
    }
    expect(() => library.setCurrent(21, "x")).toThrow(RangeError);
    library.store(1, "x", makeScene());
    library.store(20, "x", makeScene());
  });

  it("validates names", () => {
    expect(normalizeName("  Piano  ")).toBe("Piano");
    expect(normalizeName("a\u0007b\nc")).toBe("abc");
    expect(normalizeName("x".repeat(40))).toHaveLength(MAX_NAME_LENGTH);
    expect(() => normalizeName("   ")).toThrow();
    expect(() => normalizeName(42)).toThrow(TypeError);
    expect(library.store(2, "  Band  ", makeScene())).toBe("Band");
    expect(library.get(2).name).toBe("Band");
    expect(() => library.store(2, "", makeScene())).toThrow();
  });

  it("rejects invalid scenes", () => {
    expect(() => library.store(1, "x", null)).toThrow();
    expect(() => library.store(1, "x", { dump: [1, 2, 3] })).toThrow();
    expect(() => library.store(1, "x", { dump: [...FIXTURE, 300] }))
      .toThrow();
    const truncated = [...FIXTURE.slice(0, 2000), 0xF7];
    expect(() => library.store(1, "x", { dump: truncated })).toThrow();
    expect(library.isEmpty(1)).toBe(true);
  });

  it("accepts Uint8Array dumps and missing extras", () => {
    library.store(1, "x", { dump: Uint8Array.from(FIXTURE) });
    expect(library.get(1).scene).toEqual({ dump: FIXTURE, extras: {} });
  });

  it("renames, clears and initializes", () => {
    library.store(1, "One", makeScene());
    library.store(2, "Two", makeScene());
    library.rename(1, " Uno ");
    expect(library.get(1).name).toBe("Uno");
    expect(() => library.rename(3, "x")).toThrow(/empty/);
    expect(() => library.rename(1, " ")).toThrow();

    library.clear(2);
    expect(library.get(2)).toBeNull();
    expect(library.isEmpty(2)).toBe(true);
    library.clear(2); // clearing an empty slot is fine

    library.store(4, "Four", makeScene());
    library.initializeAll();
    expect(library.list().every((s) => s.empty)).toBe(true);
    expect(new SceneLibrary({ storage }).list().every((s) => s.empty))
      .toBe(true);
  });

  it("replaces all scenes atomically", () => {
    library.store(1, "Old", makeScene());
    library.replaceAll([
      { slot: 2, name: "New", scene: makeScene() },
      { slot: 3, name: "Newer", scene: makeScene({}) },
    ]);
    expect(library.list().filter((s) => !s.empty).map((s) => s.name))
      .toEqual(["New", "Newer"]);
    expect(() => library.replaceAll([
      { slot: 5, name: "ok", scene: makeScene() },
      { slot: 6, name: "bad", scene: { dump: [] } },
    ])).toThrow();
    expect(library.get(2).name).toBe("New");
    expect(library.isEmpty(5)).toBe(true);
  });

  it("tracks the current scene and modifications", () => {
    library.store(7, "Seven", makeScene());
    // storing doesn't change the current scene by itself
    expect(library.current.slot).toBeNull();

    library.setCurrent(7);
    expect(library.current)
      .toEqual({ slot: 7, name: "Seven", modified: false });
    library.markModified();
    library.markModified();
    expect(library.current.modified).toBe(true);
    library.setCurrent(7, "Seven");
    expect(library.current.modified).toBe(false);

    library.rename(7, "Siete");
    expect(library.current.name).toBe("Siete");

    library.markModified();
    library.clear(7);
    expect(library.current)
      .toEqual({ slot: null, name: "Siete", modified: true });

    library.setCurrent(null, null);
    expect(library.current)
      .toEqual({ slot: null, name: null, modified: false });
  });

  it("returns a copy of the current state", () => {
    const current = library.current;
    current.modified = true;
    expect(library.current.modified).toBe(false);
  });

  it("dispatches change events", () => {
    let count = 0;
    library.addEventListener("change", () => count++);
    library.store(1, "a", makeScene());
    library.rename(1, "b");
    library.setCurrent(1);
    library.markModified();
    library.markModified(); // no change
    library.clear(1);
    library.initializeAll();
    expect(count).toBe(6);
  });
});

describe("XML escaping", () => {
  it("round-trips special characters", () => {
    const text = "Tom & \"Jerry\" <'1'>";
    expect(escapeXml(text)).toBe(
      "Tom &amp; &quot;Jerry&quot; &lt;&apos;1&apos;&gt;",
    );
    expect(unescapeXml(escapeXml(text))).toBe(text);
    expect(unescapeXml("&#65;&#x42;&#X43;&unknown;&#0;")).toBe(
      "ABC&unknown;&#0;",
    );
  });
});

describe("UR44 scene files", () => {
  const sceneXml = (attrs, content) => `<Scene ${attrs}>${content}</Scene>`;
  const file = (scenes, rest = "") => `<!DOCTYPE UR44>
<UR44File><Header>UR44 File</Header><Version>1.0.0</Version>
<SceneData>${scenes.join("\n")}</SceneData>${rest}</UR44File>`;

  it("exports in the dspMixFx structure", () => {
    const library = new SceneLibrary({ storage: null });
    library.store(2, "Mix A", makeScene({}));
    const text = exportUR44File(library);
    const payloadLength = rawDumpToPayload(FIXTURE).length;
    expect(text.startsWith("<!DOCTYPE UR44>\n<UR44File>")).toBe(true);
    expect(text).toContain("<Header>UR44 File</Header>");
    expect(text).toContain("<Version>1.0.0</Version>");
    expect(text).toContain(
      `<Scene No="2" name="Mix A" sz="${payloadLength}" cvtSz="${payloadLength}">${PAYLOAD_B64}</Scene>`,
    );
    // empty slots and the unknown current scene are not written
    expect(text.match(/<Scene /g)).toHaveLength(1);
    expect(text).not.toContain("<CurrentScene");
    expect(text).not.toContain("SteinmixerExtras");
  });

  it("round-trips through export and import", () => {
    const library = new SceneLibrary({ storage: null });
    const nasty = "A&B <\"x\"> 'y'";
    library.store(1, nasty, makeScene({ 1234: 5, 77: -3 }));
    library.store(12, "Twelve", makeScene({}));
    library.store(20, "Last", makeScene({ 9: 0 }));

    const text = exportUR44File(library);
    expect(text).toContain("A&amp;B &lt;&quot;x&quot;&gt; &apos;y&apos;");

    const { scenes, errors, current } = importUR44File(text);
    expect(errors).toEqual([]);
    expect(current).toBeNull();
    expect(scenes.map((s) => [s.slot, s.name])).toEqual([
      [1, nasty], [12, "Twelve"], [20, "Last"],
    ]);
    for (const s of scenes) {
      expect(s.scene.dump).toEqual(FIXTURE);
    }
    expect(scenes[0].scene.extras).toEqual({ 1234: 5, 77: -3 });
    expect(scenes[1].scene.extras).toEqual({});
    expect(scenes[2].scene.extras).toEqual({ 9: 0 });
    expect(parseBulkDump(scenes[0].scene.dump).name).toBe("CurrentScene");

    // and back into a library
    const other = new SceneLibrary({ storage: null });
    other.replaceAll(scenes);
    expect(other.get(1).scene).toEqual(library.get(1).scene);
  });

  it("writes and reads the current scene", () => {
    const library = new SceneLibrary({ storage: null });
    library.store(4, "Four", makeScene());
    library.setCurrent(4);

    const withStored = importUR44File(exportUR44File(library));
    expect(withStored.current).toEqual({
      slot: 4, name: "Four", scene: makeScene(),
    });

    library.markModified();
    expect(exportUR44File(library)).not.toContain("<CurrentScene");

    const text = exportUR44File(library, {
      current: { dump: FIXTURE, extras: { 3: 1 } },
    });
    expect(text).toContain("<CurrentData ");
    const { current, scenes } = importUR44File(text);
    expect(scenes).toHaveLength(1);
    expect(current.scene).toEqual({ dump: FIXTURE, extras: { 3: 1 } });
  });

  it("tolerates whitespace, unknown attributes and child elements", () => {
    const wrapped = PAYLOAD_B64.match(/.{1,76}/g).join("\r\n      ");
    const text = `\uFEFF<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE UR44>
<!-- saved by dspMixFx -->
<UR44File>
  <Header>UR44 File</Header>
  <Version>1.0.0</Version>
  <SceneData Count="20">
    <Scene
      No = '3'
      name="Tom &amp; Jerry &#38; &#x263A;"
      sz="3024" cvtSz="9999" IO="1" ChStripPatch="0" ExtFX="2">
      ${wrapped}
      <MuteStatus ChSz="6" OutChSz="4">AAAAAAAA</MuteStatus>
      <FxInsPosStatus ChSz="6">AAAA</FxInsPosStatus>
      <ChFxTypeStatus ChSz="6"/>
    </Scene>
    <Scene No="4" name="cdata"><![CDATA[${PAYLOAD_B64}]]></Scene>
    <Scene No="5" name="---"></Scene>
    <Scene No="6" name="---"/>
  </SceneData>
  <SomethingElse><Scene No="7">ignored</Scene></SomethingElse>
</UR44File>
`;
    const { scenes, errors } = importUR44File(text);
    expect(errors).toEqual([]);
    expect(scenes.map((s) => [s.slot, s.name])).toEqual([
      [3, "Tom & Jerry & ☺"],
      [4, "cdata"],
    ]);
    expect(scenes[0].scene).toEqual({ dump: FIXTURE, extras: {} });
    expect(scenes[1].scene.dump).toEqual(FIXTURE);
  });

  it("skips and reports invalid scenes among valid ones", () => {
    const garbage = btoa("this is not a scene dump at all, just text");
    const truncated = PAYLOAD_B64.slice(0, 2000);
    const text = file([
      sceneXml("No=\"1\" name=\"good\"", PAYLOAD_B64),
      sceneXml("No=\"2\" name=\"bad b64\"", "@@@notbase64@@@"),
      sceneXml("No=\"3\" name=\"garbage\"", garbage),
      sceneXml("No=\"4\" name=\"truncated\"", truncated),
      sceneXml("No=\"21\" name=\"range\"", PAYLOAD_B64),
      sceneXml("name=\"no number\"", PAYLOAD_B64),
      sceneXml("No=\"1\" name=\"dup\"", PAYLOAD_B64),
      sceneXml("No=\"8\" name=\"empty but named\"", ""),
      sceneXml(
        "No=\"9\" name=\"bad extras\" SteinmixerExtras=\"{nope\"",
        PAYLOAD_B64,
      ),
      sceneXml("No=\"10\" name=\"   \"", PAYLOAD_B64),
    ]);
    const { scenes, errors } = importUR44File(text);
    expect(scenes.map((s) => [s.slot, s.name])).toEqual([
      [1, "good"], [9, "bad extras"], [10, "Scene 10"],
    ]);
    expect(scenes[1].scene.extras).toEqual({});
    expect(errors.map((e) => e.name)).toEqual([
      "bad b64", "garbage", "truncated", "range", "no number", "dup",
      "empty but named",
    ]);
    expect(errors[0].slot).toBe(2);
    expect(errors[3].slot).toBeNull();
    for (const e of errors) expect(typeof e.message).toBe("string");
  });

  it("reads extras from a child element, too", () => {
    const text = file([sceneXml(
      "No=\"1\" name=\"x\"",
      `${PAYLOAD_B64}<SteinmixerExtras>{"5":1,"6":"str"}</SteinmixerExtras>`,
    )]);
    const { scenes } = importUR44File(text);
    expect(scenes[0].scene).toEqual({ dump: FIXTURE, extras: { 5: 1 } });
  });

  it("handles a truncated file", () => {
    const full = file([
      sceneXml("No=\"1\" name=\"a\"", PAYLOAD_B64),
      sceneXml("No=\"2\" name=\"b\"", PAYLOAD_B64),
    ]);
    const cut = full.slice(0, full.lastIndexOf("</Scene>") - 100);
    const { scenes, errors } = importUR44File(cut);
    expect(scenes.map((s) => s.slot)).toEqual([1]);
    expect(errors).toHaveLength(1);
    expect(errors[0].slot).toBe(2);
  });

  it("rejects files that aren't UR44 files without throwing", () => {
    for (const text of ["", "hello", "<xml/>", null, undefined]) {
      const result = importUR44File(text);
      expect(result.scenes).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.current).toBeNull();
    }
  });

  it("reports an invalid current scene", () => {
    const text = file(
      [sceneXml("No=\"1\" name=\"a\"", PAYLOAD_B64)],
      "<CurrentScene><CurrentData>AAAA</CurrentData></CurrentScene>",
    );
    const { scenes, errors, current } = importUR44File(text);
    expect(scenes).toHaveLength(1);
    expect(current).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].name).toBe("CurrentScene");
  });
});
