/** Minimal GLB read/write for the progressive-asset scripts (no gltf-transform: images are swapped byte-for-byte). */
import fs from "node:fs";

export function readGlb(file) {
  const glb = fs.readFileSync(file);
  if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
  const binHeader = 20 + jsonLen;
  const bin = glb.subarray(binHeader + 8, binHeader + 8 + glb.readUInt32LE(binHeader));
  const view = (i) => {
    const v = json.bufferViews[i];
    return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  };
  return { json, view };
}

/** Writes `json` with buffer views taken from `view(i)`, except those in `replace` (index -> bytes); 4-byte aligned. */
export function writeGlb(file, json, view, replace) {
  const parts = [];
  let offset = 0;
  const views = json.bufferViews.map((_, i) => replace.get(i) ?? view(i));
  views.forEach((bytes, i) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    offset += pad;
    json.bufferViews[i].byteOffset = offset;
    json.bufferViews[i].byteLength = bytes.length;
    parts.push(bytes);
    offset += bytes.length;
  });
  const tail = (4 - (offset % 4)) % 4;
  if (tail) parts.push(Buffer.alloc(tail));
  const bin = Buffer.concat(parts);
  json.buffers[0].byteLength = bin.length;
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const chunk = (len, type) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };
  fs.writeFileSync(file, Buffer.concat([header, chunk(jsonBuf.length, 0x4e4f534a), jsonBuf, chunk(bin.length, 0x004e4942), bin]));
}
