// Eén record lezen: het formulier met zijn secties, en welke gerelateerde
// lijsten eraan hangen. Welke dat zijn leidt het systeem af uit de
// definitielaag — een kindtabel is een tabel met een veld dat naar deze
// tabel verwijst (BOUWSPEC 10.0). Geen aparte relatietabel om bij te houden.

export async function record(env, tabelnaam, id) {
  const tabel = await env.DB.prepare(
    "select * from db_table where naam = ? and actief = 1"
  ).bind(tabelnaam).first();
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const [velden, secties, rij] = await Promise.all([
    env.DB.prepare("select * from db_field where tabel = ? and actief = 1 order by volgorde").bind(tabelnaam).all(),
    env.DB.prepare("select * from db_sectie where tabel = ? order by volgorde").bind(tabelnaam).all(),
    env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first(),
  ]);
  if (!rij) return { fout: `Geen ${tabel.label.toLowerCase()} met nummer ${id}.`, status: 404 };

  // Gerelateerde lijsten: elke tabel met een veld dat hierheen verwijst.
  const kinderen = (await env.DB.prepare(
    `select f.tabel, f.kolom, t.label, t.label_mv, t.volgorde
       from db_field f
       join db_table t on t.naam = f.tabel
      where f.verwijst_naar = ? and f.actief = 1 and t.actief = 1
      order by t.volgorde`
  ).bind(tabelnaam).all()).results;

  const relaties = [];
  for (const k of kinderen) {
    let aantal = 0;
    try {
      const r = await env.DB.prepare(
        `select count(*) as n from "${k.tabel}" where "${k.kolom}" = ?`
      ).bind(id).first();
      aantal = r ? r.n : 0;
    } catch {
      continue;   // tabel bestaat nog niet; dan tonen we hem ook niet
    }
    relaties.push({ tabel: k.tabel, kolom: k.kolom, label: k.label_mv, aantal });
  }

  // Verwijzingen omzetten naar iets leesbaars: niet 'simon' maar 'Simon DeJonghe'.
  const labels = {};
  for (const v of velden.results.filter((v) => v.type === "verwijzing" && rij[v.kolom])) {
    const doel = await env.DB.prepare("select naam from db_table where naam = ?").bind(v.verwijst_naar).first();
    if (!doel) continue;
    const t = await env.DB.prepare("select titel_veld from db_table where naam = ?").bind(v.verwijst_naar).first();
    try {
      const r = await env.DB.prepare(
        `select "${t.titel_veld}" as titel from "${v.verwijst_naar}" where id = ?`
      ).bind(rij[v.kolom]).first();
      if (r) labels[v.kolom] = r.titel;
    } catch { /* verwijzing naar een tabel zonder id-kolom: laat staan */ }
  }

  return {
    tabel: {
      naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv,
      titel_veld: tabel.titel_veld, related_weergave: tabel.related_weergave,
    },
    secties: secties.results,
    velden: velden.results,
    waarden: rij,
    verwijzingen: labels,
    relaties,
  };
}
