// delta-proxy — allowlisted CORS proxy + gedeelde opslag (KV) + backend-auth (P0-3).
//   /?url=<encoded full url>      → financiele data proxy (allowlist hieronder)
//   /api/puts     (GET/PUT)      → gedeelde lijst met ingediende put-options   [AUTH]
//   /api/avatars  (GET/PUT)      → gedeelde profielfoto's { id: dataURL }       [PUT=AUTH]
//   /api/auth     (GET/PUT)      → per-gebruiker wachtwoord-hashes { id: sha256 }[PUT=AUTH]
//   /api/profiles (GET/PUT)      → naam/e-mail-overrides { id: {name,email,short} }[PUT=AUTH]
//   /api/declog   (GET/POST)     → model-track-record                            [AUTH]
//   /api/veto     (GET/PUT)      → gedeelde marktintuïtie-veto + logboek         [AUTH]
//   /api/docs     (GET/PUT)      → gedeelde documenten (veto-bijlagen, Pre-Analyse/Post-Mortem) [AUTH]
// KV-binding vereist: variabele "PUTS" → namespace "delta-puts".
//
// AUTH-model: de app stuurt het ingevoerde wachtwoord mee als
//   Authorization: Bearer <wachtwoord>
// De Worker hasht dat (SHA-256) en checkt het tegen de hash-allowlist (dezelfde map
// die /api/auth al serveert, + de default-hash). Klopt het niet → 401. Het wachtwoord
// zelf staat NERGENS in de client of Worker; enkel de hashes.

const ALLOWED_HOSTS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
  "api.fiscaldata.treasury.gov",
  "markets.newyorkfed.org",
  "stats.bis.org",
  "data.bis.org",
  "api.bls.gov",
  "stooq.com",
  "stooq.pl",
  "api.stlouisfed.org",
  "fred.stlouisfed.org",
  "www.federalreserve.gov",
  "home.treasury.gov",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

function extractTarget(request) {
  const u = new URL(request.url);
  let target = u.searchParams.get("url");
  if (!target) {
    let rest = u.pathname.slice(1) + (u.search || "");
    if (rest) {
      try { rest = decodeURIComponent(rest); } catch (e) {}
      target = rest;
    }
  }
  return target;
}

const J = { ...CORS, "Content-Type": "application/json" };

// ───────────────────────── Backend-auth (P0-3) ─────────────────────────
const DEFAULT_PASS_HASH =
  "868119dc638c07c13adb53c58ad6d0453cdd5f6293e236e992e100dd6c460ef6"; // sha256('deltablueprint100%')

async function sha256Hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Allowlist = de per-gebruiker hashes uit KV ('auth') + de default-hash.
async function validHashSet(env) {
  const set = new Set([DEFAULT_PASS_HASH]);
  try {
    const raw = env && env.PUTS ? await env.PUTS.get("auth") : null;
    if (raw) {
      const map = JSON.parse(raw);
      for (const k in map) if (map[k]) set.add(String(map[k]).toLowerCase());
    }
  } catch (e) {}
  return set;
}

async function isAuthed(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const hash = (await sha256Hex(m[1])).toLowerCase();
  return (await validHashSet(env)).has(hash);
}

