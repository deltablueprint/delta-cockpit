// Schrijven. Drie regels die hier worden afgedwongen:
//   1. Niets wordt verwijderd. Archiveren zet archief = 1 (uitgangspunt 2).
//   2. Elke wijziging komt in de audit trail, met naam en tijdstip.
//   3. Alleen velden die in de definitielaag staan en niet alleen-lezen zijn,
//      kunnen geschreven worden.

async function veldenVan(env, tabelnaam) {
  return (await env.DB.prepare(
    "select * from db_field where tabel = ? and actief = 1"
  ).bind(tabelnaam).all()).results;
}

async function tabelVan(env, tabelnaam) {
  return await env.DB.prepare(
    "select * from db_table where naam = ? and actief = 1"
  ).bind(tabelnaam).first();
}

function auditregel(env, ik, tabel, record, soort, extra = {}) {
  return env.DB.prepare(
    `insert into audit (wie, tabel, record, soort, veld, oude_waarde, nieuwe_waarde, gebeurtenis, reden)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    ik.id, tabel, record, soort,
    extra.veld ?? null, extra.oude ?? null, extra.nieuwe ?? null,
    extra.gebeurtenis ?? null, extra.reden ?? null
  );
}

// ---------------------------------------------------------------- wijzigen
export async function wijzig(env, ik, tabelnaam, id, body) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const velden = await veldenVan(env, tabelnaam);
  const huidig = await env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first();
  if (!huidig) return { fout: `Geen ${tabel.label.toLowerCase()} met nummer ${id}.`, status: 404 };

  const teSchrijven = [];
  for (const [kolom, nieuweWaarde] of Object.entries(body.velden || {})) {
    const veld = velden.find((v) => v.kolom === kolom);
    if (!veld) return { fout: `Onbekend veld: ${kolom}`, status: 400 };
    if (veld.alleen_lezen) return { fout: `Veld ${veld.label} is alleen-lezen.`, status: 400 };
    if (veld.verplicht && (nieuweWaarde === null || nieuweWaarde === "")) {
      return { fout: `${veld.label} is verplicht.`, status: 400 };
    }
    if (String(huidig[kolom] ?? "") !== String(nieuweWaarde ?? "")) {
      teSchrijven.push({ veld, nieuweWaarde, oudeWaarde: huidig[kolom] });
    }
  }
  if (!teSchrijven.length) return { ongewijzigd: true, id };

  const zetten = teSchrijven.map((t) => `"${t.veld.kolom}" = ?`).join(", ");
  const opdrachten = [
    env.DB.prepare(`update "${tabelnaam}" set ${zetten} where id = ?`)
      .bind(...teSchrijven.map((t) => t.nieuweWaarde), id),
    // Alleen gemarkeerde velden komen in de audit trail (db_field.audit).
    ...teSchrijven.filter((t) => t.veld.audit).map((t) =>
      auditregel(env, ik, tabelnaam, id, "veld", {
        veld: t.veld.kolom,
        oude: t.oudeWaarde === null ? null : String(t.oudeWaarde),
        nieuwe: t.nieuweWaarde === null ? null : String(t.nieuweWaarde),
        reden: body.reden || null,
      })
    ),
  ];
  await env.DB.batch(opdrachten);
  return { id, gewijzigd: teSchrijven.map((t) => t.veld.kolom) };
}

// -------------------------------------------------------------- archiveren
export async function archiveer(env, ik, tabelnaam, ids, reden) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };
  if (!tabel.archiveerbaar) return { fout: `${tabel.label_mv} kunnen niet gearchiveerd worden.`, status: 400 };

  const velden = await veldenVan(env, tabelnaam);
  if (!velden.some((v) => v.kolom === "archief") &&
      !(await heeftKolom(env, tabelnaam, "archief"))) {
    return { fout: `${tabel.label_mv} hebben geen archiefkolom.`, status: 400 };
  }

  const plekken = ids.map(() => "?").join(", ");
  await env.DB.batch([
    env.DB.prepare(`update "${tabelnaam}" set archief = 1 where id in (${plekken})`).bind(...ids),
    ...ids.map((id) =>
      auditregel(env, ik, tabelnaam, id, "gebeurtenis", {
        gebeurtenis: "gearchiveerd",
        reden: reden || null,
      })
    ),
  ]);
  return { gearchiveerd: ids };
}

// --------------------------------------------------------------- dupliceren
export async function dupliceer(env, ik, tabelnaam, id) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const velden = await veldenVan(env, tabelnaam);
  const bron = await env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first();
  if (!bron) return { fout: `Geen ${tabel.label.toLowerCase()} met nummer ${id}.`, status: 404 };

  // Een kopie neemt de inhoudelijke velden over, maar nooit de uitkomst van
  // het origineel: wat alleen-lezen is of door het systeem gezet wordt, blijft leeg.
  const overTeNemen = velden.filter(
    (v) => !v.alleen_lezen && v.kolom !== "id" && bron[v.kolom] !== undefined
  );
  const kolommen = overTeNemen.map((v) => v.kolom);
  const waarden = overTeNemen.map((v) =>
    v.kolom === tabel.titel_veld && typeof bron[v.kolom] === "string"
      ? `${bron[v.kolom]} (kopie)`
      : bron[v.kolom]
  );

  const nieuw = await env.DB.prepare(
    `insert into "${tabelnaam}" (${kolommen.map((k) => `"${k}"`).join(", ")})
     values (${kolommen.map(() => "?").join(", ")}) returning id`
  ).bind(...waarden).first();

  await auditregel(env, ik, tabelnaam, nieuw.id, "gebeurtenis", {
    gebeurtenis: `gedupliceerd van nummer ${id}`,
  }).run();

  return { id: nieuw.id };
}

async function heeftKolom(env, tabel, kolom) {
  const r = await env.DB.prepare(
    "select count(*) as n from pragma_table_info(?) where name = ?"
  ).bind(tabel, kolom).first();
  return r && r.n > 0;
}
