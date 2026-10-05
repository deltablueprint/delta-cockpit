// Hoe een tranche eindigt.
//
// Niet via het besluitproces: doorrollen, vervroegd terugkopen en een stoploss
// die raakt zijn tijdsgevoelig, en wie daarvoor eerst een overleg moet beleggen
// is het moment kwijt (BOUWSPEC 6). De handeling gebeurt bij Lynx; de cockpit
// leest achteraf wat er gebeurd is en vraagt om duiding.
//
// Dit bestand doet alleen dat eerste: lezen en voorstellen. Het legt niets
// vast, het verandert niets, en het stelt nooit iets voor zonder erbij te
// zetten wát het gezien heeft. Een mens bevestigt of corrigeert.

import { laatsteRapport, leesPosities, leesTransacties } from "./lynx.js";
import { zetExitplanKlaar, rekOpDoelexpiratie } from "./positie.js";

// Een tranche die nog loopt: alles wat niet gesloten is en al in de markt staat.
const LOPEND = ["uitvoering ophalen", "publiceren naar leden", "bewaken"];

const gelijk = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined
  && Math.abs(Number(a) - Number(b)) < 0.001;

// Hoort deze transactie bij deze tranche? Het contractnummer is de zekerste
// sleutel; staat dat er niet op, dan vallen we terug op strike en expiratie.
function hoortBij(tranche, r) {
  if (tranche.conid && r.conid) return String(tranche.conid) === String(r.conid);
  return gelijk(tranche.strike, r.strike) && tranche.expiratiedatum === r.expiratiedatum;
}

// Het voorstel voor één tranche, met het bewijs erbij.
export function duidTranche(tranche, posities, transacties, vandaag) {
  const nog = posities.find((p) => hoortBij(tranche, p));
  const mijn = transacties.filter((r) => hoortBij(tranche, r));
  const sluitend = mijn.filter((r) => r.richting === "koop" && r.soort !== "openend");
  const laatste = sluitend[sluitend.length - 1] || null;

  // Staat hij nog open bij de broker en is er niets teruggekocht, dan is er
  // niets gebeurd. Dat is ook een antwoord.
  if (nog && !sluitend.length) {
    return {
      tranche: tranche.id, gewijzigd: false, voorstel: null,
      waarom: "Staat nog open bij Lynx en er is niets teruggekocht.",
      bewijs: { open_bij_lynx: true },
    };
  }

  // Teruggekocht. Is er op dezelfde dag een nieuw contract geschreven op
  // dezelfde onderliggende waarde en verder in de tijd, dan is dat een rol.
  if (laatste) {
    const opvolger = transacties.find((r) =>
      r.richting === "verkoop" && r.soort !== "sluitend"
      && r.datum === laatste.datum
      && r.onderliggend === laatste.onderliggend
      && String(r.conid) !== String(laatste.conid)
      && (r.expiratiedatum || "") > (laatste.expiratiedatum || ""));

    if (opvolger) {
      return {
        tranche: tranche.id, gewijzigd: true, voorstel: "doorgerold",
        waarom: "Teruggekocht en op dezelfde dag een contract verder in de tijd geschreven.",
        sluiting: laatste, opvolger,
        bewijs: { transacties: [laatste, opvolger] },
      };
    }

    // Een stoploss die geraakt is, maakt van een terugkoop een uitgevoerd
    // exitplan. Of dat zo was, weet de cockpit uit haar eigen exitregels — niet
    // uit het rapport, want daar staan geen koersen in.
    const soort = tranche.stoploss_geraakt ? "exitplan uitgevoerd" : "vervroegd teruggekocht";
    return {
      tranche: tranche.id, gewijzigd: true, voorstel: soort,
      waarom: tranche.stoploss_geraakt
        ? "Teruggekocht terwijl de stoploss geraakt was."
        : "Teruggekocht vóór de expiratie, zonder nieuw contract erna.",
      sluiting: laatste,
      bewijs: { transacties: [laatste] },
    };
  }

  // Niets teruggekocht en hij staat niet meer open: dan is hij afgelopen. Alleen
  // als de expiratiedatum ook werkelijk voorbij is — anders weten we het niet en
  // zeggen we dat.
  if (!nog) {
    if (tranche.expiratiedatum && tranche.expiratiedatum <= vandaag) {
      return {
        tranche: tranche.id, gewijzigd: true, voorstel: "waardeloos geexpireerd",
        waarom: "Niet meer open bij Lynx, geen terugkoop in het rapport, expiratie voorbij.",
        bewijs: { open_bij_lynx: false, expiratie: tranche.expiratiedatum },
      };
    }
    return {
      tranche: tranche.id, gewijzigd: true, voorstel: null,
      waarom: "Deze tranche staat niet meer open bij Lynx, maar het rapport laat niet zien waardoor. Kies zelf wat het werd.",
      bewijs: { open_bij_lynx: false, expiratie: tranche.expiratiedatum },
    };
  }

  return {
    tranche: tranche.id, gewijzigd: false, voorstel: null,
    waarom: "Staat nog open bij Lynx en er is niets teruggekocht.",
    bewijs: { open_bij_lynx: true },
  };
}