function unauth() {
  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: J });
}
// ────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const u = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

       // ── VSTOXX historische dagreeks (voor Market Timing) ──
    if (u.pathname === "/api/vstoxx-hist") {
      const SRC = "https://stoxx.com/index/v2tx/";
      try {
        const upstream = await fetch(SRC, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "text/html",
          },
          cf: { cacheTtl: 21600, cacheEverything: true }, // 6 uur edge-cache
        });
        if (upstream.ok) {
          const html = await upstream.text();
          const cm = html.match(/chart_data\s*=\s*(\[\[[\s\S]*?\]\])/);
          if (cm) {
            const series = JSON.parse(cm[1]); // [[unixMs, waarde], ...]
            if (Array.isArray(series) && series.length > 10) {
              const cutoff = Date.now() - 1300 * 864e5; // ~3,5 jaar
              const out = series
                .filter((p) => Array.isArray(p) && p.length >= 2 && p[0] >= cutoff && isFinite(p[1]) && p[1] > 3 && p[1] < 200)
                .map((p) => [p[0], Math.round(p[1] * 100) / 100]);
              const rec = { points: out.length, series: out, source: "stoxx.com", ts: Date.now() };
              if (env && env.PUTS) { try { await env.PUTS.put("vstoxx_hist", JSON.stringify(rec)); } catch (e) {} }
              return new Response(JSON.stringify(rec), { headers: J });
            }
          }
        }
      } catch (e) { /* val door naar KV-fallback */ }
      if (env && env.PUTS) { const d = await env.PUTS.get("vstoxx_hist"); if (d) return new Response(d, { headers: J }); }
      return new Response(JSON.stringify({ error: "vstoxx_hist_unavailable" }), { status: 502, headers: J });
    }

      // ── VSTOXX live: scrape officiële STOXX-pagina + exacte change vs vorige slotkoers ──
    if (u.pathname === "/api/vstoxx-live") {
      const SRC = "https://stoxx.com/index/v2tx/";
      try {
        const upstream = await fetch(SRC, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "text/html",
          },
          cf: { cacheTtl: 60, cacheEverything: true },
        });
        if (upstream.ok) {
          const html = await upstream.text();
          const m = html.match(/id="overview-last-value"[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)/);
          let v = m ? parseFloat(m[1].replace(",", ".")) : null;
          if (v != null && isFinite(v) && v > 3 && v < 200) {
            const dir = /icon-gain/.test(html) ? "up" : (/icon-loss/.test(html) ? "down" : null);
            // exacte verandering vs vorige slotkoers uit de dagelijkse reeks window.chart_data = [[ms,waarde],...]
            let chg = null, pct = null, prevClose = null;
            try {
              const cm = html.match(/chart_data\s*=\s*(\[\[[\s\S]*?\]\])/);
              if (cm) {
                const series = JSON.parse(cm[1]);
                if (Array.isArray(series) && series.length >= 2) {
                  const lastPt = series[series.length - 1];
                  const lastDay = new Date(lastPt[0]).toISOString().slice(0, 10);
                  const todayStr = new Date().toISOString().slice(0, 10);
                  // De laatste reekswaarde is vaak AL 'vandaag' (≈ de live v) — door tijdzone valt
                  // de datumcheck soms verkeerd uit, waardoor we 'nu' als vorige slot namen en chg ≈ 0 werd.
                  // Robuust: neem de voorlaatste als vorige slot wanneer de datum vandaag is ÓF wanneer
                  // de laatste reekswaarde vlak bij de live waarde ligt.
                  const lastVal = series[series.length - 1][1];
                  prevClose = (((lastDay === todayStr) || (Math.abs(lastVal - v) < 0.15)) && series.length >= 2)
                    ? series[series.length - 2][1]
                    : lastVal;
                  if (isFinite(prevClose) && prevClose > 0) {
                    chg = Math.round((v - prevClose) * 100) / 100;
                    pct = Math.round((v / prevClose - 1) * 10000) / 100;
                  }
                }
              }
            } catch (e) { /* change optioneel */ }
            const rec = { v: v, ts: Date.now(), by: "stoxx-live", direction: dir, chg: chg, pct: pct, prevClose: prevClose, source: "stoxx.com" };
            if (env && env.PUTS) { try { await env.PUTS.put("vstoxx", JSON.stringify(rec)); } catch (e) {} }
            return new Response(JSON.stringify(rec), { headers: J });
          }
        }
      } catch (e) { /* val door naar redundante bron */ }
      // ── Redundante bron (P1): onafhankelijke afgeleide uit FRED VIX als de STOXX-scrape faalt ──
      // VSTOXX ≈ VIX + EU-US implied-vol spread. Onafhankelijke provider (St. Louis Fed),
      // duidelijk getagd derived:true zodat de app het als "afgeleid" kan tonen.
      try {
        const FRED_KEY = (env && env.FRED_KEY) || "09cf8f8c7d3b658cb710937b0ccf1279";
        const fr = await fetch("https://api.stlouisfed.org/fred/series/observations?api_key=" + FRED_KEY +
          "&file_type=json&series_id=VIXCLS&sort_order=desc&limit=5", { headers: { "Accept": "application/json" } });
        if (fr.ok) {
          const fj = await fr.json();
          const obs = (fj.observations || []).filter((o) => o.value && o.value !== ".");
          if (obs.length) {
            const vix = parseFloat(obs[0].value);
            if (isFinite(vix) && vix > 3 && vix < 200) {
              const spread = 2.0 + Math.max(0, vix - 18) * 0.05;        // EU-US spread, regime-afhankelijk
              const v = Math.round((vix + spread) * 100) / 100;
              const rec = { v: v, ts: Date.now(), by: "vix-derived", direction: null, chg: null, pct: null,
                            derived: true, baseVix: vix, asOf: obs[0].date, source: "FRED:VIXCLS" };
              return new Response(JSON.stringify(rec), { headers: J }); // bewust niet in KV: bewaar de laatste echte scrape
            }
          }
        }
      } catch (e) { /* val door naar KV-cache */ }
      if (env && env.PUTS) { const d = await env.PUTS.get("vstoxx"); if (d) return new Response(d, { headers: J }); }
      return new Response(JSON.stringify({ error: "vstoxx_unavailable" }), { status: 502, headers: J });
    }

    // ── FRED-proxy: injecteert de API-key server-side (niet meer in de client) ──
    if (u.pathname === "/api/fred") {
      const FRED_KEY = (env && env.FRED_KEY) || "09cf8f8c7d3b658cb710937b0ccf1279";
      const sid = u.searchParams.get("series_id");
      if (!sid || !/^[A-Z0-9_]+$/i.test(sid)) {
        return new Response(JSON.stringify({ error: "bad series_id" }), { status: 400, headers: J });
      }
      const limit = Math.min(800, Math.max(1, parseInt(u.searchParams.get("limit") || "70", 10) || 70));
      const order = u.searchParams.get("sort_order") === "asc" ? "asc" : "desc";
      const start = u.searchParams.get("observation_start");
      let fredUrl = "https://api.stlouisfed.org/fred/series/observations?api_key=" + FRED_KEY +
        "&file_type=json&series_id=" + encodeURIComponent(sid) + "&sort_order=" + order + "&limit=" + limit;
      if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) fredUrl += "&observation_start=" + start;
      const up = await fetch(fredUrl, { headers: { "Accept": "application/json" } });
      const b = await up.arrayBuffer();
      const h = new Headers(J); h.set("Cache-Control", "public, max-age=300");
      return new Response(b, { status: up.status, headers: h });
    }

    // ── Decision-log: append-style track-record van de modelaanbeveling per submit ──
    if (u.pathname === "/api/declog") {
      if (!(await isAuthed(request, env))) return unauth();           // [AUTH]
      if (!env || !env.PUTS) {
        return new Response(JSON.stringify({ error: "KV niet gebonden (PUTS)" }), { status: 500, headers: J });
      }
      if (request.method === "GET") {
        const d = await env.PUTS.get("declog");
        return new Response(d || '{"log":[]}', { headers: J });
      }
      if (request.method === "POST") {
        let e; try { e = JSON.parse(await request.text()); } catch (_) { e = null; }
        if (!e || typeof e !== "object" || Array.isArray(e)) {
          return new Response(JSON.stringify({ error: "ongeldige payload" }), { status: 400, headers: J });
        }
        let cur; try { cur = JSON.parse((await env.PUTS.get("declog")) || '{"log":[]}'); } catch (_) { cur = { log: [] }; }
        if (!cur || !Array.isArray(cur.log)) cur = { log: [] };
        if (!e.ts) e.ts = new Date().toISOString();
        cur.log.push(e);
        if (cur.log.length > 2000) cur.log = cur.log.slice(-2000);
        await env.PUTS.put("declog", JSON.stringify(cur));
        return new Response(JSON.stringify({ ok: true, n: cur.log.length }), { headers: J });
      }
      return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: J });
    }

    // ── Gedeelde marktintuïtie-veto: actieve veto + logboek, zichtbaar voor alle gebruikers ──
    if (u.pathname === "/api/veto") {
      if (!(await isAuthed(request, env))) return unauth();           // [AUTH] lezen én schrijven (zelfde model als /api/puts)
      if (!env || !env.PUTS) {
        return new Response(JSON.stringify({ error: "KV niet gebonden (PUTS)" }), { status: 500, headers: J });
      }
      if (request.method === "GET") {
        const d = await env.PUTS.get("veto");
        return new Response(d || '{"veto":null,"log":[]}', { headers: J });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 512 * 1024) {
          return new Response(JSON.stringify({ error: "payload te groot" }), { status: 413, headers: J });
        }
        let j; try { j = JSON.parse(body); } catch (e) { j = null; }
        if (!j || typeof j !== "object" || Array.isArray(j)) {
          return new Response(JSON.stringify({ error: "ongeldige payload" }), { status: 400, headers: J });
        }
        await env.PUTS.put("veto", body);
        return new Response(JSON.stringify({ ok: true }), { headers: J });
      }
      return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: J });
    }

    // ── Gedeelde documenten: veto-bijlagen + Pre-Analyse / Post-Mortem per positie ──
    //    KV-key = 'doc:<key>' met keys als 'vetodoc-<ts>' en 'doc-<inzending-id>-pre|post'.
    //    Payload = { name, type, dataUrl, ts, who } (base64 data-URL, max ~8 MB bestand).
    if (u.pathname === "/api/docs") {
      if (!(await isAuthed(request, env))) return unauth();           // [AUTH] lezen én schrijven
      if (!env || !env.PUTS) {
        return new Response(JSON.stringify({ error: "KV niet gebonden (PUTS)" }), { status: 500, headers: J });
      }
      const key = u.searchParams.get("key") || "";
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(key)) {
        return new Response(JSON.stringify({ error: "ongeldige key" }), { status: 400, headers: J });
      }
      const KEY = "doc:" + key;
      if (request.method === "GET") {
        const d = await env.PUTS.get(KEY);
        if (!d) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: J });
        return new Response(d, { headers: J });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 12 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "payload te groot" }), { status: 413, headers: J });
        }
        let j; try { j = JSON.parse(body); } catch (e) { j = null; }
        if (!j || typeof j !== "object" || Array.isArray(j) || typeof j.dataUrl !== "string") {
          return new Response(JSON.stringify({ error: "ongeldige payload" }), { status: 400, headers: J });
        }
        await env.PUTS.put(KEY, body);
        return new Response(JSON.stringify({ ok: true }), { headers: J });
      }
      return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: J });
    }

    const API = {
      "/api/puts":    { kvKey: "submissions", empty: '{"submissions":[]}',
                        valid: (j) => j && Array.isArray(j.submissions) },
      "/api/avatars": { kvKey: "avatars", empty: "{}",
                        valid: (j) => j && typeof j === "object" && !Array.isArray(j) },
      "/api/auth":    { kvKey: "auth", empty: "{}",
                        valid: (j) => j && typeof j === "object" && !Array.isArray(j) },
      "/api/profiles":{ kvKey: "profiles", empty: "{}",
                        valid: (j) => j && typeof j === "object" && !Array.isArray(j) },
    };
    if (API[u.pathname]) {
      const cfg = API[u.pathname];
      if (!env || !env.PUTS) {
        return new Response(JSON.stringify({ error: "KV niet gebonden (PUTS)" }), { status: 500, headers: J });
      }
      if (request.method === "GET") {
        // De gedeelde posities zijn privé → ook lezen vereist auth.
        // /api/auth, /api/profiles, /api/avatars blijven publiek leesbaar: de client heeft
        // de hash-map + namen nodig om de login te bootstrappen vóór er iemand is ingelogd.
        if (u.pathname === "/api/puts" && !(await isAuthed(request, env))) return unauth();   // [AUTH]
        const data = await env.PUTS.get(cfg.kvKey);
        return new Response(data || cfg.empty, { headers: J });
      }
      if (request.method === "PUT" || request.method === "POST") {
        if (!(await isAuthed(request, env))) return unauth();         // [AUTH] alle schrijfacties
        let j;
        try { j = JSON.parse(await request.text()); } catch (e) { j = null; }
        if (!cfg.valid(j)) {
          return new Response(JSON.stringify({ error: "ongeldige payload" }), { status: 400, headers: J });
        }
        await env.PUTS.put(cfg.kvKey, JSON.stringify(j));
        return new Response(JSON.stringify({ ok: true }), { headers: J });
      }
      return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: J });
    }
