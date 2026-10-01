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

  // Filter per kolom:  ?f.status=groen
  // Tekstkolommen zoeken op "bevat", de rest op exact — zo doet een kolomfilter
  // wat je verwacht als je er half een woord in typt.
  for (const [sleutel, zoekwaarde] of params) {
    if (!sleutel.startsWith("f.")) continue;
    const kolom = sleutel.slice(2);
    const veld = velden.find((v) => v.kolom === kolom);
    if (!veld) continue;
    if (["tekst", "lang"].includes(veld.type)) {
      waar.push(`"${kolom}" like ?`);
      binden.push(`%${zoekwaarde}%`);
    } else {
      waar.push(`"${kolom}" = ?`);
      binden.push(zoekwaarde);
    }
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

  const selectie = ["id", ...kolommen.filter((k) => k !== "id")].map((k) => `"${k}"`).join(", ");

  const [rijen, telling] = await Promise.all([
    env.DB.prepare(`select ${selectie} from "${tabelnaam}" ${waarSql} ${orderSql} limit ? offset ?`)
      .bind(...binden, limiet, offset).all(),
    env.DB.prepare(`select count(*) as n from "${tabelnaam}" ${waarSql}`).bind(...binden).first(),
  ]);

  return {
    tabel: { naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv, titel_veld: tabel.titel_veld },
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

async function kolomBestaatInDb(env, tabel, kolom) {
  const r = await env.DB.prepare(`select count(*) as n from pragma_table_info(?) where name = ?`)
    .bind(tabel, kolom).first();
  return r && r.n > 0;
}