// Waar de stand vandaan komt.
//
// Leeft de brug, dan is dát de waarheid van dit moment: hij duwt elke
// verandering binnen een seconde door. Het Flex-rapport is rapportage van
// gisteren en dient als vangnet. Eerst de stroom, dan het rapport — anders kijk
// je naar een beeld van vanochtend terwijl er net iets gebeurd is.
export async function huidigeStand(env) {
  try {
    const v = await env.DB.prepare(
      `select verbonden,
              cast((julianday('now') - julianday(coalesce(laatste_bericht, '2000-01-01'))) * 86400 as integer) as stil
         from brokerverbinding where id = 1`
    ).first();
    if (v && Number(v.verbonden) === 1 && Number(v.stil) < 300) {
      const { brugPosities, brugUitvoeringen } = await import("./brug.js");
      return {
        bron: "brug", opgehaald_op: `${v.stil} seconden geleden`,
        posities: await brugPosities(env), uitvoeringen: await brugUitvoeringen(env),
      };
    }
  } catch { /* geen brug in deze omgeving */ }

  const rapport = await laatsteRapport(env);
  if (!rapport) return null;
  try {
    return {
      bron: "rapport", opgehaald_op: rapport.opgehaald_op,
      posities: leesPosities(rapport.xml), uitvoeringen: leesTransacties(rapport.xml),
    };
  } catch (fout) {
    return { bron: "rapport", fout: `Het rapport van Lynx was niet te lezen: ${fout.message}` };
  }
}

