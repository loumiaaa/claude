#!/usr/bin/env node
// Construit la version web (PWA) dans app/web-dist/ :
// renderer (+ design synchronisé) + shared + web/ (pont Supabase, service
// worker, manifeste, icônes, config). Aucune dépendance.
// Config Supabase : variables LAMIA_SUPABASE_URL / LAMIA_SUPABASE_ANON_KEY,
// sinon web/config.js.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const out = resolve(appDir, 'web-dist');
const web = resolve(appDir, 'web');

execFileSync(process.execPath, [resolve(here, 'sync-design.mjs')], { stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(resolve(appDir, 'renderer'), out, { recursive: true });
cpSync(resolve(appDir, 'shared'), join(out, 'shared'), { recursive: true });
rmSync(join(out, 'design', 'SOURCE.txt'), { force: true });
cpSync(join(web, 'web-bridge.js'), join(out, 'js', 'web-bridge.js'));
cpSync(join(web, 'manifest.webmanifest'), join(out, 'manifest.webmanifest'));
cpSync(join(web, 'icons'), join(out, 'icons'), { recursive: true });

// Configuration
let config = readFileSync(join(web, 'config.js'), 'utf8');
const url = process.env.LAMIA_SUPABASE_URL, key = process.env.LAMIA_SUPABASE_ANON_KEY;
if (url && key) {
  config = config.replace(/supabaseUrl: '[^']*'/, `supabaseUrl: ${JSON.stringify(url)}`)
                 .replace(/supabaseAnonKey: '[^']*'/, `supabaseAnonKey: ${JSON.stringify(key)}`);
}
writeFileSync(join(out, 'config.js'), config);
const supabaseOrigin = (/supabaseUrl: ['"]([^'"]+)['"]/.exec(config) || [])[1] || '';

// index.html : CSP web, manifeste, icônes, scripts du pont
let html = readFileSync(join(out, 'index.html'), 'utf8');
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; " +
  `connect-src 'self'${supabaseOrigin ? ' ' + new URL(supabaseOrigin).origin : ''}; worker-src 'self'; manifest-src 'self'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'`;
html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
html = html.replace('</title>', `</title>
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#3B2F9E">
  <link rel="icon" type="image/png" href="icons/icon-192.png">
  <link rel="apple-touch-icon" href="icons/icon-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Lamia">`);
html = html.replace('<script src="js/bridge.js"></script>',
  '<script src="shared/demo.js"></script>\n  <script src="config.js"></script>\n  <script src="js/web-bridge.js"></script>\n  <script src="js/bridge.js"></script>');
if (!html.includes('js/web-bridge.js')) throw new Error('index.html : point d’insertion du pont web introuvable');
writeFileSync(join(out, 'index.html'), html);

// Service worker : liste des fichiers à mettre en cache, version = empreinte du contenu
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(out, p).split(sep).join('/'));
  }
})(out);
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(out, f)));
const version = hash.digest('hex').slice(0, 12);
const precache = ['./'].concat(files.filter((f) => !/\.(md|txt)$/i.test(f)));
writeFileSync(join(out, 'sw.js'), readFileSync(join(web, 'sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__FILES__', JSON.stringify(precache)));
writeFileSync(join(out, '.nojekyll'), '');

const kb = files.reduce((n, f) => n + statSync(join(out, f)).size, 0) / 1024;
console.log(`[build-web] ${files.length} fichiers, ${kb.toFixed(0)} Ko, version ${version}, synchro ${supabaseOrigin ? 'Supabase' : 'désactivée'} → ${out}`);
