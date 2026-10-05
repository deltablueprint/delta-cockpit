// Alle proeven achter elkaar, één regel per proef.
//
//   npm run proef
//
// Een proef slaagt als ze zonder uitzondering eindigt en geen 'FOUT' schrijft.
// De twee inspectieproeven (record, navigator) hebben geen oordeel; daar telt
// alleen dat ze draaien.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DOEN = ["migraties", "db-wordt-gevuld", "record", "navigator", "aanmaken", "brug", "spiegel", "stroom", "bericht", "achterstand", "barometer", "inrichting", "schermen", "hersteld"];
const bestaat = new Set(readdirSync("scripts/proef").filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)));

let stuk = 0;
for (const naam of DOEN) {
  if (!bestaat.has(naam)) continue;
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