// Alle lopende tranches tegen de laatste stand.
export async function voorstellen(env, vandaag = new Date().toISOString().slice(0, 10)) {
  const stand = await huidigeStand(env);
  if (!stand) {
    return {
      koppeling: false,
      reden: "De brug is stil en er is geen rapport van Lynx. Zonder stand valt er niets te duiden.",
      regels: [],
    };
  }
  if (stand.fout) return { koppeling: false, reden: stand.fout, regels: [] };

  const plek = LOPEND.map(() => "?").join(",");
  const tranches = (await env.DB.prepare(
    `select p.*, c.label as cyclusnaam,
            (select count(*) from exitregel e
              where e.positie = p.id and e.archief = 0 and e.soort = 'stoploss'
                and e.geraakt_op is not null) as stoploss_geraakt
       from positie p join cyclus c on c.id = p.cyclus
      where p.archief = 0 and p.status in (${plek})
      order by p.cyclus, p.tranche`
  ).bind(...LOPEND).all()).results;

  const posities = stand.posities;
  const transacties = stand.uitvoeringen;

  // Zolang de brug niet leeft, is dit het moment waarop er een verse stand is:
  // dan hoort de vlag hier bijgewerkt te worden. Met de brug erbij is hij al
  // bij, en kost dit niets.
  await markeer(env, posities, transacties, vandaag).catch(() => null);

  return {
    koppeling: true,
    bron: stand.bron,
    opgehaald_op: stand.opgehaald_op,
    nieuw: await verweesd(env, posities, transacties),
    cycli: (await env.DB.prepare(
      `select id, label from cyclus
        where archief = 0 and status not in ('afgesloten') order by geopend_op desc`
    ).all()).results,
    regels: tranches.map((t) => {
      const uit = duidTranche(t, posities, transacties, vandaag);
      return {
      ...uit,
      resultaat_pt: resultaatPunten(t, uit.sluiting, uit.voorstel),
      teruggekocht_pt: uit.sluiting ? uit.sluiting.prijs_pt : (uit.voorstel === "waardeloos geexpireerd" ? 0 : null),
      cyclus: t.cyclus,
      cyclusnaam: t.cyclusnaam,
      nummer: t.tranche,
      contract: t.contract,
      strike: t.strike,
      expiratiedatum: t.expiratiedatum,
      aantal: t.aantal,
      ontvangen_premie_pt: t.ontvangen_premie_pt,
      status: t.status,
      }; }),
  };
}

// ------------------------------------------------------------- vastleggen
//
// Wat het systeem voorstelt, legt een mens vast. Pas hier verandert er iets —
// en alleen wat je bevestigt: de uitkomst, het moment, het resultaat, en bij
// een rol de tranche die eruit voortkwam.
//
// Het systeem rekent het resultaat uit, maar het oordeelt niet: ontvangen
// premie min terugkoopprijs is een aftrekking, geen mening. Je kunt het getal
// overschrijven; dan staat jouw getal er.

const UITKOMSTEN = ["doorgerold", "exitplan uitgevoerd", "vervroegd teruggekocht", "waardeloos geexpireerd"];

