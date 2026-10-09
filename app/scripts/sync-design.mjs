#!/usr/bin/env node
// Copie design/ (source unique : tokens, composants, icônes, phrases, polices,
// sprites) dans app/renderer/design/ (dossier ignoré par git).
// Lancé avant start, test et build (scripts npm).
//
// Polices : design/fonts/fonts.css n'est JAMAIS modifié. Si General Sans a été
// téléchargée (scripts/fetch-general-sans.mjs → renderer/fonts/general-sans/),
// la copie du renderer ajoute un url(...) après les local() ; sinon la police
// reste déclarée en local() avec Poppins en repli (cf. tokens.css).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const src = resolve(appDir, '..', 'design');
const dest = resolve(appDir, 'renderer', 'design');
const fontsDir = resolve(appDir, 'renderer', 'fonts', 'general-sans');

// Ce qui ne sert pas à l'app : planches de prévisualisation, sources d'export, PNG d'export.
const SKIP = [/\.html$/i, /^sprites[\\/]png([\\/]|$)/, /^sprites[\\/]export-png\.mjs$/, /README\.md$/i];

if (!existsSync(src)) {
  console.error(`[sync-design] Dossier introuvable : ${src}`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

let count = 0;
cpSync(src, dest, {
  recursive: true,
  filter: (from) => {
    const rel = relative(src, from);
    if (!rel) return true;
    if (SKIP.some((re) => re.test(rel))) return false;
    if (statSync(from).isFile()) count++;
    return true;
  }
});

// General Sans : url() après les local(), seulement si les woff2 sont là.
const WEIGHTS = { 400: 'GeneralSans-Regular.woff2', 500: 'GeneralSans-Medium.woff2', 600: 'GeneralSans-Semibold.woff2', 700: 'GeneralSans-Bold.woff2' };
const fontsCss = join(dest, 'fonts', 'fonts.css');
let css = readFileSync(fontsCss, 'utf8');
const available = Object.entries(WEIGHTS).filter(([, f]) => existsSync(join(fontsDir, f)));
if (available.length) {
  css = css.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
    if (!/font-family:\s*"General Sans"/.test(block)) return block;
    const w = (/font-weight:\s*(\d+)/.exec(block) || [])[1];
    const file = WEIGHTS[w];
    if (!file || !existsSync(join(fontsDir, file))) return block;
    return block.replace(/src:\s*([^;]+);/, (m, list) => `src: ${list.trim()}, url("../../fonts/general-sans/${file}") format("woff2");`);
  });
  css = `/* Copie générée par app/scripts/sync-design.mjs : General Sans embarquée (${available.length} graisses). */\n` + css;
  writeFileSync(fontsCss, css);
}

writeFileSync(join(dest, 'SOURCE.txt'),
  'Copie générée de design/ (ne pas modifier ici : éditer design/ puis relancer npm run sync-design).\n');

const files = readdirSync(dest, { recursive: true }).length;
console.log(`[sync-design] design/ → ${relative(appDir, dest).split(sep).join('/')}/ : ${count} fichiers copiés (${files} entrées)` +
  (available.length ? `, General Sans embarquée (${available.length}/4)` : ', General Sans absente (repli Poppins)'));
