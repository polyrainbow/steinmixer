/*
  Scenes, like dspMixFx implements them: the scenes live on the host, not in
  the device. A scene is a snapshot of the device state, i.e. a raw
  "CurrentScene" bulk dump (plus a few parameters that are not contained in
  the dump, called "extras"), stored with a name in one of 20 user slots.

  SceneLibrary keeps the 20 slots (persisted in localStorage when available)
  and tracks which scene is currently loaded and whether parameters were
  modified since it was recalled or stored.

  exportUR44File/importUR44File read and write dspMixFx's *.UR44 scene files.
  The format was not verified against a file written by dspMixFx, see the
  comment above exportUR44File.
*/

import {
  rawDumpToPayload,
  payloadToRawDump,
  parseBulkDump,
  DUMP_TYPE_CURRENT_SCENE,
} from "./devices/UR44-protocol.js";

export const SLOT_COUNT = 20;
/*
  Scene names are trimmed, stripped of control characters and truncated to
  this many characters (dspMixFx uses short scene names too).
*/
export const MAX_NAME_LENGTH = 16;
export const STORAGE_KEY = "steinmixer.scenes.v1";
/* dspMixFx shows empty slots like this */
export const EMPTY_SLOT_NAME = "---";

/* the 14 bit size field of a bulk dump limits the payload size */
const MAX_PAYLOAD_LENGTH = 14000;

export const isValidSlot = (slot) => {
  return Number.isInteger(slot) && slot >= 1 && slot <= SLOT_COUNT;
};

const assertSlot = (slot) => {
  if (!isValidSlot(slot)) {
    throw new RangeError(
      `Invalid scene slot ${slot}, must be an integer 1..${SLOT_COUNT}`,
    );
  }
};

const isControlChar = (char) => {
  const code = char.codePointAt(0);
  return code < 0x20 || (code >= 0x7F && code < 0xA0);
};

/* Returns the normalized name or throws if it is not usable. */
export const normalizeName = (name) => {
  if (typeof name !== "string") {
    throw new TypeError("Scene name must be a string");
  }
  const chars = Array.from(name)
    .filter((char) => !isControlChar(char))
    .join("")
    .trim();
  const normalized = Array.from(chars)
    .slice(0, MAX_NAME_LENGTH)
    .join("")
    .trim();
  if (normalized.length === 0) {
    throw new Error("Scene name must not be empty");
  }
  return normalized;
};

/* base64 */

export const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
};

export const base64ToBytes = (text) => {
  const clean = text.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new Error("Invalid base64 data");
  }
  return Array.from(atob(clean), (char) => char.charCodeAt(0));
};

/* validation of scene data */

const toByteArray = (bytes) => {
  if (
    !bytes
    || typeof bytes.length !== "number"
    || typeof bytes === "string"
  ) {
    throw new TypeError("Scene dump must be an array of bytes");
  }
  const array = Array.from(bytes);
  if (!array.every((b) => Number.isInteger(b) && b >= 0 && b <= 0xFF)) {
    throw new TypeError("Scene dump must only contain bytes (0..255)");
  }
  return array;
};

/*
  Throws if `raw` is not a well-formed CurrentScene bulk dump. parseBulkDump
  doesn't validate much itself, so we check the block names and that every
  value could be read (truncated data results in NaN values).
*/
const checkSceneDump = (raw) => {
  const parsed = parseBulkDump(raw);
  if (parsed.name !== "CurrentScene" || parsed.dataName !== "CurrentScene") {
    throw new Error(
      `Not a CurrentScene dump (found "${parsed.name}"/"${parsed.dataName}")`,
    );
  }
  if (parsed.groups.length === 0) {
    throw new Error("Scene dump contains no parameters");
  }
  for (const values of parsed.values.values()) {
    if (!values.every(Number.isFinite)) {
      throw new Error("Scene dump is truncated or corrupt");
    }
  }
};

/* Converts an unpacked payload (as stored in files) to a raw bulk dump. */
const payloadToSceneDump = (payload) => {
  if (payload.length === 0) throw new Error("Scene data is empty");
  if (payload.length > MAX_PAYLOAD_LENGTH) {
    throw new Error("Scene data is too large");
  }
  const raw = payloadToRawDump(payload, DUMP_TYPE_CURRENT_SCENE);
  checkSceneDump(raw);
  return raw;
};

