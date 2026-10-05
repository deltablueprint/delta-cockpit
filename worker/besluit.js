// Het materiaal voor het gesprek.
//
// Op het meetingscherm komt alles bij elkaar wat op dat moment bekend is: de
// events in de looptijd, wat ieder blind heeft ingestuurd, de instapvoorwaarden
// zoals ze er nu bij staan, en wat er al van de portefeuille uitstaat. Niet om
// een oordeel te geven — het systeem rekent hier niets uit en adviseert niets —
// maar om iedereen naar hetzelfde beeld te laten kijken.

import { schermAf } from "./blind.js";
import { instelling } from "./positie.js";
import { kapitaalUitLynx } from "./lynx.js";
import { tilQuorum } from "./gonogo.js";

// De vaste regel van de chartlezing. Elk gesprek begint met dezelfde blik op de
// chart; wat je verder wilt laten zien, voeg je er zelf onder toe.
export const VASTE_CHARTREGEL = "Moving Average 8, 20, 50";

// De regel hoort bij de cyclus en wordt bij het aanmaken ervan gezet. Voor
// cycli die er al waren voordat de chartlezing bestond, zet dit hem alsnog
// klaar zodra iemand het gesprek opent.
async function zorgVoorDeVasteRegel(env, cyclusId, ik) {
  const bestaat = await env.DB.prepare(
    "select id from chartlezing where cyclus = ? and vast = 1"
  ).bind(cyclusId).first();
  if (bestaat) return;
  await env.DB.prepare(
    `insert into chartlezing (cyclus, onderwerp, vast, volgorde, aangemaakt_door)
     values (?, ?, 1, 10, ?)`
  ).bind(cyclusId, VASTE_CHARTREGEL, ik ? ik.id : null).run();
}

