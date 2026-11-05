'use strict';
/* ==========================================================================
   Calendrier Apple (version Windows / Mac) : le main lit le lien public du
   calendrier (iCloud, Google, Outlook seulement) et renvoie le texte .ics.
   Pas de restriction CORS ici : aucun relais nécessaire.
   ========================================================================== */
const ICS = require('../shared/ics.js');

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 15000;

async function fetchCalendar(raw) {
  let url = ICS.allowedUrl(raw);
  if (!url) return { ok: false, error: 'Lien non reconnu : colle le lien d’un calendrier public iCloud (webcal://…).' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop < 4; hop++) {
      const r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { Accept: 'text/calendar, */*' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        url = ICS.allowedUrl(new URL(r.headers.get('location'), url).href);
        if (!url) return { ok: false, error: 'Le calendrier redirige vers un site non reconnu.' };
        continue;
      }
      if (r.status === 404) return { ok: false, error: 'Calendrier introuvable : le partage public a peut-être été désactivé.' };
      if (!r.ok) return { ok: false, error: 'Le calendrier ne répond pas (erreur ' + r.status + ').' };
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) return { ok: false, error: 'Calendrier trop volumineux.' };
      const text = buf.toString('utf8');
      if (!/BEGIN:VCALENDAR/.test(text)) return { ok: false, error: 'Ce lien ne renvoie pas un calendrier.' };
      return { ok: true, text };
    }
    return { ok: false, error: 'Trop de redirections.' };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'Le calendrier met trop de temps à répondre.' : 'Pas de connexion Internet ?' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchCalendar };
