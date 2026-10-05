// Alle proeven achter elkaar, één regel per proef.
//
//   npm run proef
//
// Een proef slaagt als ze zonder uitzondering eindigt en geen 'FOUT' schrijft.
// De twee inspectieproeven (record, navigator) hebben geen oordeel; daar telt
// alleen dat ze draaien.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DOEN = ["migraties", "record", "navigator", "aanmaken", "brug", "spiegel", "stroom", "bericht", "barometer", "inrichting", "schermen", "hersteld"];
const bestaat = new Set(readdirSync("scripts/proef").filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)));

// En andersom: een proef die wel bestaat maar niet in de lijst staat, draait
// nooit mee. Dat is net zo stil.
// Wat geen proef is: hulpstukken, en twee scripts die je met de hand draait
// tegen een echte omgeving (ze hebben een URL en een sleutel nodig).
const HULPSTUKKEN = new Set(["alles", "db", "d1", "demo-afloop", "brug-simulatie"]);
for (const naam of bestaat) {
  if (HULPSTUKKEN.has(naam) || DOEN.includes(naam)) continue;
  console.log(`STUK  ${naam.padEnd(16)} bestaat, maar staat niet in de lijst en draait dus nooit mee`);
}

// Een proef die uit de map verdwijnt, hoort niet stil uit de suite te
// verdwijnen. Dat gebeurde: 'achterstand' stond nog in de lijst, het bestand was
// weg, en de lus sloeg hem over zonder een woord. Wie per ongeluk een proef
// weggooit merkt dat dan nooit.
let stuk = [...bestaat].filter((n) => !HULPSTUKKEN.has(n) && !DOEN.includes(n)).length;
for (const naam of DOEN) {
  if (!bestaat.has(naam)) {
    stuk++;
    console.log(`STUK  ${naam.padEnd(16)} staat in de lijst, maar scripts/proef/${naam}.mjs bestaat niet`);
    continue;
  }
  const uit = spawnSync("node", [`scripts/proef/${naam}.mjs`], { encoding: "utf8" });
  const tekst = `${uit.stdout || ""}${uit.stderr || ""}`;
  const regels = tekst.split("\n").filter((r) => r.trim() && !r.includes("ExperimentalWarning") && !r.includes("trace-warnings"));
  const mis = uit.status !== 0 || /\bFOUT\b|UITZONDERING/.test(tekst);
  if (mis) stuk++;
  const laatste = regels[regels.length - 1] || "(niets)";
  console.log(`${mis ? "STUK " : "goed "} ${naam.padEnd(16)} ${mis ? laatste.slice(0, 90) : laatste.slice(0, 60)}`);
  if (mis) for (const r of regels.filter((r) => /FOUT|UITZONDERING|Error/.test(r)).slice(0, 4)) console.log(`        ${r.trim()}`);
}
console.log(stuk === 0 ? "\nalle proeven groen." : `\n${stuk} proef/proeven stuk.`);
process.exit(stuk === 0 ? 0 : 1);
