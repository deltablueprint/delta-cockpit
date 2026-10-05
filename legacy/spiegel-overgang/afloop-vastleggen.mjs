// Vastleggen wat er met een tranche gebeurd is — tegen een echte database.
//
//   node scripts/proef/afloop-vastleggen.mjs
//
// Bouwt een database uit de migraties, zet er een cyclus met twee tranches in,
// en legt vast wat het nagemaakte rapport laat zien. Toetst daarna wat er in de
// database staat: de gesloten tranche, het resultaat, en de tranche die uit de
// rol ontstaan is.
import { readFileSync, rmSync } from "node:fs";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";
import { leesTransacties, leesPosities } from "../../worker/lynx.js";
import { duidTranche, legVast, resultaatPunten } from "../../worker/afloop.js";

const pad = "/tmp/delta-afloop-proef.sqlite";
rmSync(pad, { force: true });
const ruw = new DatabaseSync(pad);
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  ruw.exec(readFileSync("migrations/" + f, "utf8"));
}
ruw.exec(`insert into cyclus (id,label,geopend_op,doelexpiratie) values (1,'OESX okt 2026','2026-09-01','2026-10-30')`);
ruw.exec(`insert into positie (id,cyclus,tranche,status,contract,strike,expiratiedatum,aantal,ontvangen_premie_pt,conid,inzet_pct)
          values (10,1,1,'bewaken','OESX 30OKT26 5600 PUT',5600,'2026-10-30',2,38.5,'7000001',24)`);
ruw.exec(`insert into positie (id,cyclus,tranche,status,contract,strike,expiratiedatum,aantal,ontvangen_premie_pt,conid,inzet_pct)
          values (11,1,2,'bewaken','OESX 30OKT26 5700 PUT',5700,'2026-10-30',1,44.0,'7000002',12)`);
ruw.close();

const env = { DB: maakDB(pad) };
const ik = { id: "simon" };
const xml = readFileSync(new URL("./materiaal/afloop.xml", import.meta.url), "utf8");
const transacties = leesTransacties(xml);
const posities = leesPosities(xml);

const toon = (t) => `tranche ${t.tranche} · ${t.status} · uitkomst ${t.uitkomst ?? "—"} · resultaat ${t.resultaat_pt ?? "—"} · doorgerold naar ${t.doorgerold_naar ?? "—"}`;
const haal = (id) => (env.DB.prepare("select * from positie where id = ?").bind(id).first());

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } else console.log(`goed  ${wat}`); };

// ---- de rol ----
const een = await haal(10);
const duidingEen = duidTranche({ ...een, stoploss_geraakt: 0 }, posities, transacties, "2026-10-03");
eis("tranche 1 wordt herkend als doorgerold", duidingEen.voorstel === "doorgerold");

const uitEen = await legVast(env, ik, 10, {
  uitkomst: "doorgerold",
  sluittijdstip: duidingEen.sluiting.datum,
  resultaat_pt: resultaatPunten(een, duidingEen.sluiting),
  opvolger: {
    contract: duidingEen.opvolger.contract, strike: duidingEen.opvolger.strike,
    expiratiedatum: duidingEen.opvolger.expiratiedatum, aantal: duidingEen.opvolger.aantal,
    premie_pt: duidingEen.opvolger.prijs_pt, conid: duidingEen.opvolger.conid,
    datum: duidingEen.opvolger.datum,
  },
});
eis("vastleggen geeft een nieuw tranchenummer terug", Number.isFinite(Number(uitEen.opvolger)));

const naEen = await haal(10);
console.log("     ", toon(naEen));
eis("tranche 1 staat gesloten", naEen.status === "gesloten");
eis("resultaat is 38,5 − 12,0 = 26,5 punten", Number(naEen.resultaat_pt) === 26.5);
eis("doorgerold_naar wijst naar de nieuwe tranche", Number(naEen.doorgerold_naar) === Number(uitEen.opvolger));

const nieuw = await haal(uitEen.opvolger);
console.log("     ", toon(nieuw), "·", nieuw.contract);
eis("de nieuwe tranche is nummer 3", Number(nieuw.tranche) === 3);
eis("de nieuwe tranche staat op bewaken", nieuw.status === "bewaken");
eis("de nieuwe tranche draagt het contract uit het rapport", nieuw.contract === "OESX 20NOV26 5500 PUT");
eis("de nieuwe tranche draagt de ontvangen premie", Number(nieuw.ontvangen_premie_pt) === 41);

// ---- de vervroegde terugkoop ----
const twee = await haal(11);
const duidingTwee = duidTranche({ ...twee, stoploss_geraakt: 0 }, posities, transacties, "2026-10-03");
eis("tranche 2 wordt herkend als vervroegd teruggekocht", duidingTwee.voorstel === "vervroegd teruggekocht");
await legVast(env, ik, 11, {
  uitkomst: "vervroegd teruggekocht",
  sluittijdstip: duidingTwee.sluiting.datum,
  resultaat_pt: resultaatPunten(twee, duidingTwee.sluiting),
});
const naTwee = await haal(11);
console.log("     ", toon(naTwee));
eis("resultaat is 44,0 − 9,5 = 34,5 punten", Number(naTwee.resultaat_pt) === 34.5);

// ---- wat niet mag ----
const weigering = await legVast(env, ik, 11, { uitkomst: "doorgerold" });
eis("een al afgesloten tranche wordt geweigerd", Boolean(weigering.fout));
const zonderOpvolger = await legVast(env, ik, Number(uitEen.opvolger), { uitkomst: "doorgerold" });
eis("een rol zonder opvolger wordt geweigerd", Boolean(zonderOpvolger.fout));

console.log(fouten ? `\n${fouten} toets(en) mislukt.` : "\nalles klopt.");
process.exit(fouten ? 1 : 0);
