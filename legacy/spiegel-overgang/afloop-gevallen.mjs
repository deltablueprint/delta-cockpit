// De herkenning aan het einde van een tranche, tegen een nagemaakt rapport.
//
//   node scripts/proef/afloop-gevallen.mjs
//
// Vier gevallen in één rapport — een rol, een vervroegde terugkoop, een
// waardeloze expiratie en een tranche die gewoon doorloopt — plus hetzelfde
// vervroegde geval nog eens met een geraakte stoploss erbij. Niets in de
// database, niets opgehaald: alleen de redenering.
import { readFileSync } from "node:fs";
import { leesPosities, leesTransacties } from "../../worker/lynx.js";
import { duidTranche } from "../../worker/afloop.js";

const xml = readFileSync(new URL("./materiaal/afloop.xml", import.meta.url), "utf8");
const posities = leesPosities(xml);
const transacties = leesTransacties(xml);
const vandaag = "2026-10-03";

const gevallen = [
  { naam: "A · doorgerold",
    tranche: { id: 1, conid: "7000001", strike: 5600, expiratiedatum: "2026-10-30", stoploss_geraakt: 0 },
    verwacht: "doorgerold", opvolger: "OESX 20NOV26 5500 PUT" },

  { naam: "B · vervroegd teruggekocht",
    tranche: { id: 2, conid: "7000002", strike: 5700, expiratiedatum: "2026-10-30", stoploss_geraakt: 0 },
    verwacht: "vervroegd teruggekocht" },

  { naam: "B' · zelfde terugkoop, maar de stoploss was geraakt",
    tranche: { id: 2, conid: "7000002", strike: 5700, expiratiedatum: "2026-10-30", stoploss_geraakt: 1 },
    verwacht: "exitplan uitgevoerd" },

  { naam: "C · waardeloos geexpireerd",
    tranche: { id: 3, conid: "7000003", strike: 5800, expiratiedatum: "2026-09-18", stoploss_geraakt: 0 },
    verwacht: "waardeloos geexpireerd" },

  { naam: "D · loopt gewoon door",
    tranche: { id: 4, conid: "7000004", strike: 5400, expiratiedatum: "2026-12-18", stoploss_geraakt: 0 },
    verwacht: null, gewijzigd: false },

  // Een tranche die de cockpit kent maar die nergens in het rapport voorkomt:
  // niet open, geen transactie, expiratie nog niet voorbij. Dan weten we het
  // niet, en dat hoort het systeem te zeggen in plaats van iets te verzinnen.
  { naam: "E · onbekend — niet open, geen transactie, expiratie nog niet voorbij",
    tranche: { id: 5, conid: "7000099", strike: 5200, expiratiedatum: "2026-11-20", stoploss_geraakt: 0 },
    verwacht: null, gewijzigd: true },

  // Zonder contractnummer valt de herkenning terug op strike en expiratie.
  { naam: "F · zonder conid, herkend op strike en expiratie",
    tranche: { id: 6, conid: null, strike: 5700, expiratiedatum: "2026-10-30", stoploss_geraakt: 0 },
    verwacht: "vervroegd teruggekocht" },
];

let fouten = 0;
for (const g of gevallen) {
  const uit = duidTranche(g.tranche, posities, transacties, vandaag);
  const goed = uit.voorstel === (g.verwacht ?? null)
    && (g.gewijzigd === undefined || uit.gewijzigd === g.gewijzigd)
    && (!g.opvolger || (uit.opvolger && uit.opvolger.contract === g.opvolger));
  if (!goed) fouten++;
  console.log(`${goed ? "goed" : "FOUT"}  ${g.naam}`);
  console.log(`      voorstel: ${uit.voorstel ?? "—"}   gewijzigd: ${uit.gewijzigd}`);
  if (uit.waarom) console.log(`      waarom:   ${uit.waarom}`);
  if (uit.opvolger) console.log(`      opvolger: ${uit.opvolger.contract}`);
  if (!goed) console.log(`      verwacht: ${g.verwacht ?? "—"}${g.opvolger ? ` · opvolger ${g.opvolger}` : ""}`);
}

console.log(fouten ? `\n${fouten} van de ${gevallen.length} gevallen klopt niet.` : `\nalle ${gevallen.length} gevallen kloppen.`);
process.exit(fouten ? 1 : 0);
