#!/usr/bin/env node
// Export des sprites PixelCast en PNG : sprite sheets horizontales (1x et 4x) + JSON de
// frames façon Aseprite, et icônes. Aucune dépendance : le PNG est encodé avec zlib.
//
// Usage (depuis la racine du dépôt) :
//   node design/sprites/export-png.mjs            -> design/sprites/png/
//   node design/sprites/export-png.mjs --out dossier --scale 6
//
// Le script relit design/sprites/pixel-cast.js dans un bac à sable (vm) avec un
// `window` factice : c'est toujours le même dessin que dans l'application.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));

/* ---------- Chargement de pixel-cast.js ---------- */

export function loadPixelCast(file = join(here, 'pixel-cast.js')) {
  const code = readFileSync(file, 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox; // window factice : pas de document, pas de canvas
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  const pc = sandbox.PixelCast;
  if (!pc || !pc._dev) throw new Error(`window.PixelCast introuvable après exécution de ${file}`);
  return pc;
}

/* ---------- Encodage PNG (RGBA 8 bits) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(width, height, rgba) {
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtre « None »
    src.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 8 bits par canal
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- Petits outils d'image ---------- */

export function upscale(width, height, data, k) {
  if (k === 1) return { width, height, data: Uint8Array.from(data) };
  const W = width * k, H = height * k;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = (y / k) | 0;
    for (let x = 0; x < W; x++) {
      const si = (sy * width + ((x / k) | 0)) * 4, di = (y * W + x) * 4;
      out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = data[si + 3];
    }
  }
  return { width: W, height: H, data: out };
}

// Colle des images de même taille côte à côte (sprite sheet horizontale).
export function hstrip(width, height, images) {
  const W = width * images.length;
  const out = new Uint8Array(W * height * 4);
  images.forEach((img, n) => {
    for (let y = 0; y < height; y++) {
      const src = Buffer.from(img.buffer, img.byteOffset + y * width * 4, width * 4);
      out.set(src, (y * W + n * width) * 4);
    }
  });
  return { width: W, height, data: out };
}

function asepriteJSON({ name, image, w, h, k, frames, tag, extra }) {
  return {
    frames: frames.map((f, n) => ({
      filename: `${name} ${n}.aseprite`,
      frame: { x: n * w * k, y: 0, w: w * k, h: h * k },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: w * k, h: h * k },
      sourceSize: { w: w * k, h: h * k },
      duration: f.duration
    })),
    meta: {
      app: 'design/sprites/export-png.mjs (PixelCast)',
      version: '1.0',
      image,
      format: 'RGBA8888',
      size: { w: w * k * frames.length, h: h * k },
      scale: String(k),
      frameTags: tag ? [{ name: tag, from: 0, to: frames.length - 1, direction: 'forward', ...extra }] : [],
      layers: [],
      slices: []
    }
  };
}

/* ---------- Export ---------- */

export function exportAll({ outDir = join(here, 'png'), bigScale = 4, quiet = false } = {}) {
  const pc = loadPixelCast();
  const dev = pc._dev;
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    if (/\.(png|json)$/i.test(f)) unlinkSync(join(outDir, f));
  }
  const written = [];
  const write = (file, buf) => { writeFileSync(join(outDir, file), buf); written.push(file); };

  for (const id of Object.keys(pc.animations)) {
    const { width: w, height: h } = pc.size(id);
    for (const anim of pc.animations[id]) {
      const a = dev.animation(id, anim);
      const sheet = hstrip(w, h, a.frames.map((f) => f.data));
      const extra = { loop: a.loop, next: a.loop ? null : a.next, repeat: a.repeat, still: a.still };
      for (const k of [1, bigScale]) {
        const base = k === 1 ? `${id}-${anim}` : `${id}-${anim}@${k}x`;
        const img = upscale(sheet.width, sheet.height, sheet.data, k);
        write(`${base}.png`, encodePNG(img.width, img.height, img.data));
        const json = asepriteJSON({ name: `${id}-${anim}`, image: `${base}.png`, w, h, k, frames: a.frames, tag: anim, extra });
        write(`${base}.json`, JSON.stringify(json, null, 2) + '\n');
      }
    }
  }

  // Icônes : un fichier par icône + une planche commune.
  const names = dev.iconNames();
  const icons = names.map((n) => dev.iconPixels(n));
  const S = icons[0].width;
  for (const k of [1, bigScale]) {
    names.forEach((n, i) => {
      const img = upscale(S, S, icons[i].data, k);
      write(k === 1 ? `icon-${n}.png` : `icon-${n}@${k}x.png`, encodePNG(img.width, img.height, img.data));
    });
    const sheet = hstrip(S, S, icons.map((ic) => ic.data));
    const img = upscale(sheet.width, sheet.height, sheet.data, k);
    const base = k === 1 ? 'icons' : `icons@${k}x`;
    write(`${base}.png`, encodePNG(img.width, img.height, img.data));
    const json = asepriteJSON({ name: 'icons', image: `${base}.png`, w: S, h: S, k, frames: icons.map(() => ({ duration: 100 })), tag: null });
    json.frames.forEach((f, i) => { f.filename = `icon-${names[i]}`; });
    write(`${base}.json`, JSON.stringify(json, null, 2) + '\n');
  }

  if (!quiet) {
    console.log(`PixelCast ${dev.version} : ${written.length} fichiers écrits dans ${relative(process.cwd(), outDir) || '.'}`);
  }
  return written;
}

/* ---------- Ligne de commande ---------- */

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const outDir = resolve(opt('--out', join(here, 'png')));
  const bigScale = Math.max(2, parseInt(opt('--scale', '4'), 10) || 4);
  if (!existsSync(join(here, 'pixel-cast.js'))) {
    console.error('pixel-cast.js introuvable à côté de ce script.');
    process.exit(1);
  }
  try {
    exportAll({ outDir, bigScale });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
