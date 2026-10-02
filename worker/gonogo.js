// Etappe 10 — de go/no-go.
//
// Twee schermen, hetzelfde beeld: eerst *Positie blind versturen*, en zodra
// het quorum gehaald is *Go / no-go meeting*. Beide worden bereikt met de
// actieknop op het cyclusrecord; welke knop dat is komt uit `processtap` en
// niet uit het scherm (BOUWSPEC 10.0e).
//
// Wat het systeem hier wél doet: bewaren, afschermen, tellen tot het quorum.
// Wat het niet doet: oordelen. Er is geen berekening die go of no-go zegt.

import { schermAf } from "./blind.js";
import { uitBesluit } from "./positie.js";
import { beweegFase } from "./proces.js";

const DEELVELDEN = [
  "positie", "strike", "expiratiedatum", "inzet_pct",
  "reden", "motivering", "intuitie", "wat_ik_zag",
];

function audit(env, ik, tabel, record, soort, extra = {}) {
  return env.DB.prepare(
    `insert into audit (wie, tabel, record, soort, veld, oude_waarde, nieuwe_waarde, gebeurtenis, reden)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    ik.id, tabel, record, soort,
    extra.veld ?? null, extra.oude ?? null, extra.nieuwe ?? null,
    extra.gebeurtenis ?? null, extra.reden ?? null
  );
}

// De stap waar een record nu in staat, uit Procesbeheer.
export async function stapVoor(env, toepassing, stand) {
  try {
    return await env.DB.prepare(
      `select s.* from processtap s
         join proces p on p.id = s.proces
        where p.toepassing = ? and p.archief = 0 and s.archief = 0 and s.stand = ?
        order by s.volgorde limit 1`
    ).bind(toepassing, stand).first();
  } catch {
    return null;   // Procesbeheer bestaat nog niet in deze omgeving
  }
}

// De actieknop rechtsboven op een record: precies één, die van de stap waar
// het record nu in staat.
export async function actieVoor(env, tabelnaam, rij, tabel, ik) {
  if (!tabel || !tabel.proces_veld || !rij) return null;

  let stappen = [];
  try {
    stappen = (await env.DB.prepare(
      `select s.* from processtap s
         join proces p on p.id = s.proces
        where p.toepassing = ? and p.archief = 0 and s.archief = 0 and s.stand = ?
          and s.actieknop is not null
        order by s.volgorde`
    ).bind(tabelnaam, rij[tabel.proces_veld]).all()).results;
  } catch {
    return null;   // Procesbeheer bestaat nog niet in deze omgeving
  }
  if (!stappen.length) return null;

  // Horen er meerdere stappen bij dezelfde status, dan bepaalt het quorum waar
  // je staat: zolang het niet gehaald is stuur je blind in, daarna is het
  // gesprek aan de beurt. Er staat nooit meer dan één knop.
  let stap = stappen[0];
  let label = stap.actieknop;

  if (tabelnaam === "cyclus") {
    const moment = await openMoment(env, rij.id);
    if (moment && moment.quorum_gehaald_op && stappen.length > 1) {
      stap = stappen[1];
      label = stap.actieknop;
    } else if (moment && ik) {
      // Jij bent klaar, de anderen nog niet: dan vraagt de knop niets meer van
      // je, hij laat alleen zien waar het op wacht.
      const mijn = await env.DB.prepare(
        "select status from inzending where beoordelingsmoment = ? and deelnemer = ?"
      ).bind(moment.id, ik.id).first();
      if (mijn && mijn.status === "verstuurd" && stap.actieknop_klaar) label = stap.actieknop_klaar;
    }
  }

  if (!stap.doelscherm) return null;
  return { label, route: `/${stap.doelscherm}/${rij.id}`, stap: stap.naam };
}

// Het quorum is het aantal aanwezigen van dit besluit. Wie meedoet moet
// inzenden; wie er niet is, telt niet mee.
function aanwezigen(moment) {
  return String((moment && moment.aanwezigen_ids) || "").split(",").map((w) => w.trim()).filter(Boolean);
}

async function openMoment(env, cyclusId) {
  return env.DB.prepare(
    `select * from beoordelingsmoment
      where cyclus = ? and archief = 0 and status <> 'uitkomst vastgelegd'
      order by datum desc, id desc limit 1`
  ).bind(cyclusId).first();
}

// ------------------------------------------------------------------ lezen
export async function stand(env, ik, cyclusId) {
  const cyclus = await env.DB.prepare(
    "select id, label, status, geopend_op, doelexpiratie from cyclus where id = ?"
  ).bind(cyclusId).first();
  if (!cyclus) return { fout: `Geen cyclus met nummer ${cyclusId}.`, status: 404 };

  const [moment, deelnemers] = await Promise.all([
    openMoment(env, cyclusId),
    env.DB.prepare("select id, naam, korte_naam, avatar, kleur from gebruiker where actief = 1 order by naam").all(),
  ]);

  let inzendingen = [];
  let mijn = null;
  let hetMoment = moment;
  if (hetMoment) {
    // Het quorum wordt niet alleen geteld op het ogenblik dat iemand verstuurt.
    // Komt er een inzending langs een andere weg bij — proefdata, een import,
    // een herstelde regel — dan hoort het beeld daarna nog steeds te kloppen.
    // Daarom telt het systeem hier opnieuw, en opent het alsnog als het er is.
    if (!hetMoment.quorum_gehaald_op) {
      await tilQuorum(env, ik, hetMoment.id);
      hetMoment = await env.DB.prepare("select * from beoordelingsmoment where id = ?")
        .bind(hetMoment.id).first();
    }

    const rijen = (await env.DB.prepare(
      "select * from inzending where beoordelingsmoment = ? and archief = 0"
    ).bind(hetMoment.id).all()).results;
    mijn = rijen.find((r) => r.deelnemer === ik.id) || null;
    inzendingen = await schermAf(env, ik, "inzending", rijen);
  }

  // De feiten waartegen geoordeeld wordt. Alleen lezen op dit scherm:
  // bijwerken gebeurt op de cyclus, en dat staat in de audit trail.
  const voorwaarden = (await env.DB.prepare(
    `select id, naam, soort, bron, gemeten_waarde, status, gemeten_door, gemeten_op
       from voorwaarde where cyclus = ? and archief = 0 order by soort desc, volgorde, id`
  ).bind(cyclusId).all()).results;

  const events = (await env.DB.prepare(
    `select ce.id, ce.behandeling, ce.motivering, ce.zwaarte, ce.zwaarte_reden,
            e.datum, e.tijdstip, e.tijdzone, e.naam, e.soort
       from cyclus_event ce join event e on e.id = ce.event
      where ce.cyclus = ? order by e.datum, e.tijdstip`
  ).bind(cyclusId).all()).results;

  const verstuurd = inzendingen.filter((i) => i.status === "verstuurd").length;
  const erbij = aanwezigen(hetMoment);
  const nodig = erbij.length;

  return {
    cyclus,
    stap: null,
    moment: hetMoment,
    open: Boolean(hetMoment && hetMoment.quorum_gehaald_op),
    quorum: { nodig, van: nodig, verstuurd },
    aanwezigen: erbij,
    deelnemers: deelnemers.results.filter((g) => !erbij.length || erbij.includes(g.id)),
    inzendingen,
    mijn,
    voorwaarden,
    events,
    ik: ik.id,
  };
}

// ------------------------------------------------- een moment openen
export async function startMoment(env, ik, cyclusId, body = {}) {
  const bestaand = await openMoment(env, cyclusId);
  if (bestaand) return { id: bestaand.id, bestond: true };

  const cyclus = await env.DB.prepare("select id, status from cyclus where id = ?").bind(cyclusId).first();
  if (!cyclus) return { fout: `Geen cyclus met nummer ${cyclusId}.`, status: 404 };

  const rij = await env.DB.prepare(
    `insert into beoordelingsmoment (cyclus, datum, aanleiding, status, aangemaakt_door)
     values (?, coalesce(?, date('now')), ?, 'aanwezigen bepalen', ?) returning id`
  ).bind(cyclusId, body.datum || null, body.aanleiding || null, ik.id).first();

  await env.DB.batch([
    audit(env, ik, "beoordelingsmoment", rij.id, "gebeurtenis", { gebeurtenis: "beoordelingsmoment geopend" }),
  ]);
  // De cyclus schuift op omdat er een besluit ligt, niet omdat we hem zetten.
  await beweegFase(env, "cyclus", cyclusId, ik);

  return { id: rij.id, bestond: false };
}

// ------------------------------------------------- blind versturen
export async function versturen(env, ik, cyclusId, body = {}) {
  const moment = await openMoment(env, cyclusId);
  if (!moment) return { fout: "Er loopt nog geen beoordelingsmoment op deze cyclus.", status: 409 };
  if (moment.status === "uitkomst vastgelegd") {
    return { fout: "De uitkomst van dit moment is al vastgelegd.", status: 409 };
  }

  const bestaand = await env.DB.prepare(
    "select * from inzending where beoordelingsmoment = ? and deelnemer = ?"
  ).bind(moment.id, ik.id).first();

  // Versturen vergrendelt. Daarna is een inzending niet meer te wijzigen —
  // ook niet door degene die hem schreef.
  if (bestaand && bestaand.status === "verstuurd") {
    return { fout: "Je inzending is al verstuurd en staat vast.", status: 409 };
  }

  const positie = body.positie === "go" || body.positie === "no-go" ? body.positie : null;
  if (!positie) return { fout: "Kies go of no-go.", status: 422, veld: "positie" };
  if (positie === "no-go" && !String(body.reden || "").trim()) {
    return { fout: "Een no-go heeft een reden nodig.", status: 422, veld: "reden" };
  }
  if (positie === "go" && (body.strike === null || body.strike === undefined || body.strike === "")) {
    return { fout: "Bij een go hoort een strike.", status: 422, veld: "strike" };
  }
  if (positie === "go" && !String(body.expiratiedatum || "").trim()) {
    return { fout: "Bij een go hoort een expiratiedatum.", status: 422, veld: "expiratiedatum" };
  }

  const w = (k) => (body[k] === "" || body[k] === undefined ? null : body[k]);
  const waarden = [
    positie, w("strike"), w("expiratiedatum"), w("inzet_pct"),
    w("reden"), w("motivering"), w("intuitie"), w("wat_ik_zag"),
  ];

  let id;
  if (bestaand) {
    await env.DB.prepare(
      `update inzending set positie = ?, strike = ?, expiratiedatum = ?, inzet_pct = ?,
              reden = ?, motivering = ?, intuitie = ?, wat_ik_zag = ?,
              status = 'verstuurd', verstuurd_op = datetime('now'), revisie = revisie + 1
        where id = ?`
    ).bind(...waarden, bestaand.id).run();
    id = bestaand.id;
  } else {
    const rij = await env.DB.prepare(
      `insert into inzending (cyclus, beoordelingsmoment, deelnemer, status,
                              positie, strike, expiratiedatum, inzet_pct,
                              reden, motivering, intuitie, wat_ik_zag, verstuurd_op)
       values (?, ?, ?, 'verstuurd', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) returning id`
    ).bind(cyclusId, moment.id, ik.id, ...waarden).first();
    id = rij.id;
  }

  await audit(env, ik, "inzending", id, "gebeurtenis", { gebeurtenis: "verstuurd" }).run();

  const telling = await tilQuorum(env, ik, moment.id);
  return { id, ...telling };
}

// Het quorum tellen. Wordt het gehaald, dan gaan de inzendingen open —
// tegelijk voor iedereen, ook voor degene die als eerste verstuurde.
async function tilQuorum(env, ik, momentId) {
  const moment = await env.DB.prepare("select * from beoordelingsmoment where id = ?").bind(momentId).first();
  const nodig = aanwezigen(moment).length;
  if (!nodig) return { verstuurd: 0, nodig: 0, open: false };

  const n = (await env.DB.prepare(
    "select count(*) as n from inzending where beoordelingsmoment = ? and status = 'verstuurd' and archief = 0"
  ).bind(momentId).first()).n;
  if (n >= nodig && moment && !moment.quorum_gehaald_op) {
    await env.DB.batch([
      env.DB.prepare(
        `update beoordelingsmoment
            set quorum_gehaald_op = datetime('now'), status = 'inzendingen open', revisie = revisie + 1
          where id = ?`
      ).bind(momentId),
      audit(env, ik, "beoordelingsmoment", momentId, "gebeurtenis",
            { gebeurtenis: "quorum gehaald", nieuwe: `${n} van ${nodig}` }),
    ]);
    return { verstuurd: n, nodig, open: true };
  }
  return { verstuurd: n, nodig, open: Boolean(moment && moment.quorum_gehaald_op) };
}

// ------------------------------------------------- de uitkomst van het gesprek
export async function uitkomst(env, ik, cyclusId, body = {}) {
  const moment = await openMoment(env, cyclusId);
  if (!moment) return { fout: "Er loopt geen beoordelingsmoment op deze cyclus.", status: 409 };
  if (!moment.quorum_gehaald_op) {
    return { fout: "De inzendingen zijn nog niet open; het quorum is nog niet gehaald.", status: 409 };
  }

  const keuze = body.uitkomst === "go" || body.uitkomst === "no-go" ? body.uitkomst : null;
  if (!keuze) return { fout: "Leg vast of het een go of een no-go werd.", status: 422, veld: "uitkomst" };
  if (keuze === "go" && (body.strike === null || body.strike === undefined || body.strike === "")) {
    return { fout: "Bij een go hoort een strike.", status: 422, veld: "strike" };
  }
  if (keuze === "go" && !String(body.expiratiedatum || "").trim()) {
    return { fout: "Bij een go hoort een expiratiedatum.", status: 422, veld: "expiratiedatum" };
  }
  if (keuze === "no-go" && !String(body.volgend_moment || "").trim()) {
    return { fout: "Elke no-go eindigt met een nieuw analysemoment.", status: 422, veld: "volgend_moment" };
  }

  const w = (k) => (body[k] === "" || body[k] === undefined ? null : body[k]);
  await env.DB.prepare(
    `update beoordelingsmoment
        set uitkomst = ?, strike = ?, expiratiedatum = ?, inzet_pct = ?,
            wat_veranderde = ?, aanwezigen = ?, volgend_moment = ?,
            status = 'uitkomst vastgelegd', vastgelegd_door = ?, vastgelegd_op = datetime('now'),
            revisie = revisie + 1
      where id = ?`
  ).bind(
    keuze, w("strike"), w("expiratiedatum"), w("inzet_pct"),
    w("wat_veranderde"), w("aanwezigen"), w("volgend_moment"), ik.id, moment.id
  ).run();

  // Een go zet de cyclus door naar *uitvoering ophalen*: de koppeling wacht
  // tot de order bij Lynx verschijnt. Het systeem plaatst nooit zelf een
  // order (hard uitgangspunt 1). Een no-go blijft staan waar hij staat, met
  // een nieuw analysemoment op de cyclus.
  // Een no-go houdt de cyclus in besluitvorming, met een nieuw analysemoment:
  // wachten is een toestand, geen vertraging.
  const vervolg = [audit(env, ik, "beoordelingsmoment", moment.id, "gebeurtenis",
                         { gebeurtenis: `uitkomst vastgelegd: ${keuze}` })];
  if (keuze === "no-go") {
    vervolg.push(env.DB.prepare(
      "update cyclus set volgend_analysemoment = ? where id = ?"
    ).bind(w("volgend_moment"), cyclusId));
  }
  await env.DB.batch(vervolg);

  // Een go laat meteen de eerste tranche ontstaan, met het besluit erin
  // gekopieerd. Overtypen is precies hoe een uitvoering ongemerkt van een
  // besluit gaat afwijken.
  let positie = null;
  if (keuze === "go") {
    const bijgewerkt = await env.DB.prepare("select * from beoordelingsmoment where id = ?")
      .bind(moment.id).first();
    positie = await uitBesluit(env, ik, bijgewerkt);
  }

  // De standen volgen uit wat er gebeurd is.
  await beweegFase(env, "beoordelingsmoment", moment.id, ik);
  await beweegFase(env, "cyclus", cyclusId, ik);

  return { id: moment.id, uitkomst: keuze, positie };
}
