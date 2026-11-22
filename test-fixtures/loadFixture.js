import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* Loads a captured SysEx message stored as space separated hex bytes. */
export const loadFixture = (name) => {
  const url = new URL(name, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8")
    .trim()
    .split(/\s+/)
    .map((h) => parseInt(h, 16));
};
