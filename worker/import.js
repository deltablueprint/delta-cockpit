// Importeren uit een document, in twee stappen.
//
//   voorbereiden → het systeem zegt per regel wat er al op die datum staat
//   uitvoeren    → de gebruiker heeft per botsing gekozen, en dat voeren we uit
//
// Er wordt niets overschreven zonder dat iemand dat per regel heeft gezegd,
// en elke import laat een spoor na in de audit trail.

import { vulCycliBijVoorPeriode } from "./events.js";

const TOEGESTAAN = ["datum", "tijdstip", "naam", "soort", "zwaarte", "toelichting", "tijdzone"];

function schoon(rij) {
  const uit = {};
  for (const k of TOEGESTAAN) {
    const w = rij[k];
    uit[k] = w === undefined || w === null || String(w).trim() === "" ? null : String(w).trim();
  }
  return uit;
}

export async function voorbereiden(env, rijen) {
  const uitkomst = [];
  for (let i = 0; i < rijen.length; i++) {
    const rij = schoon(rijen[i]);
    const fouten = [];
    if (!rij.datum || !/^\d{4}-\d{2}-\d{2}$/.test(rij.datum)) fouten.push("datum ontbreekt of is niet jjjj-mm-dd");
    if (!rij.naam) fouten.push("naam ontbreekt");

    let bestaand = [];
    if (!fouten.length) {
      bestaand = (await env.DB.prepare(
        "select id, datum, tijdstip, naam, soort, zwaarte from event where datum = ? and archief = 0 order by tijdstip"
      ).bind(rij.datum).all()).results;
    }

    uitkomst.push({
      nummer: i,
      rij,
      fouten,
      bestaand,
      // Staat er al iets op die dag, dan moet de gebruiker kiezen.
      keuze_nodig: bestaand.length > 0,
    });
  }
  return { regels: uitkomst };
}

export async function uitvoeren(env, ik, regels) {
  let toegevoegd = 0, vervangen = 0, overgeslagen = 0;
  const opdrachten = [];

  for (const regel of regels) {
    const rij = schoon(regel.rij || {});
    const actie = regel.actie || "toevoegen";

    if (actie === "behouden") { overgeslagen++; continue; }

    if (actie === "vervangen" && regel.vervangt) {
      opdrachten.push(
        env.DB.prepare(
          // Bij vervangen blijft een bestaande zwaarte staan als het document
          // er geen meegeeft: die was een menselijk oordeel.
          `update event set datum = ?, tijdstip = ?, naam = ?, soort = coalesce(?, soort),
                  zwaarte = coalesce(?, zwaarte), toelichting = ?, bron = 'import',
                  revisie = revisie + 1
             where id = ?`
        ).bind(rij.datum, rij.tijdstip, rij.naam, rij.soort, rij.zwaarte, rij.toelichting, regel.vervangt),
        env.DB.prepare(
          `insert into audit (wie, tabel, record, soort, gebeurtenis, reden)
           values (?, 'event', ?, 'gebeurtenis', 'vervangen bij import', ?)`
        ).bind(ik.id, regel.vervangt, rij.naam)
      );
      vervangen++;
      continue;
    }

    opdrachten.push(
      env.DB.prepare(
        `insert into event (datum, tijdstip, naam, soort, zwaarte, bron, toelichting, aangemaakt_door, tijdzone)
         values (?, ?, ?, coalesce(?, 'onbekend'), coalesce(?, 'niet gewogen'), 'import', ?, ?, coalesce(?, 'Europe/Brussels'))`
      ).bind(rij.datum, rij.tijdstip, rij.naam, rij.soort, rij.zwaarte, rij.toelichting, ik.id, rij.tijdzone)
    );
    toegevoegd++;
  }

  if (opdrachten.length) await env.DB.batch(opdrachten);

  // Wat erbij komt, hoort meteen zichtbaar te zijn in de cycli waarvan de
  // looptijd eroverheen loopt. Anders moet je na elke import elke cyclus nog
  // eens aanraken voor je ziet wat er speelt.
  await vulCycliBijVoorPeriode(env, regels.map((r) => schoon(r.rij || {}).datum).filter(Boolean));

  return { toegevoegd, vervangen, overgeslagen };
}
