// Een verse database om tegenaan te praten.
//
// De proeven draaiden tot nu toe tegen /tmp/proef.db — een bestand dat je zelf
// moest aanmaken. Wie dat niet wist, kreeg 'Geen cyclus met nummer 7' en kon
// daar niets mee. Hier staat die database in één functie, zodat elke proef
// vanzelf begint met iets wat bestaat.
//
//   const env = { DB: verseDB() };
//
// De zaai is bewust mager: één cyclus, één beoordelingsmoment, één positie,
// de gebruikers die er al zijn. Genoeg om een scherm te vullen, te weinig om iets te
// verbergen.
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";

export const CYCLUS = 7;
export const MOMENT = 3;
export const POSITIE = 9;

export function verseDB(pad = "/tmp/delta-proef.sqlite") {
  rmSync(pad, { force: true });
  const ruw = new DatabaseSync(pad);
  for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    ruw.exec(readFileSync("migrations/" + f, "utf8"));
  }

  // De migraties zetten de drie co-founders er al in; dit is alleen een vangnet
  // voor het geval een proef tegen een oudere versie draait.
  ruw.exec(`insert or ignore into gebruiker (id, naam, korte_naam) values
    ('simon','Simon De Jonghe','Simon'),
    ('jacqueline','Jacqueline Versteeg','Jacqueline'),
    ('pieter','Pieter Boer','Pieter')`);

  ruw.exec(`insert into cyclus (id, label, status, geopend_op, doelexpiratie, volgend_analysemoment)
            values (${CYCLUS}, 'OESX okt 2026', 'besluitvorming', '2026-09-14', '2026-10-30', '2026-09-29')`);

  ruw.exec(`insert into beoordelingsmoment (id, cyclus, datum, aanleiding, status)
            values (${MOMENT}, ${CYCLUS}, '2026-09-29', 'derde beoordeling', 'blind')`);

  ruw.exec(`insert into positie (id, cyclus, beoordelingsmoment, tranche, status, contract,
                                 strike, expiratiedatum, aantal, ontvangen_premie_pt, conid, herkomst)
            values (${POSITIE}, ${CYCLUS}, ${MOMENT}, 1, 'bewaken', 'OESX 30OKT26 5600 PUT',
                    5600, '2026-10-30', 4, 38.5, '5001', 'broker')`);

  ruw.exec(`insert into voorwaarde (cyclus, naam, soort, status, volgorde) values
    (${CYCLUS}, 'Daling t.o.v. vorige top', 'instap', 'groen', 10),
    (${CYCLUS}, 'VSTOXX bandbreedte',       'instap', 'groen', 20),
    (${CYCLUS}, 'Volumebevestiging',        'instap', 'rood',  30)`);

  ruw.close();
  return maakDB(pad);
}
