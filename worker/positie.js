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
     values (?, ?, ?, 'besluit goedgekeurd', ?, ?, ?, ?, ?, ?, ?) returning id`
  ).bind(
    moment.cyclus, moment.id, volgende ? volgende.n : 1,
    moment.strike, moment.expiratiedatum, moment.inzet_pct,
    moment.strike, moment.expiratiedatum, moment.inzet_pct,
    ik.id
  ).first();

  await audit(env, ik, "positie", rij.id, "gebeurtenis",
              { gebeurtenis: "ontstaan uit een goedgekeurd besluit" }).run();
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
