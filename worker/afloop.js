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
    return { tranche: tranche.id, gewijzigd: false, bewijs: { open_bij_lynx: true } };
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

  return { tranche: tranche.id, gewijzigd: false, bewijs: { open_bij_lynx: true } };
}

// Alle lopende tranches tegen het laatste rapport.
export async function voorstellen(env, vandaag = new Date().toISOString().slice(0, 10)) {
  const rapport = await laatsteRapport(env);
  if (!rapport) {
    return { koppeling: false, reden: "Er is nog geen rapport van Lynx aangeleverd.", regels: [] };
  }

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

  let posities = [];
  let transacties = [];
  try {
    posities = leesPosities(rapport.xml);
    transacties = leesTransacties(rapport.xml);
  } catch (fout) {
    return { koppeling: false, reden: `Het rapport van Lynx was niet te lezen: ${fout.message}`, regels: [] };
  }

  return {
    koppeling: true,
    opgehaald_op: rapport.opgehaald_op,
    regels: tranches.map((t) => ({
      ...duidTranche(t, posities, transacties, vandaag),
      cyclus: t.cyclus,
      cyclusnaam: t.cyclusnaam,
      nummer: t.tranche,
      contract: t.contract,
      strike: t.strike,
      expiratiedatum: t.expiratiedatum,
      aantal: t.aantal,
      status: t.status,
    })),
  };
}
