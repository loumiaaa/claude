#!/usr/bin/env node
// Télécharge General Sans (Fontshare, ITF Free Font License) et extrait les
// woff2 400, 500, 600 et 700 + la licence dans renderer/fonts/general-sans/
// (dossier ignoré par git). scripts/sync-design.mjs ajoute alors les url()
// après les local() dans la copie du fonts.css du renderer.
//
// Si le téléchargement échoue (réseau coupé, Fontshare bloqué), le script
// prévient et se termine SANS erreur : l'app garde Poppins en repli.
// Option --strict : code de sortie 1 en cas d'échec (pour une release exigeante).

import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const URL_ZIP = 'https://api.fontshare.com/v2/fonts/download/general-sans';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '..', 'renderer', 'fonts', 'general-sans');
const STRICT = process.argv.includes('--strict');
const WANTED = { Regular: 'GeneralSans-Regular.woff2', Medium: 'GeneralSans-Medium.woff2', Semibold: 'GeneralSans-Semibold.woff2', Bold: 'GeneralSans-Bold.woff2' };

function warn(msg) {
  console.warn(`[general-sans] ⚠ ${msg}`);
  console.warn('[general-sans] L’application utilisera Poppins en repli (déjà embarquée). Le build continue.');
  process.exit(STRICT ? 1 : 0);
}

// Lecture minimale d'une archive ZIP (répertoire central ; méthodes « stored » et « deflate »)
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('archive ZIP illisible (fin du répertoire introuvable)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('répertoire central ZIP invalide');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    files.push({
      name,
      read() {
        if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('en-tête local ZIP invalide : ' + name);
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const data = buf.subarray(start, start + csize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return zlib.inflateRawSync(data);
        throw new Error(`méthode de compression ${method} non prise en charge (${name})`);
      }
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

async function main() {
  let buf;
  try {
    const res = await fetch(URL_ZIP, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
    if (!res.ok) return warn(`téléchargement refusé (HTTP ${res.status}).`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return warn(`téléchargement impossible (${e.cause && e.cause.code || e.name || ''} ${e.message}).`);
  }
  let files;
  try { files = readZip(buf); } catch (e) { return warn(e.message); }

  const pick = (re) => files.filter((f) => re.test(f.name)).sort((a, b) => (/\/WEB\//i.test(b.name) - /\/WEB\//i.test(a.name)) || a.name.length - b.name.length)[0];
  const found = {};
  for (const [, file] of Object.entries(WANTED)) {
    const f = pick(new RegExp('(^|/)' + file.replace('.', '\\.') + '$', 'i'));
    if (!f) return warn(`${file} absent de l’archive Fontshare.`);
    const data = f.read();
    if (data.toString('ascii', 0, 4) !== 'wOF2') return warn(`${file} n’est pas un woff2 valide.`);
    found[file] = data;
  }
  const license = pick(/licen[cs]e[^/]*\.(txt|md)$/i) || pick(/(^|\/)ffl[^/]*\.(txt|md)$/i) || pick(/licen[cs]e/i);
  if (!license) return warn('licence absente de l’archive : on n’embarque pas la police sans sa licence.');

  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const [name, data] of Object.entries(found)) writeFileSync(resolve(OUT, name), data);
  const ext = (/\.(\w+)$/.exec(license.name) || [, 'txt'])[1];
  writeFileSync(resolve(OUT, `LICENSE-GeneralSans-ITF-FFL.${ext}`), license.read());
  console.log(`[general-sans] ✓ 4 graisses (400, 500, 600, 700) et la licence (${license.name}) dans renderer/fonts/general-sans/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
