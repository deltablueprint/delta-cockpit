// Lezen uit een tabel. Welke tabellen en kolommen bestaan, komt uit de
// definitielaag — niet uit de URL. Daarmee kan een verzoek nooit een kolom
// of tabel bereiken die niet gedefinieerd is.

const MAX = 200;

export async function lijst(env, tabelnaam, params) {
  const tabel = await env.DB.prepare(
    "select * from db_table where naam = ? and actief = 1"
  ).bind(tabelnaam).first();
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const velden = (await env.DB.prepare(
    "select * from db_field where tabel = ? and actief = 1 order by volgorde"
  ).bind(tabelnaam).all()).results;
  if (!velden.length) return { fout: `Tabel ${tabelnaam} heeft nog geen velden.`, status: 404 };

  const kolomnamen = velden.map((v) => v.kolom);
  const bestaat = (k) => kolomnamen.includes(k);

  // welke kolommen toont de lijst
  const weergave = await env.DB.prepare(
    "select * from db_view where tabel = ? and naam = 'standaard' and actief = 1"
  ).bind(tabelnaam).first();
  let kolommen = weergave ? JSON.parse(weergave.kolommen).filter(bestaat) : kolomnamen.slice(0, 7);

  // ---- waar ----
  const waar = [];
  const binden = [];

  if (bestaat("archief") || true) {
    // archiefkolom bestaat op inhoudelijke tabellen; alleen dan filteren
    const heeftArchief = await kolomBestaatInDb(env, tabelnaam, "archief");
    if (heeftArchief && params.get("archief") !== "alles") {
      waar.push("archief = 0");
    }
  }

  // Filter per kolom:  ?f.status=afgesloten
  // Wat iemand intypt is wat hij op het scherm ziet staan, niet wat er in de
  // database staat. Daarom vertaalt elk type zijn eigen invoer:
  //   tekst      → bevat
  //   keuze      → het label waarop gezocht wordt, omgezet naar de waarden
  //   datum/tijd → bevat, op de opgeslagen jjjj-mm-dd, met maandnamen vertaald
  for (const [sleutel, ingetypt] of params) {
    if (!sleutel.startsWith("f.")) continue;
    const kolom = sleutel.slice(2);
    const veld = velden.find((v) => v.kolom === kolom);
    if (!veld || !ingetypt.trim()) continue;
    const zoekterm = ingetypt.trim();

    if (veld.type === "keuze") {
      const keuzes = (await env.DB.prepare(
        "select waarde, label from db_choice where tabel = ? and kolom = ? and actief = 1"
      ).bind(tabelnaam, kolom).all()).results;
      const passend = keuzes
        .filter((k) => k.label.toLowerCase().includes(zoekterm.toLowerCase())
                    || k.waarde.toLowerCase().includes(zoekterm.toLowerCase()))
        .map((k) => k.waarde);
      if (passend.length) {
        waar.push(`"${kolom}" in (${passend.map(() => "?").join(", ")})`);
        binden.push(...passend);
      } else {
        waar.push("1 = 0");   // niets komt overeen: dan ook geen regels
      }
      continue;
    }

    if (veld.type === "datum" || veld.type === "tijdstip") {
      const patronen = datumPatronen(zoekterm);
      if (!patronen.length) continue;
      waar.push("(" + patronen.map(() => `"${kolom}" like ?`).join(" or ") + ")");
      binden.push(...patronen);
      continue;
    }

    if (["tekst", "lang"].includes(veld.type)) {
      waar.push(`"${kolom}" like ?`);
      binden.push(`%${zoekterm}%`);
      continue;
    }

    waar.push(`"${kolom}" = ?`);
    binden.push(zoekterm);
  }

  // vrij zoeken over de tekstkolommen
  const zoek = (params.get("q") || "").trim();
  if (zoek) {
    const tekstkolommen = velden
      .filter((v) => ["tekst", "lang", "keuze"].includes(v.type))
      .map((v) => v.kolom);
    if (tekstkolommen.length) {
      waar.push("(" + tekstkolommen.map((k) => `"${k}" like ?`).join(" or ") + ")");
      tekstkolommen.forEach(() => binden.push(`%${zoek}%`));
    }
  }

  const waarSql = waar.length ? "where " + waar.join(" and ") : "";

  // ---- sorteren ----
  let sorteer = params.get("sorteer");
  let richting = (params.get("richting") || "").toLowerCase() === "desc" ? "desc" : "asc";
  let orderSql;
  if (sorteer && bestaat(sorteer)) {
    orderSql = `order by "${sorteer}" ${richting}`;
  } else if (weergave && weergave.sortering) {
    orderSql = `order by ${veiligeSortering(weergave.sortering, bestaat)}`;
  } else {
    orderSql = "order by id desc";
  }

  // ---- paginering ----
  const limiet = Math.min(parseInt(params.get("limiet") || "50", 10) || 50, MAX);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

  // De revisie gaat mee zodat bewerken in de lijst kan zien of iemand anders
  // het record intussen heeft gewijzigd.
  const heeftRevisie = await kolomBestaatInDb(env, tabelnaam, "revisie");
  const selectie = ["id", ...(heeftRevisie ? ["revisie"] : []), ...kolommen.filter((k) => k !== "id")]
    .map((k) => `"${k}"`).join(", ");

  const [rijen, telling] = await Promise.all([
    env.DB.prepare(`select ${selectie} from "${tabelnaam}" ${waarSql} ${orderSql} limit ? offset ?`)
      .bind(...binden, limiet, offset).all(),
    env.DB.prepare(`select count(*) as n from "${tabelnaam}" ${waarSql}`).bind(...binden).first(),
  ]);

  return {
    tabel: { naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv,
             titel_veld: tabel.titel_veld, import_toegestaan: tabel.import_toegestaan,
             nieuw_vanuit_lijst: tabel.nieuw_vanuit_lijst },
    kolommen: kolommen.map((k) => velden.find((v) => v.kolom === k)),
    rijen: rijen.results,
    totaal: telling.n,
    limiet,
    offset,
  };
}