export async function overzicht(env, ik, momentId) {
  // Het quorum hangt aan wie er aanwezig is, en dat kies je soms pas nadat de
  // inzendingen al binnen zijn. Opnieuw tellen bij het openen van het scherm
  // houdt de twee bij elkaar — anders bleef 'quorum gehaald op' voor altijd
  // leeg en kwam je de uitkomst niet vastgelegd.
  await tilQuorum(env, ik, momentId).catch(() => null);


  const moment = await env.DB.prepare(
    "select * from beoordelingsmoment where id = ? and archief = 0"
  ).bind(momentId).first();
  if (!moment) return { fout: `Geen besluit met nummer ${momentId}.`, status: 404 };

  const cyclus = await env.DB.prepare(
    "select id, label, status, geopend_op, doelexpiratie from cyclus where id = ?"
  ).bind(moment.cyclus).first();
  await zorgVoorDeVasteRegel(env, moment.cyclus, ik).catch(() => null);

  const [inzendingenRuw, deelnemers, voorwaarden, events, tranches, inst] = await Promise.all([
    env.DB.prepare("select * from inzending where beoordelingsmoment = ? and archief = 0").bind(momentId).all(),
    env.DB.prepare("select id, naam, korte_naam, avatar, kleur from gebruiker where actief = 1 order by naam").all(),
    env.DB.prepare(
      `select id, naam, soort, bron, gemeten_waarde, status, gemeten_door, gemeten_op
         from voorwaarde where cyclus = ? and archief = 0 order by soort desc, volgorde, id`
    ).bind(moment.cyclus).all(),
    env.DB.prepare(
      `select ce.id, e.zwaarte, e.notities, e.datum, e.tijdstip, e.tijdzone, e.naam, e.soort
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

  const chartlezingen = await env.DB.prepare(
    `select id, onderwerp, vast, afbeelding, commentaar, volgorde, aangemaakt_door, aangemaakt_op
       from chartlezing where cyclus = ? and archief = 0
      order by vast desc, volgorde, id`
  ).bind(moment.cyclus).all();

  // Het kapitaal komt bij voorkeur van de broker zelf; staat de nettowaarde
  // niet in het Flex-rapport, dan geldt het ingestelde bedrag.
  const uitLynx = await kapitaalUitLynx(env).catch(() => null);

  const erbij = String(moment.aanwezigen_ids || "").split(",").map((w) => w.trim()).filter(Boolean);
  const inzendingen = await schermAf(env, ik, "inzending", inzendingenRuw.results);

  // De portefeuille: wat er uitstaat, wat dit besluit erbij zou leggen, en
  // waar het plafond ligt. Eén regel waaraan je ziet of er nog ruimte is.
  const multiplier = inst && inst.multiplier ? Number(inst.multiplier) : 10;
  const ingesteld = inst && inst.kapitaal ? Number(inst.kapitaal) : null;
  const kapitaal = uitLynx ? uitLynx.kapitaal : ingesteld;
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
    chartlezingen: chartlezingen.results,
    portefeuille: {
      kapitaal,
      kapitaal_bron: uitLynx ? "lynx" : "instelling",
      kapitaal_opgehaald_op: uitLynx ? uitLynx.opgehaald_op : null,
      kapitaal_ingesteld: ingesteld,
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

// ------------------------------------------------------------ de chartlezing
//
// Eén regel per chart: een schermafdruk en wat je erin leest. De vaste regel
// kan niet van naam veranderen en gaat niet weg; eigen regels mogen erbij en
// mogen naar het archief. Verwijderen bestaat niet (hard uitgangspunt 3).
//
// De afbeelding komt als data-URL binnen. De browser heeft hem al verkleind;
// hier staat alleen nog de bovengrens, zodat één plakfout de rij niet opblaast.
const MAX_AFBEELDING = 900 * 1024;

export async function bewaarChartlezing(env, ik, momentId, body) {
  const moment = await env.DB.prepare(
    "select id, status, cyclus from beoordelingsmoment where id = ? and archief = 0"
  ).bind(momentId).first();
  if (!moment) return { fout: `Geen besluit met nummer ${momentId}.`, status: 404 };
  if (moment.status === "uitkomst vastgelegd") {
    return { fout: "De uitkomst is al vastgelegd; de chartlezing ligt daarmee vast.", status: 409 };
  }
  const cyclusId = moment.cyclus;

  const regels = Array.isArray(body && body.regels) ? body.regels : null;
  if (!regels) return { fout: "Er kwamen geen regels mee.", status: 400 };

  const bestaand = await env.DB.prepare(
    "select id, vast, onderwerp from chartlezing where cyclus = ? and archief = 0"
  ).bind(cyclusId).all();
  const perId = new Map(bestaand.results.map((r) => [String(r.id), r]));

  for (const r of regels) {
    const afbeelding = typeof r.afbeelding === "string" && r.afbeelding.startsWith("data:image/")
      ? r.afbeelding : null;
    if (afbeelding && afbeelding.length > MAX_AFBEELDING) {
      return { fout: "Die schermafdruk is te groot; plak er een kleiner uitsnede van.", status: 413 };
    }
    const commentaar = typeof r.commentaar === "string" && r.commentaar.trim() !== ""
      ? r.commentaar.trim() : null;

    if (r.id && perId.has(String(r.id))) {
      const oud = perId.get(String(r.id));
      // Een regel naar het archief sturen mag, behalve de vaste regel.
      if (r.archief && !oud.vast) {
        await env.DB.prepare("update chartlezing set archief = 1 where id = ?").bind(oud.id).run();
        continue;
      }
      // Elke kaart draagt zijn titel op dezelfde manier en is dus ook op
      // dezelfde manier te wijzigen — ook de eerste. Wat 'vast' nog betekent,
      // is dat die regel er altijd staat en niet naar het archief kan.
      const onderwerp = typeof r.onderwerp === "string" && r.onderwerp.trim() !== ""
        ? r.onderwerp.trim() : oud.onderwerp;
      await env.DB.prepare(
        `update chartlezing set onderwerp = ?, afbeelding = ?, commentaar = ?, volgorde = ?
          where id = ? and cyclus = ?`
      ).bind(onderwerp, afbeelding, commentaar,
             Number.isFinite(Number(r.volgorde)) ? Number(r.volgorde) : 100,
             oud.id, cyclusId).run();
      continue;
    }

    // Een nieuwe regel zonder onderwerp is geen regel.
    const onderwerp = typeof r.onderwerp === "string" ? r.onderwerp.trim() : "";
    if (!onderwerp) continue;
    if (r.archief) continue;
    await env.DB.prepare(
      `insert into chartlezing (cyclus, onderwerp, vast, afbeelding, commentaar, volgorde, aangemaakt_door)
       values (?, ?, 0, ?, ?, ?, ?)`
    ).bind(cyclusId, onderwerp, afbeelding, commentaar,
           Number.isFinite(Number(r.volgorde)) ? Number(r.volgorde) : 100, ik.id).run();
  }

  const uit = await env.DB.prepare(
    `select id, onderwerp, vast, afbeelding, commentaar, volgorde, aangemaakt_door, aangemaakt_op
       from chartlezing where cyclus = ? and archief = 0
      order by vast desc, volgorde, id`
  ).bind(moment.cyclus).all();
  return { regels: uit.results };
}
