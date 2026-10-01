// Eén record lezen: het formulier met zijn secties, en welke gerelateerde
// lijsten eraan hangen. Welke dat zijn leidt het systeem af uit de
// definitielaag — een kindtabel is een tabel met een veld dat naar deze
// tabel verwijst (BOUWSPEC 10.0). Geen aparte relatietabel om bij te houden.

import { schermAfEen } from "./blind.js";
import { actieVoor } from "./gonogo.js";
import { magTrancheAanmaken, besluitOpties } from "./positie.js";

export async function record(env, tabelnaam, id, ik) {
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
    // De teller telt wat je in de lijst ziet: gearchiveerde regels horen daar
    // niet bij. Stond er 2 terwijl er één regel stond, dan klopte er iets —
    // en een teller waarin je niet gelooft, is erger dan geen teller.
    let aantal = 0;
    try {
      const r = await env.DB.prepare(
        `select count(*) as n from "${k.tabel}" where "${k.kolom}" = ? and archief = 0`
      ).bind(id).first();
      aantal = r ? r.n : 0;
    } catch {
      try {
        const r = await env.DB.prepare(
          `select count(*) as n from "${k.tabel}" where "${k.kolom}" = ?`
        ).bind(id).first();
        aantal = r ? r.n : 0;
      } catch {
        continue;   // tabel bestaat nog niet; dan tonen we hem ook niet
      }
    }
    // Of je in deze lijst iets mag aanmaken, hangt soms van het record af.
    // Een tranche bestaat niet zonder goedgekeurd besluit.
    let magNieuw = true;
    if (k.tabel === "positie" && tabelnaam === "cyclus") {
      magNieuw = await magTrancheAanmaken(env, id);
    }
    if (k.tabel === "exitregel") magNieuw = false;   // die zet het systeem klaar

    relaties.push({ tabel: k.tabel, kolom: k.kolom, label: k.label_mv, aantal, magNieuw });
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

  // De ouder van dit record, voor de breadcrumb en de terugknop.
  let ouder = null;
  const ouderveld = velden.results.find((v) => v.type === "verwijzing" && v.toon_op_formulier === 0 && rij[v.kolom]);
  if (ouderveld) {
    const ot = await env.DB.prepare("select naam, label, label_mv, titel_veld from db_table where naam = ?")
      .bind(ouderveld.verwijst_naar).first();
    if (ot) {
      const r = await env.DB.prepare(`select "${ot.titel_veld}" as titel from "${ot.naam}" where id = ?`)
        .bind(rij[ouderveld.kolom]).first();
      ouder = {
        tabel: ot.naam, label_mv: ot.label_mv, id: rij[ouderveld.kolom],
        kolom: ouderveld.kolom,
        titel: r ? r.titel : `${ot.label} ${rij[ouderveld.kolom]}`,
      };
    }
  }

  // De procesbalk bovenaan: de keuzes van het statusveld, in volgorde.
  let proces = null;
  if (tabel.proces_veld) {
    const stappen = (await env.DB.prepare(
      "select waarde, label from db_choice where tabel = ? and kolom = ? and actief = 1 order by volgorde"
    ).bind(tabelnaam, tabel.proces_veld).all()).results;
    if (stappen.length) proces = { veld: tabel.proces_veld, nu: rij[tabel.proces_veld], stappen };
  }

  // Keuzelijsten voor verwijzingen die je mag kiezen (db_field.keuzelijst).
  // Ze blijven binnen hetzelfde ouderrecord: een tranche hoort bij een besluit
  // van zijn eigen cyclus.
  const opties = {};
  if (tabelnaam === "positie" && rij.cyclus) {
    opties.beoordelingsmoment = await besluitOpties(env, rij.cyclus);
  }

  // De actieknop rechtsboven: die van de stap waar dit record nu in staat.
  const actie = await actieVoor(env, tabelnaam, rij, tabel, ik);

  return {
    ouder,
    proces,
    actie,
    opties,
    tabel: {
      naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv,
      titel_veld: tabel.titel_veld, related_weergave: tabel.related_weergave,
      proces_veld: tabel.proces_veld,
    },
    secties: secties.results,
    velden: velden.results,
    waarden: await schermAfEen(env, ik, tabelnaam, rij),
    verwijzingen: labels,
    relaties,
  };
}
