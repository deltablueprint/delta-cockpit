// Lezen uit een tabel. Welke tabellen en kolommen bestaan, komt uit de
// definitielaag — niet uit de URL. Daarmee kan een verzoek nooit een kolom
// of tabel bereiken die niet gedefinieerd is.

import { schermAf } from "./blind.js";

const MAX = 200;

export async function lijst(env, tabelnaam, params, ik) {
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

  // Gearchiveerde regels horen vindbaar te blijven: er wordt niets gewist, dus
  // moet je ook kunnen zien wát er is gearchiveerd. Een lijstscherm vraagt
  // daarom om alles en toont er een kolom 'Actief' bij; een gerelateerde lijst
  // onder een record toont alleen wat nog loopt.
  // Een lijstscherm vraagt om de kolom 'Actief' — of het nu alles wil zien of
  // alleen wat loopt. Standaard staat de lijst op wat actief is: wat
  // gearchiveerd is heb je bewust weggezet, en dat hoort niet elke dag tussen
  // je werk te staan. Het filter is wel weg te klikken, en dan zie je alles.
  const heeftArchief = await kolomBestaatInDb(env, tabelnaam, "archief");
  const gevraagd = params.get("archief");                 // null | 'actief' | 'alles'
  const toonArchief = heeftArchief && gevraagd !== null;  // een lijstscherm, geen related list
  // In de zoekregel van de kolom 'Actief' kies je true of false. Dat is geen
  // veld uit de definitielaag, dus de gewone filterlus komt er niet aan toe —
  // en dan lijkt het alsof de lijst je keuze negeert. Hier wel.
  //
  // Die keuze gaat vóór de stand van de lijst. Anders staat er naast de
  // standaard 'archief = 0' ook 'archief = 1' en blijft het scherm leeg, wat
  // leest als een kapot filter in plaats van als een tegenspraak.
  const actiefGezocht = (params.get("f.archief") || "").trim().toLowerCase();
  const wilActief = ["true", "waar", "ja", "actief", "1"].includes(actiefGezocht);
  const wilArchief = ["false", "onwaar", "nee", "archief", "0"].includes(actiefGezocht);

  if (heeftArchief && wilArchief) waar.push("archief = 1");
  else if (heeftArchief && wilActief) waar.push("archief = 0");
  else if (heeftArchief && gevraagd !== "alles") waar.push("archief = 0");

  // Filter per kolom:  ?f.status=afgesloten
  // Wat iemand intypt is wat hij op het scherm ziet staan, niet wat er in de
  // database staat. Daarom vertaalt elk type zijn eigen invoer:
  //   tekst      → bevat
  //   keuze      → het label waarop gezocht wordt, omgezet naar de waarden
  //   datum/tijd → bevat, op de opgeslagen jjjj-mm-dd, met maandnamen vertaald
  // Een vast filter op een verwijzing: ?fid.cyclus=3 — precies dat record,
  // niet 'bevat'. Zo filtert de lijst van voorwaarden op één cyclus, en zo
  // haalt een gerelateerde lijst zijn regels op.
  const idfilters = {};
  for (const [sleutel, waardeTekst] of params) {
    if (!sleutel.startsWith("fid.")) continue;
    const kolom = sleutel.slice(4);
    const veld = velden.find((v) => v.kolom === kolom && v.type === "verwijzing");
    const nummer = Number(waardeTekst);
    if (!veld || !Number.isFinite(nummer)) continue;
    waar.push(`"${kolom}" = ?`);
    binden.push(nummer);

    let naam = String(nummer);
    const doel = await env.DB.prepare("select naam, titel_veld, label from db_table where naam = ?")
      .bind(veld.verwijst_naar).first();
    if (doel) {
      try {
        const r = await env.DB.prepare(`select "${doel.titel_veld}" as titel from "${doel.naam}" where id = ?`)
          .bind(nummer).first();
        if (r && r.titel) naam = String(r.titel);
      } catch { /* geen titelveld: dan het nummer */ }
    }
    idfilters[kolom] = { waarde: nummer, label: naam, veldlabel: veld.label };
  }

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

    // Een ja/nee-kolom filter je met een keuzelijst, dus wat binnenkomt is 'ja'
    // of 'nee' — de woorden die op het scherm staan. In de database staat er 1
    // of 0, en 'bevat' zou daar niets mee vinden.
    if (veld.type === "ja_nee") {
      const t = zoekterm.toLowerCase();
      if (["ja", "true", "waar", "1"].includes(t)) waar.push(`"${kolom}" = 1`);
      else if (["nee", "false", "onwaar", "0"].includes(t)) waar.push(`coalesce("${kolom}", 0) = 0`);
      continue;
    }

    if (["tekst", "lang"].includes(veld.type)) {
      waar.push(`"${kolom}" like ?`);
      binden.push(`%${zoekterm}%`);
      continue;
    }

    // Een verwijzing toont een naam, dus daar wordt op gezocht — niet op het
    // nummer dat eronder zit.
    if (veld.type === "verwijzing" && veld.verwijst_naar) {
      const doel = await env.DB.prepare("select naam, titel_veld from db_table where naam = ?")
        .bind(veld.verwijst_naar).first();
      if (doel) {
        waar.push(`"${kolom}" in (select id from "${doel.naam}" where "${doel.titel_veld}" like ?)`);
        binden.push(`%${zoekterm}%`);
        continue;
      }
    }

    // Alles wat overblijft — getallen, ja/nee — zoekt op 'bevat' en niet op
    // 'is precies'. Zoeken op 7 hoort ook 70 te vinden: de 7 staat erin.
    waar.push(`cast("${kolom}" as text) like ?`);
    binden.push(`%${zoekterm}%`);
  }

  // vrij zoeken over de tekstkolommen
  const zoek = (params.get("q") || "").trim();
  if (zoek) {
    const zoekbaar = velden
      .filter((v) => !["bestand"].includes(v.type))
      .map((v) => v.kolom);
    if (zoekbaar.length) {
      waar.push("(" + zoekbaar.map((k) => `cast("${k}" as text) like ?`).join(" or ") + ")");
      zoekbaar.forEach(() => binden.push(`%${zoek}%`));
    }
  }

  // Een kolom waarop al gefilterd is op één record, zegt op elke rij hetzelfde.
  // In het exitplan ónder een tranche hoeft 'Tranche' er dus niet bij te staan;
  // in het overzicht over alle tranches heen juist wel. Dezelfde weergave,
  // zonder dat er twee van hoeven te bestaan.
  kolommen = kolommen.filter((k) => !idfilters[k]);

  const waarSql = waar.length ? "where " + waar.join(" and ") : "";

  // ---- sorteren ----
  let sorteer = params.get("sorteer");
  let richting = (params.get("richting") || "").toLowerCase() === "desc" ? "desc" : "asc";
  let orderSql;
  if (sorteer === "archief" && toonArchief) {
    orderSql = `order by "archief" ${richting}, id desc`;
  } else if (sorteer && bestaat(sorteer)) {
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
  const selectie = ["id", ...(heeftRevisie ? ["revisie"] : []),
                    ...(toonArchief ? ["archief"] : []),
                    ...kolommen.filter((k) => k !== "id" && k !== "archief")]
    .map((k) => `"${k}"`).join(", ");

  const [rijen, telling] = await Promise.all([
    env.DB.prepare(`select ${selectie} from "${tabelnaam}" ${waarSql} ${orderSql} limit ? offset ?`)
      .bind(...binden, limiet, offset).all(),
    env.DB.prepare(`select count(*) as n from "${tabelnaam}" ${waarSql}`).bind(...binden).first(),
  ]);

  // Een verwijzing toont een naam, geen nummer. Welke namen dat zijn, haalt
  // de lijst in één vraag per verwijzende kolom op.
  const verwijzingen = {};
  for (const veld of kolommen.map((k) => velden.find((v) => v.kolom === k))) {
    if (!veld || veld.type !== "verwijzing" || !veld.verwijst_naar) continue;
    if (veld.verwijst_naar === "gebruiker") continue;      // die komen uit meta
    const ids = [...new Set(rijen.results.map((r) => r[veld.kolom]).filter((w) => w !== null && w !== undefined))];
    if (!ids.length) continue;
    const doel = await env.DB.prepare("select naam, titel_veld from db_table where naam = ?")
      .bind(veld.verwijst_naar).first();
    if (!doel) continue;
    try {
      const namen = (await env.DB.prepare(
        `select id, "${doel.titel_veld}" as titel from "${doel.naam}" where id in (${ids.map(() => "?").join(", ")})`
      ).bind(...ids).all()).results;
      verwijzingen[veld.kolom] = Object.fromEntries(namen.map((n) => [n.id, n.titel]));
    } catch { /* tabel zonder titelveld: laat het nummer staan */ }
  }

  return {
    idfilters,
    verwijzingen,
    tabel: { naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv,
             titel_veld: tabel.titel_veld, import_toegestaan: tabel.import_toegestaan,
             nieuw_vanuit_lijst: tabel.nieuw_vanuit_lijst,
             inline_nieuw: tabel.inline_nieuw },
    // 'Actief' is geen veld uit de definitielaag maar de keerzijde van
    // 'archief'. Hij staat achteraan, want hij zegt iets over het record en
    // niet over de inhoud ervan.
    kolommen: [
      ...kolommen.map((k) => velden.find((v) => v.kolom === k)),
      ...(toonArchief
        ? [{ tabel: tabelnaam, kolom: "archief", label: "Actief", type: "actief",
             breedte: "80px", sorteerbaar: 1 }]
        : []),
    ],
    rijen: await schermAf(env, ik, tabelnaam, rijen.results),
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