/* Keeps only entries with numeric values, returns a fresh object. */
const normalizeExtras = (extras) => {
  const out = {};
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) {
    return out;
  }
  for (const [key, value] of Object.entries(extras)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
};

/*
  Encodes a validated scene for persisting. We store the unpacked payload
  (like dspMixFx does) as it is more compact. Should a dump ever not survive
  the payload round trip byte-exactly, the raw dump is stored instead.
*/
const encodeScene = (scene) => {
  if (!scene || typeof scene !== "object") {
    throw new TypeError("Scene must be an object { dump, extras }");
  }
  const raw = toByteArray(scene.dump);
  checkSceneDump(raw);
  const extras = normalizeExtras(scene.extras);
  const payload = rawDumpToPayload(raw);
  const roundTrip = payloadToRawDump(payload, DUMP_TYPE_CURRENT_SCENE);
  const exact = roundTrip.length === raw.length
    && roundTrip.every((b, i) => b === raw[i]);
  return exact
    ? { payload: bytesToBase64(payload), extras }
    : { raw: bytesToBase64(raw), extras };
};

const decodeScene = (entry) => {
  const dump = typeof entry.raw === "string"
    ? base64ToBytes(entry.raw)
    : payloadToRawDump(base64ToBytes(entry.payload), DUMP_TYPE_CURRENT_SCENE);
  return { dump, extras: { ...entry.extras } };
};

const isStoredEntry = (entry) => {
  return entry
    && typeof entry === "object"
    && typeof entry.name === "string"
    && (typeof entry.payload === "string" || typeof entry.raw === "string");
};

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/*
  The 20 scene slots plus the "current scene" state.

  `storage` is any object with getItem/setItem (default: localStorage, pass
  null for memory only). All storage access is wrapped in try/catch, if the
  storage is unavailable the library keeps the scenes in memory only, see
  `persistent`.

  Dispatches a "change" event after every modification.

  Note that store/clear/... don't change the current scene (except keeping
  it consistent, e.g. clearing the current slot detaches it): callers decide
  when a scene becomes current via setCurrent().
*/
export class SceneLibrary extends EventTarget {
  #storage;
  #key;
  #persistent;
  #slots = new Map();
  #current = { slot: null, name: null, modified: false };

  constructor({ storage, key = STORAGE_KEY } = {}) {
    super();
    this.#storage = storage === undefined ? getDefaultStorage() : storage;
    this.#key = key;
    this.#persistent = Boolean(this.#storage);
    this.#load();
  }

  /* false if scenes can't be persisted (storage unavailable or failing) */
  get persistent() {
    return this.#persistent;
  }

