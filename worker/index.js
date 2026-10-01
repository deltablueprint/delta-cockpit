// Delta Blueprint Cockpit — worker
//
// Twee regels die hier worden afgedwongen en nergens anders:
//   1. Er is geen DELETE-route. Niets wordt verwijderd (uitgangspunt 2).
//   2. Authenticatie is per persoon: e-mailadres plus wachtwoord. Elke
//      schrijfactie draagt een identiteit (BOUWSPEC 11). Geen gedeelde sleutel.

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extraKoppen = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...JSON_HEADERS, ...extraKoppen } });
}

async function sha256hex(tekst) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Wie is dit? Geeft de gebruiker terug, of null.
//
// Aanmelden gaat met e-mailadres en wachtwoord, meegestuurd als HTTP Basic:
//   Authorization: Basic base64("simon@deltablueprint.nl:wachtwoord")
// Het wachtwoord staat nergens opgeslagen — alleen de SHA-256 hash ervan.
// Het e-mailadres is de gebruikersnaam; het wachtwoord kan wijzigen zonder
// dat de identiteit verandert.
function gelijkInVasteTijd(a, b) {
  if (a.length !== b.length) return false;
  let verschil = 0;
  for (let i = 0; i < a.length; i++) verschil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return verschil === 0;
}

async function wieIsDit(request, env) {
  const kop = request.headers.get("authorization") || "";
  if (!kop.startsWith("Basic ")) return null;

  let ontcijferd;
  try {
    ontcijferd = atob(kop.slice(6).trim());
  } catch {
    return null;
  }
  const scheiding = ontcijferd.indexOf(":");
  if (scheiding < 1) return null;

  const email = ontcijferd.slice(0, scheiding).trim().toLowerCase();
  const wachtwoord = ontcijferd.slice(scheiding + 1);
  if (!email || !wachtwoord) return null;

  const gebruiker = await env.DB.prepare(
    "select id, naam, korte_naam, email, wachtwoord_hash from gebruiker where lower(email) = ? and actief = 1"
  ).bind(email).first();

  if (!gebruiker || !gebruiker.wachtwoord_hash) return null;

  const hash = await sha256hex(wachtwoord);
  if (!gelijkInVasteTijd(hash, gebruiker.wachtwoord_hash)) return null;

  return { id: gebruiker.id, naam: gebruiker.naam, korte_naam: gebruiker.korte_naam, email: gebruiker.email };
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
        return json({ fout: "Niet herkend. Meld je aan met je e-mailadres en wachtwoord." }, 401, { "www-authenticate": 'Basic realm="Delta Blueprint Cockpit", charset="UTF-8"' });
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
