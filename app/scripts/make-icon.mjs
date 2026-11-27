#!/usr/bin/env node
// Génère les icônes de l'application à partir de la marque (design/brand/app-icon.png :
// étincelle blanche au trait sur un carré bleu électrique arrondi, 1024 px).
// Sans dépendance : décodeur/encodeur PNG et conteneur ICO (des PNG dans un ICO,
// Windows Vista et suivants) écrits ici ; réduction par moyenne de zone (lissée).
//
// Sorties :
//   build/icon.ico          exe (electron-builder) : 16, 24, 32, 48, 64, 128, 256 px
//   main/assets/icon.ico    fenêtre et zone de notification (Windows)
//   main/assets/icon.png    fenêtre et notifications (Linux), 256 px
//   build/icon-mac.png      Mac, 1024 px
//   web/icons/icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png (site, iPhone)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const MASTER = resolve(appDir, '..', 'design', 'brand', 'app-icon.png');
const MASKABLE = resolve(appDir, '..', 'design', 'brand', 'app-icon-maskable.png');
export const SIZES = [16, 24, 32, 48, 64, 128, 256];

/* --- PNG ------------------------------------------------------------------ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('PNG attendu');
  let pos = 8, w = 0, h = 0, ct = 0, bd = 0, il = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bd !== 8 || ct !== 6 || il !== 0) throw new Error(`PNG RGBA 8 bits non entrelacé attendu (profondeur ${bd}, type ${ct})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 0xFF;
    }
  }
  return { width: w, height: h, data: out };
}

export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* --- ICO : en-tête + répertoire + images PNG -------------------------------- */
export function encodeIco(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir[o] = img.size >= 256 ? 0 : img.size; dir[o + 1] = img.size >= 256 ? 0 : img.size;
    dir[o + 2] = 0; dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(img.png.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += img.png.length;
  });
  return Buffer.concat([head, dir, ...images.map((i) => i.png)]);
}

export function readIco(buf) {
  const n = buf.readUInt16LE(4);
  return Array.from({ length: n }, (_, i) => {
    const o = 6 + i * 16;
    return { width: buf[o] || 256, height: buf[o + 1] || 256, bytes: buf.readUInt32LE(o + 8), offset: buf.readUInt32LE(o + 12) };
  });
}

/* --- Réduction (moyenne de zone, alpha prémultiplié) ------------------------- */
function blend(dst, i, [r, g, b], a) {
  const da = dst[i + 3] / 255, oa = a + da * (1 - a);
  if (oa <= 0) return;
  dst[i] = Math.round((r * a + dst[i] * da * (1 - a)) / oa);
  dst[i + 1] = Math.round((g * a + dst[i + 1] * da * (1 - a)) / oa);
  dst[i + 2] = Math.round((b * a + dst[i + 2] * da * (1 - a)) / oa);
  dst[i + 3] = Math.round(oa * 255);
}
export function downscale(img, size) {
  const out = Buffer.alloc(size * size * 4), k = img.width / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const x0 = x * k, x1 = (x + 1) * k, y0 = y * k, y1 = (y + 1) * k;
    let r = 0, g = 0, b = 0, a = 0, w = 0;
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
      const wx = Math.min(sx + 1, x1) - Math.max(sx, x0), wy = Math.min(sy + 1, y1) - Math.max(sy, y0), ww = wx * wy;
      const i = (sy * img.width + sx) * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al * ww; g += img.data[i + 1] * al * ww; b += img.data[i + 2] * al * ww; a += al * ww; w += ww;
    }
    const o = (y * size + x) * 4;
    if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
    out[o + 3] = Math.round(a / w * 255);
  }
  return { width: size, height: size, data: out };
}
function rgba(img) {
  if (img.data.length === img.width * img.height * 4) return img;
  const out = Buffer.alloc(img.width * img.height * 4);      // RVB → RVBA opaque
  for (let i = 0, j = 0; j < out.length; i += 3, j += 4) { out[j] = img.data[i]; out[j + 1] = img.data[i + 1]; out[j + 2] = img.data[i + 2]; out[j + 3] = 255; }
  return { width: img.width, height: img.height, data: out };
}
export function makeIcons() {
  const master = rgba(decodePng(readFileSync(MASTER)));
  return SIZES.map((size) => { const raw = downscale(master, size); return { size, png: encodePng(raw), raw }; });
}
function preview(icons) {
  // Planche : chaque taille à l'échelle 1 puis agrandie ×4 (contrôle visuel)
  const W = 1500, H = 1100, out = Buffer.alloc(W * H * 4, 255);
  let x = 10;
  for (const ic of icons) {
    const k = ic.size <= 64 ? 4 : ic.size === 128 ? 2 : 1;
    for (let y = 0; y < ic.size * k; y++) for (let xx = 0; xx < ic.size * k; xx++) {
      const si = ((Math.floor(y / k)) * ic.size + Math.floor(xx / k)) * 4, di = ((10 + y) * W + x + xx) * 4;
      if (10 + y >= H || x + xx >= W) continue;
      blend(out, di, [ic.raw.data[si], ic.raw.data[si + 1], ic.raw.data[si + 2]], ic.raw.data[si + 3] / 255);
    }
    x += ic.size * k + 12;
    if (x > W - 260) x = 10;
  }
  return encodePng({ width: W, height: H, data: out });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const icons = makeIcons();
  const ico = encodeIco(icons);
  for (const p of [resolve(appDir, 'build', 'icon.ico'), resolve(appDir, 'main', 'assets', 'icon.ico')]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, ico);
  }
  writeFileSync(resolve(appDir, 'main', 'assets', 'icon.png'), icons.find((i) => i.size === 256).png);
  const master = rgba(decodePng(readFileSync(MASTER))), mask = rgba(decodePng(readFileSync(MASKABLE)));
  writeFileSync(resolve(appDir, 'build', 'icon-mac.png'), encodePng(master));
  for (const n of [180, 192, 512]) writeFileSync(resolve(appDir, 'web', 'icons', 'icon-' + n + '.png'), encodePng(downscale(master, n)));
  writeFileSync(resolve(appDir, 'web', 'icons', 'icon-maskable-512.png'), encodePng(downscale(mask, 512)));
  if (process.argv.includes('--preview')) writeFileSync(resolve(process.argv[process.argv.indexOf('--preview') + 1] || resolve(appDir, 'build', 'icon-preview.png')), preview(icons));
  console.log(`[make-icon] icon.ico (${SIZES.join(', ')} px, ${(ico.length / 1024).toFixed(1)} Ko) et icon.png 256 px générés`);
}
