// De herkenning toetsen tegen een echt Flex-rapport.
//
//   node scripts/proef/afloop.mjs <rapport.xml> [proef.db]
//
// Leest het rapport, toont wat eruit te lezen valt, en — als er een database
// bij staat — wat het systeem per lopende tranche zou voorstellen. Het legt
// niets vast en verandert niets.
import { readFileSync } from "node:fs";
import { maakDB } from "./d1.mjs";
import { leesPosities, leesTransacties } from "../../worker/lynx.js";
import { duidTranche } from "../../worker/afloop.js";

const xml = readFileSync(process.argv[2], "utf8");
const posities = leesPosities(xml);
const transacties = leesTransacties(xml);
const vandaag = process.argv[4] || new Date().toISOString().slice(0, 10);

console.log(`\nOPEN POSITIES (${posities.length})`);
for (const p of posities) {
  console.log(`  ${String(p.conid).padEnd(12)} ${p.contract.padEnd(34)} ${String(p.aantal).padStart(3)} × ${p.premie_pt} pt`);
}

console.log(`\nTRANSACTIES (${transacties.length})`);
for (const r of transacties) {
  console.log(`  ${(r.datum || "?").padEnd(11)} ${String(r.conid).padEnd(12)} ${
    r.richting.padEnd(8)} ${String(r.soort || "?").padEnd(9)} ${String(r.aantal).padStart(3)} × ${
    String(r.prijs_pt).padStart(7)} pt   ${r.contract}`);
}

if (!process.argv[3]) {
  console.log("\n(geen database meegegeven — alleen gelezen, niets geduid)");
  process.exit(0);
}

const env = { DB: maakDB(process.argv[3]) };
const tranches = (await env.DB.prepare(
  `select p.*, (select count(*) from exitregel e where e.positie = p.id and e.archief = 0
                 and e.soort = 'stoploss' and e.geraakt_op is not null) as stoploss_geraakt
     from positie p where p.archief = 0 and p.status in ('uitvoering ophalen','publiceren naar leden','bewaken')`
).all()).results;

console.log(`\nVOORSTEL PER LOPENDE TRANCHE (${tranches.length})`);
for (const t of tranches) {
  const uit = duidTranche(t, posities, transacties, vandaag);
  console.log(`  tranche ${t.tranche} (${t.contract || `${t.strike} / ${t.expiratiedatum}`})`);
  console.log(`    gewijzigd: ${uit.gewijzigd}   voorstel: ${uit.voorstel ?? "—"}`);
  if (uit.waarom) console.log(`    waarom:    ${uit.waarom}`);
  if (uit.opvolger) console.log(`    opvolger:  ${uit.opvolger.contract}`);
}
