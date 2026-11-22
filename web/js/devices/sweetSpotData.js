/*
  Sweet Spot Data files (*.ssd) as used by Yamaha's Sweet Spot Morphing
  Channel Strip (dspMixFx and the VST/AU plug-ins).

  512 bytes:
    0x00  "SSMD"
    0x08  version (01 00 00 00)
    0x10  system id, 4 ASCII chars (e.g. "0001"), zero padded to 16 bytes
    0x20  9 morph points of 0x28 bytes each: 17 u16 big endian values in the
          order of the morphing table params (ids 83..99), followed by three
          unused u16
    ...   copyright text / zero padding
  The name of the data is the file name without extension.
*/
export const SSD_SIZE = 512;
export const SSD_POINTS = 9;
export const SSD_VALUES_PER_POINT = 17;
const POINTS_OFFSET = 0x20;
const POINT_SIZE = 0x28;

export const parseSweetSpotData = (bytes, fileName = "") => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(...data.slice(0, 4));
  if (magic !== "SSMD" || data.byteLength < POINTS_OFFSET + 9 * POINT_SIZE) {
    throw new Error("Not a Sweet Spot Data file");
  }
  const idBytes = [...data.slice(0x10, 0x14)];
  const id = String.fromCharCode(...idBytes.filter((b) => b !== 0));
  const points = [];
  for (let p = 0; p < SSD_POINTS; p++) {
    const point = [];
    for (let i = 0; i < SSD_VALUES_PER_POINT; i++) {
      point.push(view.getUint16(POINTS_OFFSET + p * POINT_SIZE + i * 2));
    }
    points.push(point);
  }
  const name = fileName.replace(/\.ssd$/i, "").slice(0, 255);
  return { id, name, points };
};

export const buildSweetSpotData = ({ id, points }) => {
  const data = new Uint8Array(SSD_SIZE);
  const view = new DataView(data.buffer);
  [..."SSMD"].forEach((c, i) => {
    data[i] = c.charCodeAt(0);
  });
  data[0x08] = 1;
  [...(id ?? "").slice(0, 4)].forEach((c, i) => {
    data[0x10 + i] = c.charCodeAt(0) & 0x7F;
  });
  points.forEach((point, p) => {
    point.forEach((value, i) => {
      view.setUint16(POINTS_OFFSET + p * POINT_SIZE + i * 2, value);
    });
  });
  return data;
};