export async function legVast(env, ik, positieId, body = {}) {
  const tranche = await env.DB.prepare(
    "select * from positie where id = ? and archief = 0"
  ).bind(positieId).first();
  if (!tranche) return { fout: `Geen tranche met nummer ${positieId}.`, status: 404 };
  if (tranche.status === "gesloten") {
    return { fout: "Deze tranche is al afgesloten.", status: 409 };
  }

  const uitkomst = String(body.uitkomst || "");
  if (!UITKOMSTEN.includes(uitkomst)) {
    return { fout: "Kies wat er met deze tranche gebeurd is.", status: 422, veld: "uitkomst" };
  }
  // Een rol zonder opvolger is geen rol: dan weet niemand wat er in de plaats
  // kwam, en de keten breekt af bij de post-analyse.
  const opvolger = body.opvolger || null;
  if (uitkomst === "doorgerold" && (!opvolger || !opvolger.strike || !opvolger.expiratiedatum)) {
    return {
      fout: "Bij een rol hoort het contract dat ervoor in de plaats kwam: strike en expiratie.",
      status: 422, veld: "opvolger",
    };
  }

  const sluittijdstip = body.sluittijdstip || null;
  const resultaat = body.resultaat_pt === null || body.resultaat_pt === undefined || body.resultaat_pt === ""
    ? null : Number(body.resultaat_pt);
  const reden = body.reden_exit ? String(body.reden_exit).trim() : null;
  // Waarvoor je eruit kwam. Bij een waardeloze expiratie is dat nul — je
  // betaalde niets — en dat is een getal, geen leegte.
  const teruggekocht = uitkomst === "waardeloos geexpireerd"
    ? 0
    : (body.teruggekocht_pt === null || body.teruggekocht_pt === undefined || body.teruggekocht_pt === ""
        ? null : Number(body.teruggekocht_pt));

  // Bij een rol ontstaat de volgende tranche van dezelfde cyclus. Hij begint
  // bij 'bewaken': hij staat in de markt, de uitvoering is al gebeurd.
  let nieuweId = null;
  if (uitkomst === "doorgerold") {
    const hoogste = await env.DB.prepare(
      "select max(tranche) as n from positie where cyclus = ? and archief = 0"
    ).bind(tranche.cyclus).first();
    const nummer = (Number(hoogste && hoogste.n) || Number(tranche.tranche) || 0) + 1;
    const gemaakt = await env.DB.prepare(
      // Een tranche uit een rol draagt géén besluit. Er is er ook geen: het
      // besluitproces liep op de eerste tranche, en rollen gaat er bewust
      // buitenom omdat het tijdsgevoelig is. De keten blijft wél leesbaar via
      // doorgerold_naar — dat is waar de post-analyse hem volgt.
      `insert into positie
         (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
          ontvangen_premie_pt, conid, herkomst, uitvoering_op, inzet_pct,
          toelichting, aangemaakt_door)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'broker', ?, ?, ?, ?)`
    ).bind(
      tranche.cyclus, nummer,
      opvolger.status || "bewaken",
      opvolger.contract || null, Number(opvolger.strike), opvolger.expiratiedatum,
      opvolger.aantal ?? tranche.aantal, opvolger.premie_pt ?? null, opvolger.conid || null,
      opvolger.datum || sluittijdstip || null, tranche.inzet_pct,
      `Ontstaan uit de rol van tranche ${tranche.tranche}.`, ik.id
    ).run();
    nieuweId = gemaakt.meta ? gemaakt.meta.last_row_id : null;
    // Een rol verlengt de boog: de cyclus loopt tot de laatste tranche dicht is.
    await rekOpDoelexpiratie(env, tranche.cyclus, opvolger.expiratiedatum).catch(() => null);
  }

  await env.DB.prepare(
    `update positie
        set status = 'gesloten', uitkomst = ?, sluittijdstip = ?, resultaat_pt = ?,
            teruggekocht_pt = ?, reden_exit = ?,
            doorgerold_naar = coalesce(?, doorgerold_naar), revisie = revisie + 1
      where id = ?`
  ).bind(uitkomst, sluittijdstip, resultaat, teruggekocht, reden, nieuweId, positieId).run();

  return { tranche: positieId, uitkomst, opvolger: nieuweId, cyclus: tranche.cyclus };
}

// Het resultaat van een tranche in punten: wat je ontving min wat je betaalde
// om hem terug te kopen. Expireert hij waardeloos, dan hield je de hele premie.
export function resultaatPunten(tranche, sluiting, uitkomst = null) {
  const ontvangen = Number(tranche.ontvangen_premie_pt);
  if (!Number.isFinite(ontvangen)) return null;
  // Geen terugkoop gezien? Dan is het resultaat alleen bekend als de tranche
  // waardeloos afliep — dan hield je de hele premie. In elk ander geval weet
  // het systeem het niet, en dan hoort er niets te staan in plaats van een
  // getal dat toevallig gelijk is aan de premie.
  if (!sluiting) return uitkomst === "waardeloos geexpireerd" ? Math.round(ontvangen * 10) / 10 : null;
  const betaald = Number(sluiting.prijs_pt);
  if (!Number.isFinite(betaald)) return null;
  return Math.round((ontvangen - betaald) * 10) / 10;
}

// ------------------------------------------------- de stand is binnengekomen
//
// Draait op elke stand die binnenkomt — elke push van de brug, en het
// nachtelijke rapport. Het legt per lopende tranche vast wát het zag, en zet de
// vlag op de cyclus. Zo hoeft geen enkel scherm het rapport te herlezen, en is
// de vlag zo vers als de koppeling.
export async function markeer(env, posities = [], uitvoeringen = [], vandaag = null) {
  const dag = vandaag || new Date().toISOString().slice(0, 10);
  const plek = LOPEND.map(() => "?").join(",");
  const tranches = (await env.DB.prepare(
    `select p.*,
            (select count(*) from exitregel e
              where e.positie = p.id and e.archief = 0 and e.soort = 'stoploss'
                and e.geraakt_op is not null) as stoploss_geraakt
       from positie p
      where p.archief = 0 and p.status in (${plek})`
  ).bind(...LOPEND).all()).results;

  // Een tranche die inmiddels is afgesloten, vraagt nergens meer om: haar vlag
  // hoort weg, ook al wordt ze hieronder niet meer bekeken. Een vlag die blijft
  // staan nadat je hem hebt afgehandeld, leert je hem te negeren.
  const werk = [
    env.DB.prepare(
      `update positie set duiding_voorstel = null, duiding_waarom = null, duiding_op = null
        where duiding_voorstel is not null and (archief = 1 or status not in (${plek}))`
    ).bind(...LOPEND),
  ];
  for (const t of tranches) {
    const uit = duidTranche(t, posities, uitvoeringen, dag);
    // Niets veranderd betekent: de vlag gaat uit. Een vlag die blijft hangen
    // nadat je hem hebt afgehandeld, leert je hem te negeren.
    werk.push(env.DB.prepare(
      "update positie set duiding_voorstel = ?, duiding_waarom = ?, duiding_op = ? where id = ?"
    ).bind(
      uit.gewijzigd ? (uit.voorstel || "onbekend") : null,
      uit.gewijzigd ? (uit.waarom || null) : null,
      uit.gewijzigd ? dag : null,
      t.id
    ));
  }
  if (werk.length) await env.DB.batch(werk);

  // De vlag op de cyclus is de optelsom: staat er één tranche open die om
  // duiding vraagt, dan wil je dat zien zonder de cyclus te openen.
  await env.DB.prepare(
    `update cyclus set duiding_open =
       (select count(*) from positie p
         where p.cyclus = cyclus.id and p.archief = 0 and p.duiding_voorstel is not null)`
  ).run();

  return { bekeken: tranches.length };
}

// ------------------------------------------- een positie die niemand kent
//
// Handel je eerst en kondig je niets aan, dan staat er ineens een contract bij
// Lynx dat bij geen enkele tranche hoort. Dát is een feit — premie, strike,
// expiratie en aantal staan er — en het systeem hoeft er niets over te vinden.
// Wat het niet weet, is het verband: hoort dit bij een tranche die net sloot,
// of is het er een op zichzelf? Die vraag stelt het, in plaats van te gokken.
export async function verweesd(env, posities = [], uitvoeringen = []) {
  const bekend = (await env.DB.prepare(
    `select conid, strike, expiratiedatum from positie
      where archief = 0 and status <> 'gesloten'`
  ).all()).results;
  const kent = (p) => bekend.some((t) =>
    (t.conid && p.conid && String(t.conid) === String(p.conid))
    || (gelijk(t.strike, p.strike) && t.expiratiedatum === p.expiratiedatum));

  // Een tranche die net sloot en nog geen uitkomst draagt, is de meest
  // waarschijnlijke herkomst van een nieuw contract op dezelfde dag.
  const netDicht = (await env.DB.prepare(
    `select p.id, p.cyclus, p.tranche, p.contract, p.strike, p.expiratiedatum, p.conid,
            p.ontvangen_premie_pt, p.duiding_voorstel, c.label as cyclusnaam
       from positie p join cyclus c on c.id = p.cyclus
      where p.archief = 0 and p.duiding_voorstel is not null
      order by p.cyclus, p.tranche`
  ).all()).results;

  return posities.filter((p) => !kent(p)).map((p) => {
    // De prijs waartegen dit contract geopend werd staat in de uitvoeringen.
    // Zonder die prijs kan de tranche wel ontstaan maar niet gepubliceerd
    // worden — dan zou er een geschatte premie naar de leden gaan.
    const opening = uitvoeringen
      .filter((r) => r.richting === "verkoop" && String(r.conid) === String(p.conid))
      .pop();
    return {
      ...p,
      premie_pt: opening ? opening.prijs_pt : null,
      datum: opening ? opening.datum : null,
      mogelijk_vervolg_op: netDicht.map((k) => ({
        ...k,
        // Het resultaat van die tranche als dit haar vervolg is: wat ze opbracht
        // min wat het kostte om haar terug te kopen.
        sluiting: uitvoeringen
          .filter((r) => r.richting === "koop" && String(r.conid) === String(k.conid))
          .pop() || null,
      })),
    };
  });
}

// Een positie die bij Lynx openstaat overnemen als tranche. Het feit wordt
// vastgelegd zoals het is; of hij de voortzetting is van een tranche die net
// sloot, zegt de mens erbij.
export async function neemOver(env, ik, body = {}) {
  const cyclusId = Number(body.cyclus);
  const cyclus = await env.DB.prepare("select * from cyclus where id = ? and archief = 0")
    .bind(cyclusId).first();
  if (!cyclus) return { fout: "Kies de cyclus waar deze positie bij hoort.", status: 422, veld: "cyclus" };

  const p = body.positie || {};
  if (!p.strike || !p.expiratiedatum) {
    return { fout: "Deze positie draagt geen strike of expiratie.", status: 422 };
  }

  // Is het de voortzetting van een tranche die net sloot, dan loopt het via
  // dezelfde weg als een aangekondigde rol: de oude gaat dicht als doorgerold.
  if (body.vervolg_op) {
    const uit = await legVast(env, ik, Number(body.vervolg_op), {
      uitkomst: "doorgerold",
      sluittijdstip: body.sluittijdstip || null,
      resultaat_pt: body.resultaat_pt ?? null,
      teruggekocht_pt: body.teruggekocht_pt ?? null,
      reden_exit: body.reden || "Gerold bij Lynx, achteraf in de cockpit vastgelegd.",
      opvolger: {
        contract: p.contract, strike: p.strike, expiratiedatum: p.expiratiedatum,
        aantal: p.aantal, premie_pt: p.premie_pt ?? null, conid: p.conid, datum: p.datum,
        status: Number.isFinite(Number(p.premie_pt)) ? "publiceren naar leden" : "uitvoering ophalen",
      },
    });
    if (uit.fout) return uit;
    return { tranche: uit.opvolger, cyclus: cyclusId, uit: "vervolg" };
  }

  const hoogste = await env.DB.prepare(
    "select max(tranche) as n from positie where cyclus = ? and archief = 0"
  ).bind(cyclusId).first();
  const nummer = (Number(hoogste && hoogste.n) || 0) + 1;
  const gemaakt = await env.DB.prepare(
    `insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                          ontvangen_premie_pt, conid, herkomst, uitvoering_op, toelichting, aangemaakt_door)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'broker', ?, ?, ?)`
  ).bind(
    cyclusId, nummer,
    Number.isFinite(Number(p.premie_pt)) ? "publiceren naar leden" : "uitvoering ophalen",
    p.contract || null, Number(p.strike), p.expiratiedatum, p.aantal || null,
    p.premie_pt ?? null, p.conid || null, p.datum || null,
    "Overgenomen uit de brokerstand; bij Lynx geopend zonder aankondiging.", ik.id
  ).run();
  const id = gemaakt.meta ? gemaakt.meta.last_row_id : null;
  await rekOpDoelexpiratie(env, cyclusId, p.expiratiedatum).catch(() => null);
  if (id) {
    const nieuw = await env.DB.prepare("select * from positie where id = ?").bind(id).first();
    await zetExitplanKlaar(env, ik, id, nieuw).catch(() => null);
  }
  return { tranche: id, cyclus: cyclusId, uit: "nieuw" };
}
