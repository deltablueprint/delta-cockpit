# Delta-proxy uitbreiding · `/api/veto` en `/api/docs`

De nieuwe Cockpit-functies (gedeelde veto's + document-uploads) hebben twee nieuwe
endpoints nodig op de **delta-proxy** worker (`delta-proxy.dejonghe-simon.workers.dev`).

## Wat de endpoints doen

| Endpoint | Methode | Doel |
|---|---|---|
| `/api/veto` | GET | Actieve veto + logboek ophalen (zichtbaar voor iedereen) |
| `/api/veto` | PUT | Veto + logboek opslaan (JSON: `{veto, log}`) |
| `/api/docs?key=…` | GET | Eén document ophalen (JSON: `{name, type, dataUrl, ts, who}`) |
| `/api/docs?key=…` | PUT | Eén document opslaan (zelfde JSON, max ~11 MB base64) |

De client gebruikt keys als `vetodoc-<timestamp>` (veto-bijlagen) en
`doc-<inzending-id>-pre` / `doc-<inzending-id>-post` (Pre-Analyse / Post-Mortem).

## Stappen in het Cloudflare-dashboard

1. Ga naar **Workers & Pages → delta-proxy → Edit code**.
2. Zoek in de bestaande code de plek waar de andere routes worden afgehandeld
   (daar staan al blokken voor `/api/puts`, `/api/avatars`, `/api/profiles`, …).
3. Plak het codeblok hieronder **naast die bestaande routes** (zelfde niveau).
4. **Belangrijk — twee namen overnemen uit de bestaande code:**
   - Vervang `env.KV` door de KV-binding die de bestaande routes gebruiken
     (kijk hoe `/api/puts` zijn data leest/schrijft — bv. `env.KV`, `env.DB`, `env.DELTA`).
   - Gebruik voor de PUT-routes **dezelfde auth-controle** als bij `/api/puts` PUT
     (er is een bestaande functie/blok dat de `Authorization: Bearer`-header valideert —
     roep die ook hier aan). GET mag open blijven, net zoals `/api/avatars` GET.
5. Klik **Save and deploy**.

## Codeblok

```js
// ── Gedeelde marktintuïtie-veto (zichtbaar voor alle gebruikers) ──
if (url.pathname === '/api/veto') {
  const KEY = 'veto:shared';
  if (request.method === 'GET') {
    const raw = await env.KV.get(KEY);                       // ← zelfde KV-binding als /api/puts
    return new Response(raw || '{"veto":null,"log":[]}', {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  if (request.method === 'PUT') {
    // ← hier dezelfde auth-check aanroepen als bij PUT /api/puts (401 bij ongeldige token)
    const body = await request.text();
    if (body.length > 512 * 1024) return new Response('too large', { status: 413, headers: corsHeaders });
    try { JSON.parse(body); } catch (e) { return new Response('bad json', { status: 400, headers: corsHeaders }); }
    await env.KV.put(KEY, body);
    return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

// ── Gedeelde documenten: veto-bijlagen + Pre-Analyse / Post-Mortem per positie ──
if (url.pathname === '/api/docs') {
  const key = url.searchParams.get('key') || '';
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(key)) return new Response('bad key', { status: 400, headers: corsHeaders });
  const KEY = 'doc:' + key;
  if (request.method === 'GET') {
    const raw = await env.KV.get(KEY);                       // ← zelfde KV-binding als /api/puts
    if (!raw) return new Response('not found', { status: 404, headers: corsHeaders });
    return new Response(raw, { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
  if (request.method === 'PUT') {
    // ← hier dezelfde auth-check aanroepen als bij PUT /api/puts (401 bij ongeldige token)
    const body = await request.text();
    if (body.length > 12 * 1024 * 1024) return new Response('too large', { status: 413, headers: corsHeaders });
    try { JSON.parse(body); } catch (e) { return new Response('bad json', { status: 400, headers: corsHeaders }); }
    await env.KV.put(KEY, body);
    return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
```

### Als de bestaande worker geen `corsHeaders`-variabele heeft

Kijk hoe de bestaande routes hun response-headers zetten en neem dat over
(vaak staat er zoiets als `'Access-Control-Allow-Origin': '*'`). De nieuwe routes
moeten dezelfde CORS-headers meesturen als de rest, anders blokkeert de browser ze.

### Testen

Na deploy, in de browser:

- `https://delta-proxy.dejonghe-simon.workers.dev/api/veto` → moet `{"veto":null,"log":[]}` geven.
- In de Cockpit: veto zetten → in een tweede browser/incognito als andere gebruiker inloggen → de veto (met naam) moet daar binnen ±1 minuut verschijnen.
- In Overview: bij een eigen positie een Pre-Analyse uploaden → knop wordt groen; klikken opent het document — ook bij een andere gebruiker.

### Fallback-gedrag zonder deze endpoints

Zolang de endpoints nog niet bestaan, blijft alles werken zoals vroeger:
de veto wordt dan enkel lokaal (per browser) bewaard en bij document-uploads
toont de app een duidelijke foutmelding met verwijzing naar dit endpoint.
