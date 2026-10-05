// Etappe 11 — de positie.
//
// Eén uitgevoerde tranche is één record met een status (BOUWSPEC 10.0f). Dit
// bestand doet de drie dingen die niet in een formulier passen:
//
//   1. een positie laten ontstaan uit een goedgekeurd besluit
//   2. de uitvoering tegen dat besluit leggen en afwijkingen vastleggen
//   3. de stoploss bewaken: aanscherpen mag, verruimen niet
//
// Wat het niet doet: orders plaatsen. Dat blijft mensenwerk, ook als de
// brokerkoppeling er is (hard uitgangspunt 1).

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

export async function instelling(env) {
  try {
    return await env.DB.prepare(
      `select * from portefeuille_instelling
        where archief = 0 and geldig_vanaf <= date('now')
        order by geldig_vanaf desc limit 1`
    ).first();
  } catch {
    return null;
  }
}

// --------------------------------------------------- uit een go een tranche
// Een go is een besluit, geen positie. Maar het besluit draagt alles wat de
// eerste tranche nodig heeft, en het overtypen daarvan is precies hoe een
// uitvoering ongemerkt van een besluit gaat afwijken. Dus kopiëren we het,
// en bewaren we apart wat het besluit zei.
export async function uitBesluit(env, ik, moment) {
  if (!moment || moment.uitkomst !== "go") return null;

  let bestaand = null;
  try {
    bestaand = await env.DB.prepare(
      "select id from positie where beoordelingsmoment = ? and archief = 0"
    ).bind(moment.id).first();
  } catch {
    return null;   // de tabel bestaat nog niet in deze omgeving
  }
  if (bestaand) return bestaand.id;

  const volgende = await env.DB.prepare(
    "select coalesce(max(tranche), 0) + 1 as n from positie where cyclus = ? and archief = 0"
  ).bind(moment.cyclus).first();

  const rij = await env.DB.prepare(
    `insert into positie (cyclus, beoordelingsmoment, tranche, status,
                          strike, expiratiedatum, inzet_pct,
                          besluit_strike, besluit_expiratiedatum, besluit_inzet_pct,
                          aangemaakt_door)
     values (?, ?, ?, 'exitplan en order', ?, ?, ?, ?, ?, ?, ?) returning id`
  ).bind(
    moment.cyclus, moment.id, volgende ? volgende.n : 1,
    moment.strike, moment.expiratiedatum, moment.inzet_pct,
    moment.strike, moment.expiratiedatum, moment.inzet_pct,
    ik.id
  ).first();

  await audit(env, ik, "positie", rij.id, "gebeurtenis",
              { gebeurtenis: "ontstaan uit een goedgekeurd besluit" }).run();
  await zetExitplanKlaar(env, ik, rij.id, { strike: moment.strike });
  return rij.id;
}

// --------------------------------------------------- uitvoering ↔ besluit
// Wijkt de uitvoering af van wat besloten is, dan hoort dat vastgelegd te
// worden — anders toetst de post-analyse straks een besluit tegen een
// uitvoering die er misschien niet op leek (6). De tolerantie is een
// instelling, geen getal in deze code.
export function wijktAf(rij, tolerantiePct) {
  const redenen = [];
  const er = (w) => w !== null && w !== undefined && w !== "";

  if (er(rij.besluit_strike) && er(rij.strike) && Number(rij.strike) !== Number(rij.besluit_strike)) {
    redenen.push("andere strike");
  }
  if (er(rij.besluit_expiratiedatum) && er(rij.expiratiedatum) &&
      String(rij.expiratiedatum) !== String(rij.besluit_expiratiedatum)) {
    redenen.push("andere expiratie");
  }
  if (er(rij.besluit_inzet_pct) && er(rij.inzet_pct)) {
    const tolerantie = Number(tolerantiePct ?? 10);
    const besloten = Number(rij.besluit_inzet_pct);
    const nu = Number(rij.inzet_pct);
    if (besloten > 0 && (besloten - nu) / besloten * 100 > tolerantie) redenen.push("minder contracten");
  }
  return redenen;
}

