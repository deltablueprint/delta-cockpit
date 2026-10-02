// Eén record lezen: het formulier met zijn secties, en welke gerelateerde
// lijsten eraan hangen. Welke dat zijn leidt het systeem af uit de
// definitielaag — een kindtabel is een tabel met een veld dat naar deze
// tabel verwijst (BOUWSPEC 10.0). Geen aparte relatietabel om bij te houden.

import { schermAfEen } from "./blind.js";
import { actieVoor } from "./gonogo.js";
import { magTrancheAanmaken, besluitOpties } from "./positie.js";
import { stappenVoor, beweegFase } from "./proces.js";

export async function record(env, tabelnaam, id, ik) {
  const tabel = await env.DB.prepare(
    "select * from db_table where naam = ? and actief = 1"
  ).bind(tabelnaam).first();
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  // Voordat we het record laten zien: klopt de fase nog? Een stap kan gedaan
  // zijn door iets wat elders gebeurde — een inzending die binnenkwam, een
  // tranche die sloot. Dan hoort de balk dat te weten zodra je kijkt, en niet
  // pas als je toevallig iets opslaat.
  if (tabel.proces_veld) await beweegFase(env, tabelnaam, id, ik);

  const [velden, secties, rij] = await Promise.all([
    env.DB.prepare("select * from db_field where tabel = ? and actief = 1 order by volgorde").bind(tabelnaam).all(),
    env.DB.prepare("select * from db_sectie where tabel = ? order by volgorde").bind(tabelnaam).all(),
    env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first(),
  ]);
  if (!rij) return { fout: `Geen ${tabel.label.toLowerCase()} met nummer ${id}.`, status: 404 };

  // Gerelateerde lijsten: elke tabel met een veld dat hierheen verwijst en dat
  // het ouderveld is. Dat ouderveld herken je eraan dat het niet op het
  // formulier staat: je kiest het niet, het ligt vast zodra het record bestaat.
  // Een verwijzing die je wél kiest — het besluit onder een tranche — is een
  // koppeling en geen ouderschap, en levert dus geen tabblad op. Een mens is
  // nooit de ouder van een record: 'aangemaakt door' hoort op het record, niet
  // als lijst onder de persoon.
  const kinderen = (await env.DB.prepare(
    `select f.tabel, f.kolom, t.label, t.label_mv, t.volgorde, t.nieuw_direct
       from db_field f
       join db_table t on t.naam = f.tabel
      where f.verwijst_naar = ? and f.actief = 1 and t.actief = 1
        and f.toon_op_formulier = 0
        and f.verwijst_naar <> 'gebruiker'
      order by t.volgorde`
  ).bind(tabelnaam).all()).results;

  // Alles wat het recordscherm nodig heeft, wordt naast elkaar opgevraagd in
  // plaats van na elkaar. Eén vraag per ding blijft het, maar wachten op de
  // vorige hoeft niet — dat scheelde seconden op een record met veel
  // gerelateerde lijsten.
  const relatiewerk = kinderen
    // Een veld dat naar de eigen tabel wijst is een verwijzing naar een
    // zusterrecord, geen kindlijst: 'doorgerold naar' maakt van de opvolger
    // geen onderdeel van deze tranche.
    .filter((k) => k.tabel !== tabelnaam)
    .map(async (k) => {
      // De teller telt wat je in de lijst ziet: gearchiveerde regels horen
      // daar niet bij.
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
          return null;   // tabel bestaat nog niet; dan tonen we hem ook niet
        }
      }

      // Of je in deze lijst iets mag aanmaken, hangt soms van het record af.
      // Een tranche bestaat niet zonder goedgekeurd besluit.
      // Een positie maak je niet: ze ontstaat uit een besluit met een go.
      // Een exitplan maak je ook niet: dat zet het systeem klaar.
      let magNieuw = true;
      let inPlaatsVan = null;
      if (k.tabel === "positie") {
        magNieuw = false;
        inPlaatsVan = "Een positie ontstaat uit een besluit met een go.";
      }
      if (k.tabel === "exitregel") {
        magNieuw = false;
        inPlaatsVan = "Het exitplan wordt klaargezet zodra de tranche bestaat.";
      }

      // Op de cyclus kun je voorwaarden overnemen uit eerdere cycli.
      const overnemen = k.tabel === "voorwaarde" && tabelnaam === "cyclus";

      return { tabel: k.tabel, kolom: k.kolom, label: k.label_mv, aantal, magNieuw,
               inPlaatsVan, overnemen, direct: Boolean(k.nieuw_direct) };
    });

  // Verwijzingen omzetten naar iets leesbaars: niet 'simon' maar 'Simon DeJonghe'.
  const verwijsvelden = velden.results.filter((v) => v.type === "verwijzing" && rij[v.kolom]);
  const labelwerk = verwijsvelden.map(async (v) => {
    const doel = await env.DB.prepare(
      "select naam, titel_veld from db_table where naam = ?"
    ).bind(v.verwijst_naar).first();
    if (!doel) return null;
    try {
      const r = await env.DB.prepare(
        `select "${doel.titel_veld}" as titel from "${doel.naam}" where id = ?`
      ).bind(rij[v.kolom]).first();
      return r ? { kolom: v.kolom, titel: r.titel } : null;
    } catch {
      return null;   // verwijzing naar een tabel zonder id-kolom: laat staan
    }
  });

  const [relatieuitkomst, labeluitkomst] = await Promise.all([
    Promise.all(relatiewerk),
    Promise.all(labelwerk),
  ]);

  const relaties = relatieuitkomst.filter(Boolean);
  const labels = {};
  for (const l of labeluitkomst) if (l) labels[l.kolom] = l.titel;

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

  // Keuzelijsten voor verwijzingen die je mag kiezen (db_field.keuzelijst) en
  // de actieknop rechtsboven: allebei tegelijk, want ze weten niets van elkaar.
  const opties = {};
  const [keuzes, actie, stappen] = await Promise.all([
    tabelnaam === "positie" && rij.cyclus ? besluitOpties(env, rij.cyclus) : null,
    actieVoor(env, tabelnaam, rij, tabel, ik),
    stappenVoor(env, tabelnaam, rij),
  ]);
  if (keuzes) opties.beoordelingsmoment = keuzes;

  return {
    ouder,
    proces,
    actie,
    opties,
    stappen,
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