  #load() {
    if (!this.#storage) return;
    let text;
    try {
      text = this.#storage.getItem(this.#key);
    } catch {
      this.#persistent = false;
      return;
    }
    if (!text) return;
    try {
      const data = JSON.parse(text);
      for (const [key, entry] of Object.entries(data?.slots ?? {})) {
        const slot = Number(key);
        if (isValidSlot(slot) && isStoredEntry(entry)) {
          this.#slots.set(slot, {
            name: entry.name,
            ...(typeof entry.raw === "string"
              ? { raw: entry.raw }
              : { payload: entry.payload }),
            extras: normalizeExtras(entry.extras),
          });
        }
      }
      const current = data?.current;
      if (current && typeof current === "object") {
        this.#current = {
          slot: isValidSlot(current.slot) && this.#slots.has(current.slot)
            ? current.slot
            : null,
          name: typeof current.name === "string" ? current.name : null,
          modified: current.modified === true,
        };
      }
    } catch (e) {
      console.warn("Ignoring corrupt scene storage", e);
    }
  }

  #save() {
    if (this.#storage) {
      try {
        this.#storage.setItem(this.#key, JSON.stringify({
          version: 1,
          slots: Object.fromEntries(this.#slots),
          current: this.#current,
        }));
        this.#persistent = true;
      } catch (e) {
        if (this.#persistent) console.warn("Could not persist scenes", e);
        this.#persistent = false;
      }
    }
    this.dispatchEvent(new Event("change"));
  }

  /* [{ slot, name, empty }] for all 20 slots, name is null if empty */
  list() {
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const entry = this.#slots.get(i + 1);
      return { slot: i + 1, name: entry?.name ?? null, empty: !entry };
    });
  }

  isEmpty(slot) {
    assertSlot(slot);
    return !this.#slots.has(slot);
  }

  /* { slot, name, scene: { dump, extras } } (fresh copies) or null */
  get(slot) {
    assertSlot(slot);
    const entry = this.#slots.get(slot);
    if (!entry) return null;
    try {
      return { slot, name: entry.name, scene: decodeScene(entry) };
    } catch (e) {
      console.warn(`Scene in slot ${slot} is corrupt`, e);
      return null;
    }
  }

  /* Throws on invalid slot, name or scene. Returns the normalized name. */
  store(slot, name, scene) {
    assertSlot(slot);
    const normalized = normalizeName(name);
    this.#slots.set(slot, { name: normalized, ...encodeScene(scene) });
    this.#save();
    return normalized;
  }

  rename(slot, name) {
    assertSlot(slot);
    const entry = this.#slots.get(slot);
    if (!entry) throw new Error(`Scene slot ${slot} is empty`);
    entry.name = normalizeName(name);
    if (this.#current.slot === slot) this.#current.name = entry.name;
    this.#save();
    return entry.name;
  }

  clear(slot) {
    assertSlot(slot);
    this.#slots.delete(slot);
    if (this.#current.slot === slot) this.#current.slot = null;
    this.#save();
  }

  initializeAll() {
    this.#slots.clear();
    this.#current.slot = null;
    this.#save();
  }

  /*
    Replaces all slots with `scenes` ([{ slot, name, scene }], e.g. from
    importUR44File). Atomic: throws without changing anything if one of
    them is invalid.
  */
  replaceAll(scenes) {
    const slots = new Map();
    for (const { slot, name, scene } of scenes) {
      assertSlot(slot);
      slots.set(slot, { name: normalizeName(name), ...encodeScene(scene) });
    }
    this.#slots = slots;
    this.#current.slot = null;
    this.#save();
  }

  /* { slot: number|null, name: string|null, modified: boolean } */
  get current() {
    return { ...this.#current };
  }

  /*
    Marks the scene as the one that is currently loaded (after recall or
    store) and resets the modified flag. `slot` may be null for a scene that
    is not in the library, `name` defaults to the name stored in the slot.
  */
  setCurrent(slot, name) {
    if (slot !== null) assertSlot(slot);
    let currentName = name ?? null;
    if (currentName === null && slot !== null) {
      currentName = this.#slots.get(slot)?.name ?? null;
    }
    this.#current = {
      slot,
      name: currentName === null ? null : normalizeName(currentName),
      modified: false,
    };
    this.#save();
  }

  /* Called whenever the user changes a parameter. Cheap if already set. */
  markModified() {
    if (this.#current.modified) return;
    this.#current.modified = true;
    this.#save();
  }
}

/* XML helpers (no DOMParser, so that this works in node, too) */

export const escapeXml = (text) => {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
};

export const unescapeXml = (text) => {
  return text.replace(
    /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,
    (entity, ref) => {
      if (ref[0] === "#") {
        const code = ref[1] === "x" || ref[1] === "X"
          ? parseInt(ref.slice(2), 16)
          : parseInt(ref.slice(1), 10);
        return code > 0 && code <= 0x10FFFF
          ? String.fromCodePoint(code)
          : entity;
      }
      return NAMED_ENTITIES[ref.toLowerCase()] ?? entity;
    },
  );
};

const ATTRIBUTES_PATTERN
  = String.raw`((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(/?)>`;

/* attribute names are lowercased */
const parseAttributes = (text) => {
  const attributes = {};
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(text))) {
    attributes[match[1].toLowerCase()] = unescapeXml(match[2] ?? match[3]);
  }
  return attributes;
};

