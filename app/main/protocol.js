'use strict';
/* ==========================================================================
   Protocole privilégié app://lamia/ : ne sert que les fichiers de renderer/
   (et de shared/, la logique pure partagée), avec un contrôle anti-traversée
   de chemin et la CSP stricte en en-tête. Aucun accès à file://.
   ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const SCHEME = 'app';
const HOST = 'lamia';
const ORIGIN = `${SCHEME}://${HOST}`;

// Les styles en attribut (style="--value:70") viennent des gabarits de la maquette :
// on ne les autorise QUE pour les attributs (style-src-attr). Jamais de script inline ni d'eval.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function privilegedScheme() {
  return { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } };
}

// Chemin du fichier pour une URL app://lamia/…, ou null (refus)
function resolveFile(url, roots) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  if (u.protocol !== SCHEME + ':' || u.host !== HOST) return null;
  let p;
  try { p = decodeURIComponent(u.pathname); } catch (e) { return null; }
  if (p === '/' || p === '') p = '/index.html';
  if (p.indexOf('\0') >= 0 || p.indexOf('\\') >= 0) return null;     // antislash : séparateur sous Windows
  const parts = p.split('/').filter(Boolean);
  if (parts.some((x) => x === '..' || x === '.')) return null;
  let base = roots.renderer;
  if (parts[0] === 'shared') { base = roots.shared; parts.shift(); }
  const file = path.resolve(base, ...parts);
  if (file !== base && !file.startsWith(base + path.sep)) return null;
  return file;
}

function register(protocol, roots) {
  protocol.handle(SCHEME, async (request) => {
    const file = resolveFile(request.url, roots);
    if (!file) return new Response('Interdit', { status: 403 });
    try {
      const body = await fs.promises.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff' };
      if (ext === '.html') headers['content-security-policy'] = CSP;
      return new Response(body, { status: 200, headers });
    } catch (e) {
      return new Response('Introuvable', { status: 404 });
    }
  });
}

module.exports = { SCHEME, HOST, ORIGIN, CSP, privilegedScheme, resolveFile, register };
