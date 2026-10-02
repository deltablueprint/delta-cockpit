// Het materiaal voor het gesprek.
//
// Op het meetingscherm komt alles bij elkaar wat op dat moment bekend is: de
// events in de looptijd, wat ieder blind heeft ingestuurd, de instapvoorwaarden
// zoals ze er nu bij staan, en wat er al van de portefeuille uitstaat. Niet om
// een oordeel te geven — het systeem rekent hier niets uit en adviseert niets —
// maar om iedereen naar hetzelfde beeld te laten kijken.

import { schermAf } from "./blind.js";
import { instelling } from "./positie.js";

export async function overzicht(env, ik, momentId) {
  const moment = await env.DB.prepare(
    "select * from beoordelingsmoment where id = ? and archief = 0"
  ).bind(momentId).first();
  if (!moment) return { fout: `Geen besluit met nummer ${momentId}.`, status: 404 };

  const cyclus = await env.DB.prepare(
    "select id, label, status, geopend_op, doelexpiratie from cyclus where id = ?"
  ).bind(moment.cyclus).first();

  const [inzendingenRuw, deelnemers, voorwaarden, events, tranches, inst] = await Promise.all([
    env.DB.prepare("select * from inzending where beoordelingsmoment = ? and archief = 0").bind(momentId).all(),
    env.DB.prepare("select id, naam, korte_naam, avatar, kleur from gebruiker where actief = 1 order by naam").all(),
    env.DB.prepare(
      `select id, naam, soort, bron, gemeten_waarde, status, gemeten_door, gemeten_op
         from voorwaarde where cyclus = ? and archief = 0 order by soort desc, volgorde, id`
    ).bind(moment.cyclus).all(),
    env.DB.prepare(
      `select ce.id, ce.behandeling, ce.zwaarte, ce.motivering, e.datum, e.tijdstip, e.tijdzone, e.naam, e.soort
         from cyclus_event ce join event e on e.id = ce.event
        where ce.cyclus = ? order by e.datum, e.tijdstip`
    ).bind(moment.cyclus).all(),
    // Wat er nu al in de markt staat, over alle cycli heen: blootstelling is
    // een eigenschap van de portefeuille, niet van één cyclus (BOUWSPEC 6.1).
    env.DB.prepare(
      `select p.id, p.cyclus, p.strike, p.aantal, p.inzet_pct, p.expiratiedatum, p.status, c.label as cyclusnaam
         from positie p join cyclus c on c.id = p.cyclus
        where p.archief = 0 and p.status not in ('gesloten')`
    ).all(),
    instelling(env),
  ]);

  const erbij = String(moment.aanwezigen_ids || "").split(",").map((w) => w.trim()).filter(Boolean);
  const inzendingen = await schermAf(env, ik, "inzending", inzendingenRuw.results);

  // De portefeuille: wat er uitstaat, wat dit besluit erbij zou leggen, en
  // waar het plafond ligt. Eén regel waaraan je ziet of er nog ruimte is.
  const multiplier = inst && inst.multiplier ? Number(inst.multiplier) : 10;
  const kapitaal = inst ? Number(inst.kapitaal) : null;
  const blootstelling = tranches.results.reduce(
    (n, p) => n + (Number(p.strike) || 0) * multiplier * (Number(p.aantal) || 0), 0
  );
  const ingezet_pct = kapitaal ? Math.round((blootstelling / kapitaal) * 1000) / 10 : null;

  return {
    moment,
    cyclus,
    aanwezigen: erbij,
    deelnemers: deelnemers.results,
    inzendingen,
    voorwaarden: voorwaarden.results,
    events: events.results,
    portefeuille: {
      kapitaal,
      multiplier,
      blootstelling,
      ingezet_pct,
      max_inzet_pct: inst ? inst.max_inzet_pct : null,
      min_reserve_pct: inst ? inst.min_reserve_pct : null,
      max_inzet_cyclus_pct: inst ? inst.max_inzet_cyclus_pct : null,
      open_tranches: tranches.results,
    },
    ik: ik.id,
  };
}
