// De stroom schrijft mee, zonder iets te veranderen.
//
//   node scripts/proef/stroom.mjs
//
// Dezelfde handelingen als de spiegelproef, maar nu met de vraag: staat er
// achteraf een leesbare tijdlijn? En breekt een kapotte log de handeling niet?
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";
import { spiegel, wijsToe, verstuurPublicatie } from "../../worker/spiegel.js";
import { stroom } from "../../worker/stroom.js";

const pad = "/tmp/delta-stroom-proef.sqlite";
rmSync(pad, { force: true });
const ruw = new DatabaseSync(pad);
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  ruw.exec(readFileSync("migrations/" + f, "utf8"));
}
ruw.exec(`insert into cyclus (id,label,status,geopend_op,doelexpiratie) values (1,'OESX okt 2026','in positie','2026-09-01','2026-10-30')`);
ruw.exec(`insert into beoordelingsmoment (id,cyclus,datum,status,uitkomst) values (5,1,'2026-09-10','uitkomst vastgelegd','go')`);
ruw.close();

const env = { DB: maakDB(pad) };
const ik = { id: "simon" };
let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } else console.log(`goed  ${wat}`); };
const contract = (conid, naam, strike, exp, aantal = -2) => ({
  conid, contract: naam, onderliggend: "OESX", strike, expiratiedatum: exp, aantal,
});
const fill = (conid, richting, prijs, datum) => ({
  conid, richting, prijs_pt: prijs, datum, moment: `${datum} 10:00`, aantal: 2,
});

// ---- een positie opent ----
await spiegel(env, ik,
  [contract("5001", "OESX 30OKT26 5600 PUT", 5600, "2026-10-30")],
  [fill("5001", "verkoop", 38.5, "2026-09-15")], "2026-09-16");

let rijen = await stroom(env, 1);
const soorten = rijen.map((r) => r.soort);
console.log("      ", soorten.join(" · "));
eis("het openen staat in de stroom", soorten.includes("positie_geopend"));
eis("het concept erbij", soorten.includes("concept_klaargezet"));

const opening = rijen.find((r) => r.soort === "positie_geopend");
console.log(`       ${opening.titel} · ${opening.detail}`);
eis("met de bron erbij", opening.bron === "ibkr");
eis("met de feiten als json", opening.feiten && opening.feiten.premie_pt === 38.5);
eis("gekoppeld aan de positie", Number(opening.positie) > 0);
eis("en aan de cyclus", Number(opening.cyclus) === 1);
eis("nog niemand hoeft iets te doen", Number(opening.vraagt_antwoord) === 0);

// ---- het bericht gaat uit ----
const concept = await env.DB.prepare("select id from publicatie where soort = 'opening'").first();
await env.DB.prepare("update publicatie set tekst = 'Wij hebben een positie ingenomen.' where id = ?")
  .bind(concept.id).run();
await verstuurPublicatie(env, ik, concept.id);
rijen = await stroom(env, 1);
const verstuurd = rijen.find((r) => r.soort === "bericht_verstuurd");
eis("versturen komt in de stroom", !!verstuurd);
eis("met de mens als bron", verstuurd && verstuurd.bron === "mens");

// ---- de positie sluit ----
await spiegel(env, ik, [], [fill("5001", "koop", 6.0, "2026-10-02")], "2026-10-03");
rijen = await stroom(env, 1);
const dicht = rijen.find((r) => r.soort === "positie_gesloten");
console.log(`       ${dicht.titel} · ${dicht.detail}`);
eis("het sluiten staat erin", !!dicht);
eis("met het resultaat in de feiten", dicht.feiten && dicht.feiten.resultaat_pt === 32.5);

// ---- een onverdeelde positie wordt toegewezen ----
await spiegel(env, ik,
  [contract("5002", "OESX 18DEC26 5400 PUT", 5400, "2026-12-18")],
  [fill("5002", "verkoop", 41, "2026-10-05")], "2026-10-06");
const los = await env.DB.prepare("select id from positie where conid = '5002'").first();
await env.DB.prepare("update positie set cyclus = null where id = ?").bind(los.id).run();
await wijsToe(env, ik, los.id, 1);
rijen = await stroom(env, 1);
eis("toewijzen staat erin", rijen.some((r) => r.soort === "positie_toegewezen"));

// ---- een kapotte log breekt de handeling niet ----
const kapot = { DB: { prepare: () => ({ bind: () => ({ run: () => { throw new Error("stuk"); } }) }) } };
const { log } = await import("../../worker/stroom.js");
const uitkomst = await log(kapot, ik, { bron: "mens", soort: "test", titel: "test" });
eis("een mislukte log geeft null en gooit niets", uitkomst === null);

// ---- de volgorde ----
rijen = await stroom(env, 1);
console.log(`       ${rijen.length} gebeurtenissen, nieuwste eerst: ${rijen[0].soort}`);
eis("nieuwste eerst", rijen.length >= 6);

console.log(fouten === 0 ? "\nalles klopt." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
