// Zet een CSV met events om in SQL voor de eventskalender.
//
//   node scripts/events-naar-sql.mjs events.csv > events.sql
//   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file events.sql
//
// Verwachte kolommen (eerste regel is de kop):
//   datum,tijdstip,naam,soort,zwaarte,toelichting
//   2026-10-08,14:15,ECB-rentebesluit,centrale_bank,zwaar,valt in de looptijd
//
// soort:   macro | centrale_bank | expiratie | bedrijf | politiek | anders
// zwaarte: licht | middel | zwaar

import { readFileSync } from "node:fs";

const bestand = process.argv[2];
if (!bestand) { console.error("Gebruik: node scripts/events-naar-sql.mjs <bestand.csv>"); process.exit(1); }

const regels = readFileSync(bestand, "utf8").split(/\r?\n/).filter((r) => r.trim());
const kop = regels.shift().split(",").map((k) => k.trim());
const nodig = ["datum", "naam"];
for (const k of nodig) if (!kop.includes(k)) { console.error(`Kolom ${k} ontbreekt.`); process.exit(1); }

const tekst = (w) => (w === undefined || w === "" ? "null" : `'${String(w).replace(/'/g, "''")}'`);

const waarden = regels.map((regel) => {
  const stukken = regel.split(",");
  const r = Object.fromEntries(kop.map((k, i) => [k, (stukken[i] || "").trim()]));
  return `  (${tekst(r.datum)}, ${tekst(r.tijdstip)}, ${tekst(r.naam)}, ${tekst(r.soort || "macro")}, ${tekst(r.zwaarte || "middel")}, 'import', ${tekst(r.toelichting)})`;
});

console.log(`-- ${waarden.length} events, gemaakt uit ${bestand}`);
console.log("insert into event (datum, tijdstip, naam, soort, zwaarte, bron, toelichting) values");
console.log(waarden.join(",\n") + ";");
