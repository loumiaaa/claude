#!/usr/bin/env node
// Assemble la maquette en un seul fichier HTML autonome (CSS, JS et polices embarqués).
// Usage : node maquette/build-standalone.mjs
// Sortie : maquette/dist/plateforme-de-suivi-lamia.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, 'index.html');
const outDir = resolve(here, 'dist');
const outFile = resolve(outDir, 'plateforme-de-suivi-lamia.html');

const MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const isLocal = (ref) => !/^(?:[a-z]+:)?\/\//i.test(ref) && !ref.startsWith('data:') && !ref.startsWith('#');

function inlineCssUrls(css, cssPath) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, _q, ref) => {
    if (!isLocal(ref)) return match;
    const file = resolve(dirname(cssPath), ref);
    const mime = MIME[extname(file).toLowerCase()];
    if (!mime) return match;
    const data = readFileSync(file).toString('base64');
    return `url("data:${mime};base64,${data}")`;
  });
}

let html = readFileSync(entry, 'utf8');
const inlined = [];

html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
  const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
  if (!href || !isLocal(href)) return tag;
  const cssPath = resolve(here, href);
  inlined.push(href);
  const css = inlineCssUrls(readFileSync(cssPath, 'utf8'), cssPath);
  return `<style data-source="${href}">\n${css}\n</style>`;
});

html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (tag, before, src, after) => {
  if (!isLocal(src)) return tag;
  inlined.push(src);
  const js = readFileSync(resolve(here, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script${before}${after} data-source="${src}">\n${js}\n</script>`;
});

html = html.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi, (match, a, src, b) => {
  if (!isLocal(src)) return match;
  const file = resolve(here, src);
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) return match;
  inlined.push(src);
  return `${a}data:${mime};base64,${readFileSync(file).toString('base64')}${b}`;
});

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Maquette autonome : ${outFile} (${kb} Ko, ${inlined.length} fichiers embarqués)`);
