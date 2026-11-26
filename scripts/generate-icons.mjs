import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function blend(base, top, alpha) {
  const amount = Math.max(0, Math.min(1, alpha));
  return base.map((channel, index) => Math.round(channel * (1 - amount) + top[index] * amount));
}

function coverCircle(x, y, cx, cy, radius) {
  const distance = Math.hypot(x - cx, y - cy);
  return Math.max(0, Math.min(1, radius + 0.6 - distance));
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function paint(x, y, size) {
  const nx = x / size;
  const ny = y / size;
  let color = [9, 9, 11];
  const circle = coverCircle(nx, ny, 0.5, 0.5, 0.38);
  if (circle > 0) color = blend(color, [5, 150, 105], circle);

  const head = coverCircle(nx, ny, 0.5, 0.36, 0.075);
  const body = insidePolygon(nx, ny, [
    [0.43, 0.45],
    [0.57, 0.45],
    [0.66, 0.68],
    [0.34, 0.68],
  ])
    ? 1
    : 0;
  const base = insidePolygon(nx, ny, [
    [0.3, 0.7],
    [0.7, 0.7],
    [0.74, 0.78],
    [0.26, 0.78],
  ])
    ? 1
    : 0;
  const pawn = Math.max(head, body, base);
  if (pawn > 0) color = blend(color, [244, 244, 245], pawn);
  return [...color, 255];
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x + 0.5, y + 0.5, size);
      const offset = row + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public", "icons");
const appDir = path.join(root, "src", "app");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "icon-192.png"), png(192));
fs.writeFileSync(path.join(publicDir, "icon-512.png"), png(512));
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), png(180));
fs.writeFileSync(path.join(appDir, "icon.png"), png(512));
fs.writeFileSync(path.join(appDir, "apple-icon.png"), png(180));