// --------------------------------------------------- de stoploss
// Aanscherpen mag, verruimen wordt geweigerd en genoteerd (6). Bij een ask-
// niveau is een hóger getal ruimer: je laat de optie verder oplopen voor je
// sluit.
export function stoplossVerruimd(oud, nieuw) {
  if (oud === null || oud === undefined || nieuw === null || nieuw === undefined) return false;
  return Number(nieuw) > Number(oud);
}

export async function noteerGeweigerdeStoploss(env, ik, id, oud, nieuw) {
  await audit(env, ik, "positie", id, "gebeurtenis", {
    gebeurtenis: "verruiming van de stoploss geweigerd",
    oude: String(oud), nieuwe: String(nieuw),
  }).run();
}

// Het nummer van de tranche volgt uit de cyclus: het is een telling, geen
// keuze. En de contractnaam stelt het systeem samen uit wat er al staat —
// OESX, de expiratiemaand en de strike — zodat hij nooit afwijkt van de
// velden eronder.
export async function volgendeTranche(env, cyclusId) {
  if (!cyclusId) return 1;
  try {
    const r = await env.DB.prepare(
      "select coalesce(max(tranche), 0) + 1 as n from positie where cyclus = ? and archief = 0"
    ).bind(cyclusId).first();
    return r ? r.n : 1;
  } catch {
    return 1;
  }
}

