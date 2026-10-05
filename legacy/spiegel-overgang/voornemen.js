// Het voornemen: eerst zeggen wat je gaat doen, dan doen.
//
// Rollen gaat snel, en de cockpit moet de nieuwe positie dragen vóórdat je naar
// de leden publiceert. Kondig je vooraf aan wat je gaat doen, dan hoeft het
// systeem achteraf niet te raden: het vergelijkt wat binnenkomt met wat je zei.
// Een vergelijking, geen interpretatie — en dus betrouwbaar genoeg om vanzelf
// af te ronden.
//
// Wat het níét doet: een order plaatsen, of voorstellen om te rollen. Een
// voornemen is een aantekening van jou (hard uitgangspunt 1).

import { legVast, resultaatPunten } from "./afloop.js";
import { herberekenExitplan, zetExitplanKlaar } from "./positie.js";

// Een tranche die in de markt staat; alleen daar valt iets aan te kondigen.
const IN_DE_MARKT = ["uitvoering ophalen", "publiceren naar leden", "bewaken"];
const SOORTEN = ["rol", "terugkopen"];

// Gebeurde deze uitvoering ná de aankondiging? Een terugkoop van gisteren hoort
// bij iets anders. Draagt de uitvoering een tijdstip, dan vergelijken we op de
// minuut; draagt ze alleen een datum, dan op de dag — preciezer doen alsof
// helpt niemand.
function na(r, aangekondigd) {
  if (!aangekondigd) return true;
  const wanneer = r.moment || r.datum || "";
  if (!wanneer) return true;
  return wanneer.length > 10
    ? String(wanneer) >= String(aangekondigd).slice(0, wanneer.length)
    : String(wanneer) >= String(aangekondigd).slice(0, 10);
}

const gelijk = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined
  && Math.abs(Number(a) - Number(b)) < 0.001;

