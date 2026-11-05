// Plateforme de suivi - Lamia : relais du Calendrier Apple (Supabase Edge Function « calendar »).
//
// 1. POST { url }  (connexion obligatoire) : lit le lien public d'un calendrier iCloud,
//    Google ou Outlook et renvoie le texte .ics. Apple n'autorise pas un site à le lire
//    directement depuis le navigateur : ce relais le fait à sa place. Seuls ces trois
//    services sont acceptés (ce n'est pas un proxy ouvert).
// 2. GET ?feed=<jeton> : les échéances au format .ics, pour l'abonnement dans Calendrier
//    (iPhone, Mac). Le jeton privé est créé dans Réglages → Calendrier Apple.
// 3. GET ?ping=1 : le relais est-il installé ?
//
// Publication : supabase functions deploy calendar --no-verify-jwt
// (Calendrier ne peut pas envoyer de connexion pour l'abonnement : la fonction vérifie
// elle-même la connexion pour la lecture, et le jeton pour l'abonnement.)
// ics.js est une copie de app/shared/ics.js (un test vérifie qu'elles sont identiques).
import './ics.js';

// deno-lint-ignore no-explicit-any
const ICS = (globalThis as any).LamiaShared.ics;
const BASE = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_BYTES = 4 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}

async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+/.test(auth)) return false;
  const r = await fetch(BASE + '/auth/v1/user', { headers: { apikey: ANON, Authorization: auth } });
  return r.ok;
}

async function readCalendar(req: Request): Promise<Response> {
  if (!(await signedIn(req))) return json({ ok: false, error: 'Connexion expirée : reconnecte-toi.' }, 401);
  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  let url: string | null = ICS.allowedUrl(body.url);
  if (!url) return json({ ok: false, error: 'Lien non reconnu : colle le lien d’un calendrier public iCloud (webcal://…).' }, 400);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    for (let hop = 0; hop < 4; hop++) {
      const r: Response = await fetch(url!, { redirect: 'manual', signal: ctrl.signal, headers: { Accept: 'text/calendar, */*' } });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) {
        url = ICS.allowedUrl(new URL(loc, url!).href);
        if (!url) return json({ ok: false, error: 'Le calendrier redirige vers un site non reconnu.' });
        continue;
      }
      if (r.status === 404) return json({ ok: false, error: 'Calendrier introuvable : le partage public a peut-être été désactivé.' });
      if (!r.ok) return json({ ok: false, error: 'Le calendrier ne répond pas (erreur ' + r.status + ').' });
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) return json({ ok: false, error: 'Calendrier trop volumineux.' });
      const text = new TextDecoder().decode(buf);
      if (!/BEGIN:VCALENDAR/.test(text)) return json({ ok: false, error: 'Ce lien ne renvoie pas un calendrier.' });
      return json({ ok: true, text });
    }
    return json({ ok: false, error: 'Trop de redirections.' });
  } catch (e) {
    return json({ ok: false, error: (e as Error).name === 'AbortError' ? 'Le calendrier met trop de temps à répondre.' : 'Lecture impossible.' });
  } finally {
    clearTimeout(timer);
  }
}

async function feed(token: string): Promise<Response> {
  const notFound = () => new Response('Lien d’abonnement inconnu ou désactivé.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (!/^[A-Za-z0-9]{24,64}$/.test(token) || !SERVICE) return notFound();
  const q = BASE + '/rest/v1/lamia_data?select=doc&limit=2&doc->settings->calendar->>feedToken=eq.' + encodeURIComponent(token);
  const r = await fetch(q, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } });
  if (!r.ok) return new Response('Indisponible pour le moment.', { status: 503 });
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length !== 1) return notFound();
  const doc = rows[0].doc;
  const name = doc && doc.profile && doc.profile.name ? 'Échéances · ' + doc.profile.name : 'Mes échéances';
  return new Response(ICS.build(doc, { name }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': 'inline; filename="echeances.ics"' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  if (req.method === 'GET' && u.searchParams.has('ping')) return json({ ok: true, version: 1 });
  if (req.method === 'GET' && u.searchParams.get('feed')) return feed(u.searchParams.get('feed') ?? '');
  if (req.method === 'POST') return readCalendar(req);
  return json({ ok: false, error: 'Requête inconnue.' }, 400);
});