const MAAND = ["JAN", "FEB", "MRT", "APR", "MEI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];

export function contractnaam(rij) {
  if (!rij || !rij.expiratiedatum || rij.strike === null || rij.strike === undefined || rij.strike === "") {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(rij.expiratiedatum));
  if (!m) return null;
  const strike = Number(rij.strike);
  return `OESX ${m[3]}${MAAND[Number(m[2]) - 1]}${m[1].slice(2)} ${Number.isInteger(strike) ? strike : strike.toFixed(1)} PUT`;
}

// --------------------------------------------------- het exitplan
// Vier afspraken, klaargezet zodra de tranche bestaat. Het systeem vult in wat
// het kan uitrekenen; wat een afspraak tussen mensen is — welke events
// voortijdig sluiten — blijft leeg tot iemand het invult. Leeg laten kan niet:
// zonder stoploss en zonder eventregel komt de tranche de eerste stand niet uit.
export function exitplanVoor(rij) {
  const premie = Number(rij.ontvangen_premie_pt);
  const strike = Number(rij.strike);
  const heeftPremie = Number.isFinite(premie) && premie > 0;

  return [
    {
      volgorde: 10, soort: "stoploss", eenheid: "ask",
      omschrijving: "Sluiten zodra de laatprijs van de optie op 60,0 staat",
      niveau: 60,
    },
    {
      volgorde: 20, soort: "winstanker", eenheid: "ask",
      omschrijving: "Terugkopen bij 70 % van de ontvangen premie — dat is een laatprijs van 30 %",
      niveau: heeftPremie ? Math.round(premie * 0.3 * 10) / 10 : null,
    },
    // Break-even is een ask, en het is de ontvangen premie zelf: koop je terug
    // boven dat bedrag, dan kost de tranche geld. Dat geldt op elke dag,
    // ongeacht volatiliteit of tijdswaarde — het is een aftrekking, geen model.
    //
    // Het oude break-even rekende strike min premie en noemde dat een
    // indexniveau. Dat klopt alleen op de expiratiedag: eerder staat de optie
    // op dat indexniveau veel hoger dan de premie, en sta je onder water
    // terwijl de regel zegt dat je break-even bent. Dat getal is een
    // referentiepunt en geen bewakingsregel, en staat daarom apart.
    {
      volgorde: 30, soort: "break-even", eenheid: "ask",
      omschrijving: "Terugkopen boven deze prijs kost de tranche geld",
      niveau: heeftPremie ? Math.round(premie * 10) / 10 : null,
    },
    {
      volgorde: 35, soort: "expiratieniveau", eenheid: "indexstand",
      omschrijving: "Staat de index op de expiratiedag hieronder, dan kost de tranche geld",
      niveau: Number.isFinite(strike) && heeftPremie ? Math.round((strike - premie) * 10) / 10 : null,
    },
    {
      volgorde: 40, soort: "eventregel", eenheid: null,
      omschrijving: "Welke events sluiten deze tranche voortijdig",
      niveau: null,
    },
  ];
}

export async function zetExitplanKlaar(env, ik, positieId, rij) {
  let bestaat = null;
  try {
    bestaat = await env.DB.prepare(
      "select count(*) as n from exitregel where positie = ?"
    ).bind(positieId).first();
  } catch {
    return;   // de tabel bestaat nog niet in deze omgeving
  }
  if (bestaat && bestaat.n) return;

  await env.DB.batch([
    ...exitplanVoor(rij || {}).map((r) =>
      env.DB.prepare(
        `insert into exitregel (positie, volgorde, soort, omschrijving, niveau, eenheid)
         values (?, ?, ?, ?, ?, ?)`
      ).bind(positieId, r.volgorde, r.soort, r.omschrijving, r.niveau, r.eenheid)
    ),
    audit(env, ik, "positie", positieId, "gebeurtenis", { gebeurtenis: "exitplan klaargezet" }),
  ]);
}

// Het exitplan ligt er vóór de order: de stoploss heeft een niveau en de
// eventregel is ingevuld. Volgorde, geen waarschuwing (6).
export async function exitplanCompleet(env, positieId) {
  try {
    const regels = (await env.DB.prepare(
      "select soort, omschrijving, niveau from exitregel where positie = ? and archief = 0"
    ).bind(positieId).all()).results;
    if (!regels.length) return "Het exitplan staat nog niet klaar.";

    const stop = regels.find((r) => r.soort === "stoploss");
    if (!stop || stop.niveau === null || stop.niveau === undefined) {
      return "Het exitplan gaat vóór de order: zet eerst het stoplossniveau in het exitplan.";
    }
    const event = regels.find((r) => r.soort === "eventregel");
    if (!event || !String(event.omschrijving || "").trim()) {
      return "Zet in het exitplan welke events deze tranche voortijdig sluiten.";
    }
    return null;
  } catch {
    return null;
  }
}

// Verandert de ontvangen premie of de strike, dan kloppen het winstanker en
// break-even niet meer. Regels die al geraakt zijn blijven staan: die horen
// bij wat er toen gebeurde.
export async function herberekenExitplan(env, positieId, rij) {
  try {
    for (const r of exitplanVoor(rij)) {
      if (!["winstanker", "break-even", "expiratieniveau"].includes(r.soort)) continue;
      if (r.niveau === null) continue;
      await env.DB.prepare(
        `update exitregel set niveau = ?, revisie = revisie + 1
          where positie = ? and soort = ? and stand = 'niet geraakt' and archief = 0`
      ).bind(r.niveau, positieId, r.soort).run();
    }
  } catch { /* geen exitplan in deze omgeving */ }
}

// Een tranche bestaat niet zonder goedgekeurd besluit. Zolang er op de cyclus
// geen vastgelegde go ligt, valt er niets in te nemen — en hoort er dus ook
// geen knop te staan die suggereert van wel (BOUWSPEC 5.5: voor uitvoering
// zijn drie go's nodig).
export async function magTrancheAanmaken(env, cyclusId) {
  try {
    const r = await env.DB.prepare(
      `select count(*) as n from beoordelingsmoment
        where cyclus = ? and archief = 0 and status = 'uitkomst vastgelegd' and uitkomst = 'go'`
    ).bind(cyclusId).first();
    return Boolean(r && r.n);
  } catch {
    return false;
  }
}

// --------------------------------------------------- welk besluit eronder ligt
// Alleen de vastgelegde go-besluiten van déze cyclus: een tranche hoort bij een
// besluit dat genomen is, niet bij een moment dat nog loopt of op no-go
// uitkwam. Wat elk besluit zei gaat mee in de lijst, zodat het formulier het
// meteen kan overnemen zodra je een ander kiest.
export async function besluitOpties(env, cyclusId) {
  try {
    const rijen = (await env.DB.prepare(
      `select id, datum, strike, expiratiedatum, inzet_pct, aanleiding
         from beoordelingsmoment
        where cyclus = ? and archief = 0 and status = 'uitkomst vastgelegd' and uitkomst = 'go'
        order by datum desc, id desc`
    ).bind(cyclusId).all()).results;

    return rijen.map((r) => ({
      id: r.id,
      titel: `${r.datum}${r.strike ? ` — strike ${r.strike}` : ""}${r.aanleiding ? ` · ${r.aanleiding}` : ""}`,
      // Wat vastgelegd wordt als 'dit zei het besluit', en wat de tranche
      // ervan overneemt zolang er nog niets is uitgevoerd.
      overnemen: {
        besluit_strike: r.strike,
        besluit_expiratiedatum: r.expiratiedatum,
        besluit_inzet_pct: r.inzet_pct,
        strike: r.strike,
        expiratiedatum: r.expiratiedatum,
        inzet_pct: r.inzet_pct,
      },
    }));
  } catch {
    return [];
  }
}

// Wat het besluit zei, overgeschreven op de tranche. Kopiëren en niet opzoeken:
// een besluit dat later wordt bijgesteld mag de vergelijking met déze
// uitvoering niet met terugwerkende kracht veranderen.
export async function neemBesluitOver(env, momentId, stand) {
  if (!momentId) return null;
  try {
    const m = await env.DB.prepare(
      "select strike, expiratiedatum, inzet_pct from beoordelingsmoment where id = ?"
    ).bind(momentId).first();
    if (!m) return null;
    const uit = {
      besluit_strike: m.strike,
      besluit_expiratiedatum: m.expiratiedatum,
      besluit_inzet_pct: m.inzet_pct,
    };
    // Zolang er niets is uitgevoerd, is de tranche nog het besluit. Daarna
    // staat er een werkelijkheid in die velden die een voornemen niet mag
    // overschrijven.
    if (!stand || stand === "exitplan en order") {
      uit.strike = m.strike;
      uit.expiratiedatum = m.expiratiedatum;
      uit.inzet_pct = m.inzet_pct;
    }
    return uit;
  } catch {
    return null;
  }
}

// De premie wordt ingevuld in contractwaarde en gerekend in punten. Eén van
// de twee is de invoer en de ander volgt eruit; ze allebei laten invullen
// levert vroeg of laat twee waarheden op (BOUWSPEC 5.4).
export async function premieInPunten(env, rij) {
  const eur = Number(rij.ontvangen_premie_eur);
  if (!Number.isFinite(eur)) return null;
  const inst = await instelling(env);
  const multiplier = inst && inst.multiplier ? Number(inst.multiplier) : 10;
  if (!multiplier) return null;
  return Math.round((eur / multiplier) * 100) / 100;
}

// Een rol verlengt de boog.
//
// Opent er een tranche met een expiratie voorbij de doelexpiratie van de
// cyclus, dan klopt die doelexpiratie niet meer: de cyclus loopt tot de laatste
// tranche dicht is. Hem laten staan zou betekenen dat de looptijd op elk scherm
// korter lijkt dan ze is, en dat de events ná die datum niet meer in de cyclus
// komen — terwijl je er juist doorheen moet.
export async function rekOpDoelexpiratie(env, cyclusId, datum) {
  if (!cyclusId || !datum) return false;
  const c = await env.DB.prepare("select doelexpiratie from cyclus where id = ?")
    .bind(cyclusId).first();
  if (!c) return false;
  if (c.doelexpiratie && String(c.doelexpiratie) >= String(datum)) return false;

  await env.DB.prepare(
    "update cyclus set doelexpiratie = ?, revisie = revisie + 1 where id = ?"
  ).bind(String(datum), cyclusId).run().catch(async () => {
    // Niet elke omgeving heeft een revisiekolom op de cyclus.
    await env.DB.prepare("update cyclus set doelexpiratie = ? where id = ?")
      .bind(String(datum), cyclusId).run();
  });

  // De events volgen de looptijd: wat na de oude datum viel hoorde er niet bij
  // en hoort er nu wel bij.
  try {
    const { vulEventsBij } = await import("./events.js");
    await vulEventsBij(env, cyclusId);
  } catch { /* zonder eventskalender gebeurt er niets */ }
  return true;
}