/*
  Finds all (non-nested) elements with the given tag name. Returns
  [{ attributes, inner, terminated }], inner is the raw content.
*/
const findElements = (source, tag) => {
  const open = new RegExp(`<${tag}${ATTRIBUTES_PATTERN}`, "gi");
  const elements = [];
  let match;
  while ((match = open.exec(source))) {
    const attributes = parseAttributes(match[1]);
    if (match[2] === "/") {
      elements.push({ attributes, inner: "", terminated: true });
      continue;
    }
    const close = new RegExp(`</${tag}\\s*>`, "gi");
    close.lastIndex = open.lastIndex;
    const end = close.exec(source);
    if (!end) {
      elements.push({
        attributes,
        inner: source.slice(open.lastIndex),
        terminated: false,
      });
      break;
    }
    elements.push({
      attributes,
      inner: source.slice(open.lastIndex, end.index),
      terminated: true,
    });
    open.lastIndex = close.lastIndex;
  }
  return elements;
};

const unwrapCdata = (text) => {
  return text.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
    (_, content) => escapeXml(content),
  );
};

/* The element's own text (without child elements), unescaped. */
const ownText = (inner) => {
  let text = unwrapCdata(inner).replace(/<[^<>]*\/>/g, "");
  let previous;
  do {
    previous = text;
    text = text.replace(/<([^\s<>/]+)[^<>]*>[^<]*<\/\1\s*>/g, "");
  } while (text !== previous);
  return unescapeXml(text.replace(/<[^<>]*>/g, ""));
};

const childText = (inner, tag) => {
  const [element] = findElements(inner, tag);
  return element ? unescapeXml(unwrapCdata(element.inner)).trim() : null;
};

const parseExtras = (text) => {
  if (!text) return {};
  try {
    return normalizeExtras(JSON.parse(text));
  } catch {
    return {};
  }
};

const pad = (slot) => String(slot).padStart(2, "0");

/*
  dspMixFx scene file (*.UR44), as far as known:

    <!DOCTYPE UR44>
    <UR44File>
      <Header>UR44 File</Header>
      <Version>1.0.0</Version>
      <SceneData>
        <Scene No="1" name="..." sz="..." cvtSz="...">BASE64 payload</Scene>
        ...
      </SceneData>
      <CurrentScene ...><CurrentData ...>BASE64 payload</CurrentData>
      </CurrentScene>
    </UR44File>

  The payload is the unpacked CurrentScene bulk dump. dspMixFx also writes
  child elements like <MuteStatus>, <FxInsPosStatus>, <ChFxTypeStatus> whose
  content is unknown; we don't write them. sz and cvtSz are written as the
  payload length (assumption). Empty slots are not written.
  Steinmixer's extras are stored as JSON in a SteinmixerExtras attribute that
  dspMixFx should ignore.

  `options.current` ({ dump, extras }, e.g. from device.captureScene()) is
  written as <CurrentScene>. Without it, the stored scene of the current
  slot is used if it wasn't modified, otherwise <CurrentScene> is omitted.
*/
export const exportUR44File = (library, { current } = {}) => {
  const sceneAttributes = (dump, extras) => {
    const payload = rawDumpToPayload(toByteArray(dump));
    const normalized = normalizeExtras(extras);
    const extrasAttribute = Object.keys(normalized).length > 0
      ? ` SteinmixerExtras="${escapeXml(JSON.stringify(normalized))}"`
      : "";
    return {
      attributes: `sz="${payload.length}" cvtSz="${payload.length}"`
        + extrasAttribute,
      data: bytesToBase64(payload),
    };
  };

  const lines = [
    "<!DOCTYPE UR44>",
    "<UR44File>",
    "  <Header>UR44 File</Header>",
    "  <Version>1.0.0</Version>",
    "  <SceneData>",
  ];
  for (const { slot, empty } of library.list()) {
    if (empty) continue;
    const entry = library.get(slot);
    if (!entry) continue;
    const { attributes, data } = sceneAttributes(
      entry.scene.dump,
      entry.scene.extras,
    );
    lines.push(
      `    <Scene No="${slot}" name="${escapeXml(entry.name)}" ${attributes}>${data}</Scene>`,
    );
  }
  lines.push("  </SceneData>");

  const state = library.current;
  let currentScene = current;
  if (!currentScene && state.slot !== null && !state.modified) {
    currentScene = library.get(state.slot)?.scene;
  }
  if (currentScene) {
    const { attributes, data } = sceneAttributes(
      currentScene.dump,
      currentScene.extras,
    );
    lines.push(
      `  <CurrentScene No="${state.slot ?? 0}" name="${escapeXml(state.name ?? "")}">`,
      `    <CurrentData ${attributes}>${data}</CurrentData>`,
      "  </CurrentScene>",
    );
  }
  lines.push("</UR44File>", "");
  return lines.join("\n");
};

/*
  Reads a *.UR44 scene file. Tolerant: unknown elements and attributes are
  ignored, invalid scenes are skipped and reported in `errors`
  ([{ slot, name, message }]). Never throws.

  Returns {
    scenes: [{ slot, name, scene: { dump, extras } }] (sorted by slot),
    errors,
    current: { slot, name, scene } | null (the <CurrentScene>, if valid),
  }
*/
export const importUR44File = (text) => {
  const scenes = [];
  const errors = [];
  let current = null;

  const source = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (!/<UR44File\b/i.test(source)) {
    errors.push({
      slot: null,
      name: null,
      message: "Not a UR44 scene file (no <UR44File> element)",
    });
    return { scenes, errors, current };
  }

  const readScene = (inner, attributes) => {
    const dump = payloadToSceneDump(base64ToBytes(ownText(inner)));
    const extras = parseExtras(
      attributes.steinmixerextras ?? childText(inner, "SteinmixerExtras"),
    );
    return { dump, extras };
  };

  const [sceneData] = findElements(source, "SceneData");
  const sceneSource = sceneData
    ? sceneData.inner
    : source.replace(/<CurrentScene\b[\s\S]*?<\/CurrentScene\s*>/gi, "");
  const seen = new Set();

  for (const { attributes, inner, terminated } of findElements(
    sceneSource,
    "Scene",
  )) {
    const rawNo = attributes.no ?? "";
    const slot = /^\s*\d+\s*$/.test(rawNo) ? parseInt(rawNo, 10) : NaN;
    const rawName = attributes.name ?? null;
    const report = (message) => {
      errors.push({
        slot: isValidSlot(slot) ? slot : null,
        name: rawName,
        message,
      });
    };

    if (!isValidSlot(slot)) {
      report(`Invalid scene number "${rawNo}"`);
      continue;
    }
    if (!terminated) {
      report(`Scene ${slot} is incomplete (file truncated?)`);
      continue;
    }
    const hasData = ownText(inner).replace(/\s+/g, "").length > 0;
    if (!hasData) {
      // empty slot, like dspMixFx' "---"
      if (rawName === null || rawName.trim() === ""
        || rawName.trim() === EMPTY_SLOT_NAME) {
        continue;
      }
      report(`Scene ${slot} contains no data`);
      continue;
    }
    if (seen.has(slot)) {
      report(`Scene number ${slot} occurs more than once`);
      continue;
    }
    let scene;
    try {
      scene = readScene(inner, attributes);
    } catch (e) {
      report(`Scene ${slot} is invalid: ${e.message}`);
      continue;
    }
    let name;
    try {
      name = normalizeName(rawName ?? "");
      if (name === EMPTY_SLOT_NAME) name = `Scene ${pad(slot)}`;
    } catch {
      name = `Scene ${pad(slot)}`;
    }
    seen.add(slot);
    scenes.push({ slot, name, scene });
  }
  scenes.sort((a, b) => a.slot - b.slot);

  const [currentScene] = findElements(source, "CurrentScene");
  if (currentScene) {
    const [data] = findElements(currentScene.inner, "CurrentData");
    if (data && ownText(data.inner).replace(/\s+/g, "")) {
      const no = parseInt(currentScene.attributes.no ?? "", 10);
      let name = null;
      try {
        name = normalizeName(currentScene.attributes.name ?? "");
      } catch {
        name = null;
      }
      try {
        current = {
          slot: isValidSlot(no) ? no : null,
          name,
          scene: readScene(data.inner, data.attributes),
        };
      } catch (e) {
        errors.push({
          slot: null,
          name: "CurrentScene",
          message: `Current scene is invalid: ${e.message}`,
        });
      }
    }
  }

  return { scenes, errors, current };
};
