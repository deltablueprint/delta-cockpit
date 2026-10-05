// Het werkbankscherm vraagt alleen wat er is, en toont alleen wat het kreeg.
//
//   node scripts/proef/werkbankscherm.mjs
//
// Een scherm kan hier niet echt getekend worden — er is geen browser. Wat wel
// kan, en wat telt: elke route die het scherm aanroept bestaat, elk veld dat het
// uitleest wordt ook echt meegestuurd, en elke kaartsoort kan ergens heen.
import { readFileSync } from "node:fs";
import { verseDB, CYCLUS, POSITIE } from "./db.mjs";
import { wachtrij } from "../../worker/wachtrij.js";
import { achterstand, inWoorden } from "../../worker/achterstand.js";
import { huidig } from "../../worker/barometer.js";
import { weeg } from "../../worker/motor.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-werkbank-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

const scherm = readFileSync("app/src/werkbank.js", "utf8");
const api = readFileSync("app/src/api.js", "utf8");
const worker = readFileSync("worker/index.js", "utf8");
// De routes staan als reguliere expressie in de worker, met ontsnapte schuine
// strepen. Die halen we eruit, zodat deze proef over paden gaat en niet over
// hoe een regexp geschreven is.
const paden = worker.replace(/\\\//g, "/");
const main = readFileSync("app/src/main.js", "utf8");
const css = readFileSync("app/src/stijl.css", "utf8");

// ------------------------------------------- de routes die het scherm gebruikt
for (const route of ["/api/wachtrij", "/api/achterstand", "/api/werkbank/cycli"]) {
  eis(`de worker kent ${route}`, paden.includes(route));
}
for (const [wat, stuk] of [
  ["de barometerroute", "/api/cyclus/"], ["de stroomroute", "/stroom$/"],
  ["het antwoord op een kaart", "/api/wachtrij/"], ["het concept uit een kaart", "/concept$/"],
]) {
  eis(`de worker kent ${wat}`, paden.includes(stuk));
}
eis("de worker kent de barometerroute precies", paden.includes("/barometer$/"));
eis("de worker kent het antwoord precies", paden.includes("/antwoord$/"));

// Elke api-functie die het scherm importeert, bestaat ook.
const geimporteerd = (scherm.match(/import \{([^}]+)\} from "\.\/api\.js"/s) || [])[1] || "";
for (const naam of geimporteerd.split(",").map((x) => x.trim()).filter(Boolean)) {
  eis(`api.js exporteert ${naam}`, new RegExp(`export const ${naam}\\b`).test(api));
}

eis("main.js kent de route /werkbank", main.includes('pad === "/werkbank"'));
eis("en roept het scherm aan", main.includes("werkbankscherm(inhoud, kruimel)"));
eis("het menu-item staat in de database",
    (await q("select count(*) n from db_module where route = '/werkbank'"))[0].n === 1);
eis("er is geen groep INRICHTING blijven hangen",
    (await q("select count(*) n from db_module where groep = 'INRICHTING'"))[0].n === 0);

// ------------------------------------------ wat het scherm uitleest, bestaat
await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche verdwenen bij de broker",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-01 10:00:00",
});
await weeg(env);
const rij = await wachtrij(env, ik);
const k = rij.kaarten[0];

for (const veld of ["id", "kaartsoort", "titel", "reden", "prioriteit", "uren_open",
                    "opgeschaald", "moment", "feiten", "knoppen", "prullenbak",
                    "cyclus", "positie", "publicatie", "beoordelingsmoment"]) {
  eis(`de kaart draagt ${veld}`, veld in k);
}
eis("de telling heeft drie niveaus",
    ["hoog", "medium", "laag"].every((p) => p in rij.telling));
eis("een knop draagt label, doel en of hij een reden vraagt",
    k.knoppen.every((b) => "label" in b && "doel" in b && "reden_verplicht" in b));
eis("een feit draagt label en waarde",
    (k.feiten || []).every((f) => "label" in f && "waarde" in f));

const a = await achterstand(env, { cyclus: CYCLUS });
for (const veld of ["kleur", "bij", "uren", "aantal", "posten"]) {
  eis(`de achterstand draagt ${veld}`, veld in a);
}
eis("en er is een zin", typeof inWoorden(a) === "string");

const b = await huidig(env, CYCLUS);
for (const veld of ["wij", "leden", "gelijk", "schaal", "vensters"]) {
  eis(`de barometer draagt ${veld}`, veld in b);
}

// ----------------------------------------- elke kaartsoort kan ergens heen
// Een knop 'scherm' die nergens heen gaat is een knop die niets doet, en dat
// merk je pas als de kaart voor het eerst echt verschijnt.
const metScherm = await q("select kaartsoort from processtap where knop1_doel = 'scherm'");
for (const s of metScherm) {
  eis(`${s.kaartsoort} heeft een route in het scherm`,
      new RegExp(`case "${s.kaartsoort}":`).test(scherm));
}

// ------------------------------------------------------------ de opmaak
// Groen betekent in dit systeem 'in orde'. Een prioriteit is dat nooit.
eis("er is geen groene prioriteit", !/\.p-(hoog|medium|laag)[^}]*grn/.test(css));
for (const klasse of ["p-hoog", "p-medium", "p-laag", "wbfeiten", "wbknoppen", "wbbak", "wbstroom"]) {
  eis(`de opmaak kent .${klasse}`, css.includes(`.${klasse}`));
}
// De feiten gaan over de volle breedte; de knoppen staan eronder, rechts.
eis("de knoppen staan rechts", /\.wbknoppen \{[^}]*justify-content: flex-end/.test(css));
eis("het vuilbakje heeft geen omkadering", /\.wbbak \{[^}]*border: none/.test(css));

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