function veiligeSortering(sortering, bestaat) {
  // "geopend_op desc" → alleen toestaan als de kolom gedefinieerd is
  const [kolom, richting] = sortering.trim().split(/\s+/);
  if (!bestaat(kolom)) return "id desc";
  return `"${kolom}" ${(richting || "").toLowerCase() === "desc" ? "desc" : "asc"}`;
}

// ---------------------------------------------------------------- datums
// Wat iemand intypt in een datumkolom is zelden een complete datum. Deze
// functie leest er jaar, maand en dag uit — in welke volgorde en notatie ook —
// en maakt er een patroon van waarin het onbekende deel een joker is:
//
//   "2026"          → 2026-__-__      "jul"          → ____-07-__
//   "202607"        → 2026-07-__      "jul 2026"     → 2026-07-__
//   "2026-07"       → 2026-07-__      "6 jul 2026"   → 2026-07-06
//   "6/7/2026"      → 2026-07-06      "20260706"     → 2026-07-06
//   "7"             → ____-07-__ of ____-__-07 (maand of dag)
//
// Lukt dat niet, dan zoeken we gewoon op de letterlijke tekst.
const MAANDNAMEN = [
  ["jan","januari"], ["feb","februari"], ["mrt","maart","maa"], ["apr","april"],
  ["mei"], ["jun","juni"], ["jul","juli"], ["aug","augustus"],
  ["sep","september","sept"], ["okt","oktober"], ["nov","november"], ["dec","december"],
];

function maandUitWoord(woord) {
  const w = woord.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (MAANDNAMEN[i].some((naam) => naam.startsWith(w) || w.startsWith(naam))) return i + 1;
  }
  return null;
}

const vul = (n, lengte) => String(n).padStart(lengte, "0");

export function datumPatronen(invoer) {
  const t = invoer.trim().toLowerCase();
  if (!t) return [];

  let jaar = null, maand = null, dag = null;
  const losseGetallen = [];

  for (const stuk of t.split(/[\s./-]+/).filter(Boolean)) {
    if (/^\d+$/.test(stuk)) {
      if (stuk.length === 8) { jaar = +stuk.slice(0, 4); maand = +stuk.slice(4, 6); dag = +stuk.slice(6, 8); }
      else if (stuk.length === 6) { jaar = +stuk.slice(0, 4); maand = +stuk.slice(4, 6); }
      else if (stuk.length === 4) { jaar = +stuk; }
      else losseGetallen.push(+stuk);
    } else {
      const m = maandUitWoord(stuk);
      if (m) maand = m; else return [`%${t}%`];   // onbekend woord: letterlijk zoeken
    }
  }

  // Losse getallen plaatsen: wat al bekend is bepaalt wat het overige betekent.
  if (losseGetallen.length === 1) {
    const n = losseGetallen[0];
    if (maand !== null) dag = n;
    else if (jaar !== null) { if (n >= 1 && n <= 12) maand = n; else dag = n; }
    else if (n <= 12) return [`____-${vul(n, 2)}-__%`, `____-__-${vul(n, 2)}%`];
    else dag = n;
  } else if (losseGetallen.length >= 2) {
    // twee getallen zonder maandnaam: dag en maand, in die volgorde (6 7 = 6 juli)
    const [a, b] = losseGetallen;
    if (a > 12 && b <= 12) { dag = a; maand = b; }
    else if (b > 12 && a <= 12) { maand = a; dag = b; }
    else { dag = a; maand = maand ?? b; }
  }

  if (maand !== null && (maand < 1 || maand > 12)) return [`%${t}%`];
  if (dag !== null && (dag < 1 || dag > 31)) return [`%${t}%`];
  if (jaar === null && maand === null && dag === null) return [`%${t}%`];

  return [`${jaar ?? "____"}-${maand === null ? "__" : vul(maand, 2)}-${dag === null ? "__" : vul(dag, 2)}%`];
}

async function kolomBestaatInDb(env, tabel, kolom) {
  const r = await env.DB.prepare(`select count(*) as n from pragma_table_info(?) where name = ?`)
    .bind(tabel, kolom).first();
  return r && r.n > 0;
}