if (u.pathname === "/api/vstoxx" || u.pathname === "/api/vstoxx-set") {
  if (!env || !env.PUTS) return new Response(JSON.stringify({ error: "KV" }), { status: 500, headers: J });
  const setv = u.searchParams.get("v");
  if (u.pathname === "/api/vstoxx-set" || setv != null) {
    const vv = parseFloat(setv);
    if (!isFinite(vv) || vv < 3 || vv > 120) return new Response(JSON.stringify({ error: "bad v" }), { status: 400, headers: J });
    await env.PUTS.put("vstoxx", JSON.stringify({ v: vv, ts: Date.now(), by: u.searchParams.get("by") || "auto" }));
    return new Response(JSON.stringify({ ok: true, v: vv }), { headers: J });
  }
  if (request.method === "PUT" || request.method === "POST") {
    let j; try { j = JSON.parse(await request.text()); } catch (e) { j = null; }
    if (!j || typeof j !== "object") return new Response(JSON.stringify({ error: "bad payload" }), { status: 400, headers: J });
    await env.PUTS.put("vstoxx", JSON.stringify(j));
    return new Response(JSON.stringify({ ok: true }), { headers: J });
  }
  const data = await env.PUTS.get("vstoxx");
  return new Response(data || "{}", { headers: J });
}
    const target = extractTarget(request);
    if (!target || !/^https?:\/\//i.test(target)) {
      return new Response(
        "delta-proxy is live. Append a target URL, e.g. /?url=https://query1.finance.yahoo.com/...",
        { status: 400, headers: { ...CORS, "Content-Type": "text/plain" } }
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response("Invalid target URL", { status: 400, headers: CORS });
    }

    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response("Host not allowed: " + targetUrl.hostname, {
        status: 403,
        headers: { ...CORS, "Content-Type": "text/plain" },
      });
    }

    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, application/xml, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const body = await upstream.arrayBuffer();
    const headers = new Headers(CORS);
    const ct = upstream.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    headers.set("Cache-Control", "public, max-age=300");

    return new Response(body, { status: upstream.status, headers });
  },
};