// ----------------------------------------------------------- aankondigen
export async function kondigAan(env, ik, positieId, body = {}) {
  const tranche = await env.DB.prepare(
    "select * from positie where id = ? and archief = 0"
  ).bind(positieId).first();
  if (!tranche) return { fout: `Geen tranche met nummer ${positieId}.`, status: 404 };
  if (!IN_DE_MARKT.includes(tranche.status)) {
    return { fout: "Deze tranche staat niet in de markt; er valt niets aan te kondigen.", status: 409 };
  }

  const soort = String(body.soort || "");
  if (!SOORTEN.includes(soort)) {
    return { fout: "Kies of je doorrolt of vervroegd terugkoopt.", status: 422, veld: "soort" };
  }
  // Een rol zonder het contract dat ervoor in de plaats komt, is geen
  // aankondiging: dan valt er straks niets te vergelijken.
  const strike = Number(body.nieuwe_strike);
  if (soort === "rol" && (!Number.isFinite(strike) || !body.nieuwe_expiratiedatum)) {
    return { fout: "Bij een rol hoort het nieuwe contract: strike en expiratie.", status: 422, veld: "nieuwe_strike" };
  }

  // Eén open voornemen per tranche. Twee tegelijk zou betekenen dat de eerste
  // uitvoering die binnenkomt bij allebei kan horen.
  const open = await env.DB.prepare(
    "select id from voornemen where positie = ? and status = 'aangekondigd' and archief = 0"
  ).bind(positieId).first();
  if (open) return { fout: "Er staat al een voornemen open op deze tranche.", status: 409, voornemen: open.id };

  const gemaakt = await env.DB.prepare(
    `insert into voornemen (positie, soort, nieuwe_strike, nieuwe_expiratiedatum, aantal, reden, aangekondigd_door)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    positieId, soort,
    soort === "rol" ? strike : null,
    soort === "rol" ? String(body.nieuwe_expiratiedatum) : null,
    Number(body.aantal) || tranche.aantal || null,
    body.reden ? String(body.reden).trim() : null,
    ik.id
  ).run();

  return { voornemen: gemaakt.meta ? gemaakt.meta.last_row_id : null, positie: positieId, soort };
}

export async function trekIn(env, ik, voornemenId, reden = null) {
  const v = await env.DB.prepare(
    "select * from voornemen where id = ? and archief = 0"
  ).bind(voornemenId).first();
  if (!v) return { fout: `Geen voornemen met nummer ${voornemenId}.`, status: 404 };
  if (v.status !== "aangekondigd") {
    return { fout: "Dit voornemen staat niet meer open.", status: 409 };
  }
  await env.DB.prepare(
    "update voornemen set status = 'ingetrokken', toelichting = ?, revisie = revisie + 1 where id = ?"
  ).bind(reden, voornemenId).run();
  return { voornemen: voornemenId, status: "ingetrokken" };
}

// ------------------------------------------------------------- toepassen
//
// Draait bij elke stand die binnenkomt — van de brug, of uit het nachtelijke
// rapport. `posities` is wat er nú open staat, `uitvoeringen` zijn de trades
// met hun prijs. Beide bronnen leveren dezelfde vorm; wie de bron is, doet er
// hier niet toe.
export async function pasVoornemensToe(env, ik, posities = [], uitvoeringen = [], nu = null) {
  const moment = nu || new Date().toISOString().slice(0, 19).replace("T", " ");

  const open = (await env.DB.prepare(
    `select v.*, p.conid, p.strike, p.expiratiedatum, p.aantal as tranche_aantal,
            p.ontvangen_premie_pt, p.cyclus, p.tranche as nummer,
            (select count(*) from exitregel e
              where e.positie = p.id and e.archief = 0 and e.soort = 'stoploss'
                and e.geraakt_op is not null) as stoploss_geraakt
       from voornemen v join positie p on p.id = v.positie
      where v.status = 'aangekondigd' and v.archief = 0 and p.archief = 0`
  ).all()).results;
  if (!open.length) return { bekeken: 0, afgerond: 0, afwijkend: 0 };

  const hoortBij = (v, r) =>
    v.conid && r.conid ? String(v.conid) === String(r.conid)
      : gelijk(v.strike, r.strike) && v.expiratiedatum === r.expiratiedatum;

  let afgerond = 0, afwijkend = 0;

  for (const v of open) {
    // De sluiting: een terugkoop van dít contract, ná de aankondiging. Wat
    // ervóór gebeurde hoort bij iets anders.
    const sluiting = uitvoeringen
      .filter((r) => r.richting === "koop" && hoortBij(v, r))
      .filter((r) => na(r, v.aangekondigd_op))
      .pop();
    const nogOpen = posities.some((p) => hoortBij(v, p));

    if (!sluiting) continue;                     // nog niets gebeurd
    if (!v.gezien_op) {
      await env.DB.prepare("update voornemen set gezien_op = ? where id = ?")
        .bind(sluiting.moment || moment, v.id).run();
    }
    if (nogOpen) continue;                       // deels gevuld: nog niet rond

    if (v.soort === "terugkopen") {
      const uit = await legVast(env, ik, v.positie, {
        uitkomst: v.stoploss_geraakt ? "exitplan uitgevoerd" : "vervroegd teruggekocht",
        sluittijdstip: sluiting.datum || moment.slice(0, 10),
        resultaat_pt: resultaatPunten({ ontvangen_premie_pt: v.ontvangen_premie_pt }, sluiting),
        teruggekocht_pt: sluiting.prijs_pt,
        reden_exit: v.reden,
      });
      if (uit.fout) continue;
      await env.DB.prepare(
        "update voornemen set status = 'uitgevoerd', uitgevoerd_op = ?, revisie = revisie + 1 where id = ?"
      ).bind(moment, v.id).run();
      afgerond++;
      continue;
    }

    // Een rol: het contract dat ervoor in de plaats kwam moet passen bij wat
    // je aankondigde. Past het niet, dan is dit geen bevestiging maar een
    // afwijking — en die hoort een mens te zien.
    const opening = uitvoeringen
      .filter((r) => r.richting === "verkoop" && r.soort !== "sluitend")
      .filter((r) => String(r.conid) !== String(v.conid))
      .filter((r) => String(r.moment || r.datum || "") >= String(sluiting.moment || sluiting.datum || ""))
      .pop();

    if (!opening) continue;                      // gesloten, nieuwe nog niet binnen

    const past = gelijk(opening.strike, v.nieuwe_strike)
      && String(opening.expiratiedatum) === String(v.nieuwe_expiratiedatum);
    if (!past) {
      await env.DB.prepare(
        `update voornemen set status = 'wijkt af', afwijking = ?, revisie = revisie + 1 where id = ?`
      ).bind(
        `Aangekondigd: strike ${v.nieuwe_strike} op ${v.nieuwe_expiratiedatum}. ` +
        `Geopend: ${opening.contract || `strike ${opening.strike} op ${opening.expiratiedatum}`}.`,
        v.id
      ).run();
      afwijkend++;
      continue;
    }

    // Zonder fill-prijs kan de nieuwe tranche niet gepubliceerd worden: dan
    // zou er een geschatte premie naar de leden gaan. Hij ontstaat wel, maar
    // blijft staan tot de prijs er is.
    const prijs = Number(opening.prijs_pt);
    const uit = await legVast(env, ik, v.positie, {
      uitkomst: "doorgerold",
      sluittijdstip: sluiting.datum || moment.slice(0, 10),
      resultaat_pt: resultaatPunten({ ontvangen_premie_pt: v.ontvangen_premie_pt }, sluiting),
      teruggekocht_pt: sluiting.prijs_pt,
      reden_exit: v.reden,
      opvolger: {
        contract: opening.contract, strike: opening.strike,
        expiratiedatum: opening.expiratiedatum, aantal: opening.aantal,
        premie_pt: Number.isFinite(prijs) ? prijs : null,
        conid: opening.conid, datum: opening.datum,
        status: Number.isFinite(prijs) ? "publiceren naar leden" : "uitvoering ophalen",
      },
    });
    if (uit.fout) continue;

    // Het exitplan van de nieuwe tranche rekent tegen háár premie — dat is wat
    // we besloten over de premie-referentie: per tranche, de keten pas in de
    // post-analyse.
    if (uit.opvolger) {
      const nieuw = await env.DB.prepare("select * from positie where id = ?").bind(uit.opvolger).first();
      await zetExitplanKlaar(env, ik, uit.opvolger, nieuw).catch(() => null);
      await herberekenExitplan(env, uit.opvolger, nieuw).catch(() => null);
    }

    await env.DB.prepare(
      `update voornemen set status = 'uitgevoerd', uitgevoerd_op = ?, opvolger = ?, revisie = revisie + 1
        where id = ?`
    ).bind(moment, uit.opvolger, v.id).run();
    afgerond++;
  }

  return { bekeken: open.length, afgerond, afwijkend };
}
