/* ============================================================
   SUPER-ERIK — familjens topplista (Cloudflare Worker)

   Deploy (ca 5 minuter, allt i webbläsaren):
   1. Skapa gratis konto på dash.cloudflare.com
   2. Workers & Pages → Create → Worker → döp den t.ex. "supererik-topplista"
      → Deploy → Edit code → ersätt allt med DENNA fil → Deploy.
   3. Storage & Databases → KV → Create namespace → döp den "TOPPLISTA".
   4. Tillbaka på workern → Settings → Bindings → Add → KV namespace →
      Variable name: TOPPLISTA → välj ditt namespace → Save.
   5. Kopiera worker-adressen (https://supererik-topplista.DITTNAMN.workers.dev)
      och klistra in den i index.html på raden märkt API_BAS.

   API:
     GET  /topplista?spel=runner        → { lista: [{n,s,d,t}, ...max 100] }
     POST /topplista  {spel,n,s,d}      → { ok, plats, lista }
   ============================================================ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};
const json = (data, status) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
});

export default {
  async fetch(req, env){
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(req.url);
    if (url.pathname !== '/topplista') return json({ fel: 'okänd väg' }, 404);

    const spel = ((url.searchParams.get('spel') || 'runner').toLowerCase().replace(/[^a-z]/g, '') || 'runner').slice(0, 20);
    const KEY = 'lista:' + spel;

    if (req.method === 'GET'){
      const lista = (await env.TOPPLISTA.get(KEY, 'json')) || [];
      return json({ lista: lista.slice(0, 100) });
    }

    if (req.method === 'POST'){
      // enkel spam-broms: max 30 sparningar per minut och IP
      const ip = req.headers.get('cf-connecting-ip') || 'okänd';
      const rlKey = 'rl:' + ip + ':' + Math.floor(Date.now() / 60000);
      const hits = parseInt((await env.TOPPLISTA.get(rlKey)) || '0', 10) + 1;
      if (hits > 30) return json({ fel: 'lugn i backen — försök om en minut' }, 429);
      await env.TOPPLISTA.put(rlKey, String(hits), { expirationTtl: 120 });

      let body;
      try { body = await req.json(); } catch (e) { return json({ fel: 'ogiltig JSON' }, 400); }

      const n = String(body.n || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Hemlig löpare';
      const s = Math.floor(Number(body.s));
      const d = Math.floor(Number(body.d) || 0);
      // rimlighetsgränser — ingen i familjen springer 5 mil eller får en halv miljon poäng
      if (!Number.isFinite(s) || s < 0 || s > 500000 || d < 0 || d > 50000){
        return json({ fel: 'orimligt resultat' }, 400);
      }

      const lista = (await env.TOPPLISTA.get(KEY, 'json')) || [];
      const post = { n, s, d, t: Date.now() };
      lista.push(post);
      lista.sort((a, b) => b.s - a.s || a.t - b.t);
      const sparad = lista.slice(0, 200);
      await env.TOPPLISTA.put(KEY, JSON.stringify(sparad));

      const plats = sparad.indexOf(post) + 1; // 0 = utanför topp 200
      return json({ ok: true, plats: plats || null, lista: sparad.slice(0, 100) });
    }

    return json({ fel: 'metoden stöds inte' }, 405);
  }
};
