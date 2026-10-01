// Delta Blueprint Cockpit — worker
//
// Twee regels die hier worden afgedwongen en nergens anders:
//   1. Er is geen DELETE-route. Niets wordt verwijderd (uitgangspunt 2).
//   2. Authenticatie is per persoon. Elke schrijfactie draagt een identiteit
//      (BOUWSPEC 11). Er is geen gedeelde sleutel.

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: JSON_HEADERS });
}

async function sha256hex(tekst) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Wie is dit? Geeft de gebruiker terug, of null.
// De sleutel komt mee als  Authorization: Bearer <sleutel>  en wordt gehasht
// vergeleken. De sleutel zelf staat nergens opgeslagen.
async function wieIsDit(request, env) {
  const kop = request.headers.get("authorization") || "";
  const sleutel = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!sleutel) return null;
  const hash = await sha256hex(sleutel);
  return await env.DB.prepare(
    "select id, naam, korte_naam from gebruiker where sleutel_hash = ? and actief = 1"
  ).bind(hash).first();
}

// /api/meta — de applicatie leest hier haar eigen vorm.
async function meta(env) {
  const [tabellen, velden, keuzes, modules, weergaven, versie] = await Promise.all([
    env.DB.prepare("select * from db_table where actief = 1 order by volgorde, label").all(),
    env.DB.prepare("select * from db_field where actief = 1 order by tabel, volgorde").all(),
    env.DB.prepare("select * from db_choice where actief = 1 order by tabel, kolom, volgorde").all(),
    env.DB.prepare("select * from db_module where actief = 1 order by volgorde").all(),
    env.DB.prepare("select * from db_view where actief = 1").all(),
    env.DB.prepare("select * from configuratieversie order by nummer desc limit 1").first(),
  ]);

  // Het menu komt gegroepeerd terug, in de volgorde van db_module.
  const groepen = [];
  for (const m of modules.results) {
    let g = groepen.find((x) => x.groep === m.groep);
    if (!g) groepen.push((g = { groep: m.groep, items: [] }));
    g.items.push({
      label: m.label,
      tabel: m.doeltabel,
      route: m.route || (m.doeltabel ? `/t/${m.doeltabel}` : null),
      filter: m.standaardfilter,
    });
  }

  const velden_per_tabel = {};
  for (const v of velden.results) (velden_per_tabel[v.tabel] ||= []).push(v);

  const keuzes_per_veld = {};
  for (const k of keuzes.results) (keuzes_per_veld[`${k.tabel}.${k.kolom}`] ||= []).push(k);

  return {
    configuratieversie: versie,
    menu: groepen,
    tabellen: tabellen.results.map((t) => ({
      ...t,
      velden: velden_per_tabel[t.naam] || [],
    })),
    keuzes: keuzes_per_veld,
    weergaven: weergaven.results,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pad = url.pathname;

    if (request.method === "DELETE") {
      return json({ fout: "Er is geen DELETE-route. Records worden gearchiveerd, niet verwijderd." }, 405);
    }

    // Open: zegt alleen of de boel draait.
    if (pad === "/api/gezondheid") {
      let db = "niet bereikbaar";
      try {
        const r = await env.DB.prepare("select versie from schema_versie order by versie desc limit 1").first();
        db = r ? `schema versie ${r.versie}` : "leeg";
      } catch (e) {
        db = `fout: ${e.message}`;
      }
      return json({ ok: true, omgeving: env.OMGEVING, database: db, tijd: new Date().toISOString() });
    }

    // Alles onder /api/ vraagt om een persoon.
    if (pad.startsWith("/api/")) {
      const ik = await wieIsDit(request, env);
      if (!ik) {
        return json({ fout: "Niet herkend. Stuur je sleutel mee als Authorization: Bearer <sleutel>." }, 401);
      }

      if (pad === "/api/meta") return json(await meta(env));

      if (pad === "/api/ik") return json(ik);

      return json({ fout: `Onbekend eindpunt: ${pad}` }, 404);
    }

    return new Response("Delta Blueprint Cockpit", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
