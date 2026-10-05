// Alle migraties achter elkaar op een database met echte rijen erin.
//
// Net als D1: foreign keys aan, en elke migratie in een eigen transactie. Zonder
// die twee dingen gaat een tabelherbouw hier moeiteloos door en pas op staging
// stuk — een DROP van een oudertabel met kinderen eronder is dan ineens een
// FOREIGN KEY constraint failed.
//
// Een lege database verbergt de helft van de fouten: een insert die nul rijen
// raakt kan geen NOT NULL breken, en een update die niets vindt klaagt nooit.
// Daarom staan hier een cyclus, een gesprek, een event en een voorwaarde in
// vóór de laatste migraties eroverheen gaan.
//
//   node scripts/proef/migraties.mjs            alles, van nul
//   node scripts/proef/migraties.mjs 0082       zaaien vlak vóór 0082
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const grens = process.argv[2] || null;
const db = new DatabaseSync(":memory:");
db.exec("pragma foreign_keys = on");
const alle = fs.readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();

const zaai = () => {
  db.exec("insert into cyclus (id,label,geopend_op,doelexpiratie) values (1,'Proef A','2026-10-01','2026-11-29')");
  db.exec("insert into cyclus (id,label,geopend_op,doelexpiratie) values (2,'Proef B','2026-10-02','2026-12-18')");
  db.exec("insert into beoordelingsmoment (id,cyclus,datum) values (7,1,'2026-10-03')");
  db.exec("insert into event (datum,naam,soort,zwaarte) values ('2026-10-16','Proef CPI','macro','zwaar')");
  db.exec("insert into voorwaarde (cyclus,naam,soort,status) values (1,'VSTOXX boven 18','instap','groen')");
  try {
    db.exec("insert into positie (id,cyclus,beoordelingsmoment,tranche,status,contract,strike,expiratiedatum,aantal) values (1,1,7,1,'bewaken','OESX 6050 PUT',6050,'2026-10-16',-4)");
    db.exec("insert into exitregel (positie,volgorde,soort,omschrijving) values (1,10,'stoploss','Terugkopen boven ask 60,0')");
  } catch { /* bestaat nog niet */ }
  try { db.exec("insert into voornemen (positie,soort) values (1,'rol')"); } catch { /* bestaat nog niet */ }
  try { db.exec("insert into chartlezing (beoordelingsmoment,onderwerp,vast,volgorde) values (7,'Moving Average 8, 20, 50',1,10)"); } catch { /* bestaat nog niet */ }
};

let gezaaid = false;
for (const bestand of alle) {
  if (grens && !gezaaid && bestand.startsWith(grens)) { zaai(); gezaaid = true; }
  try {
    db.exec("begin");
    db.exec(fs.readFileSync("migrations/" + bestand, "utf8"));
    db.exec("commit");
  } catch (fout) {
    try { db.exec("rollback"); } catch { /* al teruggedraaid */ }
    console.error(`FOUT in ${bestand}\n  ${fout.message}`);
    process.exit(1);
  }
}
if (!grens) zaai();

const versie = db.prepare("select max(versie) v from schema_versie").get().v;
console.log(`alle ${alle.length} migraties toegepast · schema_versie ${versie}`);
