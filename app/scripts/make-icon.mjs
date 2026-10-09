#!/usr/bin/env node
// Génère l'icône de l'application à partir du sprite pixel art de Memeow
// (design/sprites/png/memeow-idle.png, 1re image), sur un fond vitré arrondi
// bleu-violet de la charte. Sans dépendance : décodeur/encodeur PNG et
// conteneur ICO (des PNG dans un ICO, Windows Vista et suivants) écrits ici.
//
// Sorties :
//   build/icon.ico          exe (electron-builder) : 16, 24, 32, 48, 64, 128, 256 px
//   main/assets/icon.ico    fenêtre et zone de notification (Windows)
//   main/assets/icon.png    fenêtre et notifications (Linux), 256 px
//   build/icon-preview.png  planche de contrôle (non embarquée)
// Le sprite n'est jamais lissé : agrandissement (ou réduction) au plus proche voisin.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const SPRITE = resolve(appDir, '..', 'design', 'sprites', 'png', 'memeow-idle.png');
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

/* --- Dessin ------------------------------------------------------------------ */
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
const TOP = hex('#B9CCFF'), MID = hex('#9C8BF2'), BOTTOM = hex('#5B47D0'), EDGE = hex('#3B2F9E');

function blend(dst, i, [r, g, b], a) {
  const da = dst[i + 3] / 255, oa = a + da * (1 - a);
  if (oa <= 0) return;
  dst[i] = Math.round((r * a + dst[i] * da * (1 - a)) / oa);
  dst[i + 1] = Math.round((g * a + dst[i + 1] * da * (1 - a)) / oa);
  dst[i + 2] = Math.round((b * a + dst[i + 2] * da * (1 - a)) / oa);
  dst[i + 3] = Math.round(oa * 255);
}

// Couverture d'un carré arrondi (anticrénelage par sur-échantillonnage 4×4)
function coverage(x, y, x0, y0, x1, y1, r) {
  let hit = 0;
  for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
    const px = x + (sx + 0.5) / 4, py = y + (sy + 0.5) / 4;
    if (px < x0 || px > x1 || py < y0 || py > y1) continue;
    const cx = Math.min(Math.max(px, x0 + r), x1 - r), cy = Math.min(Math.max(py, y0 + r), y1 - r);
    if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) hit++;
  }
  return hit / 16;
}

function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }

// Recadrages du sprite (1re image de memeow-idle, 32 × 24) : corps entier ou tête
const CROPS = { body: { x: 2, y: 1, w: 25, h: 23 }, head: { x: 2, y: 1, w: 20, h: 13 } };

function drawIcon(sprite, size) {
  const data = Buffer.alloc(size * size * 4);
  const m = size <= 24 ? 0 : Math.max(1, Math.round(size * 0.04));
  const x0 = m, y0 = m, x1 = size - m, y1 = size - m, r = (x1 - x0) * 0.24;
  // Fond vitré : dégradé bleu → violet, bord lumineux en haut, liseré foncé
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cov = coverage(x, y, x0, y0, x1, y1, r);
    if (!cov) continue;
    const t = (x + y) / (2 * size);
    const col = t < 0.5 ? mix(TOP, MID, t / 0.5) : mix(MID, BOTTOM, (t - 0.5) / 0.5);
    const i = (y * size + x) * 4;
    blend(data, i, col, cov);
    const inner = coverage(x, y, x0 + 1, y0 + 1, x1 - 1, y1 - 1, Math.max(0, r - 1));
    if (cov - inner > 0.05 && size >= 32) blend(data, i, y < size / 2 ? [255, 255, 255] : EDGE, (cov - inner) * (y < size / 2 ? 0.75 : 0.55));
    const gloss = 1 - (y - y0) / ((y1 - y0) * 0.6);
    if (gloss > 0 && size >= 32) blend(data, i, [255, 255, 255], 0.22 * gloss * gloss * inner);   // reflet laiteux, en fondu
  }
  // Memeow, au plus proche voisin
  const crop = size === 48 || size <= 24 ? CROPS.head : CROPS.body;
  const avail = (x1 - x0) * (crop === CROPS.head ? 0.95 : 0.9);
  let k = avail / Math.max(crop.w, crop.h);
  if (k >= 1) k = Math.floor(k);
  const dw = Math.round(crop.w * k), dh = Math.round(crop.h * k);
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2 + (crop === CROPS.body ? size * 0.02 : 0));
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = crop.x + Math.min(crop.w - 1, Math.floor(x / k)), sy = crop.y + Math.min(crop.h - 1, Math.floor(y / k));
    const si = (sy * sprite.width + sx) * 4;
    const a = sprite.data[si + 3] / 255;
    if (!a) continue;
    const dx = ox + x, dy = oy + y;
    if (dx < 0 || dy < 0 || dx >= size || dy >= size) continue;
    blend(data, (dy * size + dx) * 4, [sprite.data[si], sprite.data[si + 1], sprite.data[si + 2]], a);
  }
  return { width: size, height: size, data };
}

export function makeIcons() {
  const sprite = decodePng(readFileSync(SPRITE));
  return SIZES.map((size) => ({ size, png: encodePng(drawIcon(sprite, size)), raw: drawIcon(sprite, size) }));
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
  if (process.argv.includes('--preview')) writeFileSync(resolve(process.argv[process.argv.indexOf('--preview') + 1] || resolve(appDir, 'build', 'icon-preview.png')), preview(icons));
  console.log(`[make-icon] icon.ico (${SIZES.join(', ')} px, ${(ico.length / 1024).toFixed(1)} Ko) et icon.png 256 px générés`);
}
