// Het voornemen, van aankondiging tot afronding — zonder brokerkoppeling.
//
//   node scripts/proef/voornemen.mjs
//
// Kondigt een rol aan, laat daarna de stand binnenkomen zoals de brug hem zou
// duwen, en toetst wat er in de database staat: de gesloten tranche met het
// echte resultaat, de nieuwe tranche met de echte fill-prijs, het exitplan dat
// tegen díé premie rekent, en de stand 'publiceren naar leden'.
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";
import { leesPosities, leesTransacties } from "../../worker/lynx.js";
import { kondigAan, pasVoornemensToe, trekIn } from "../../worker/voornemen.js";

const pad = "/tmp/delta-voornemen-proef.sqlite";
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
const uitvoeringen = leesTransacties(xml);
const posities = leesPosities(xml);

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } else console.log(`goed  ${wat}`); };
const haal = (id) => env.DB.prepare("select * from positie where id = ?").bind(id).first();

// ---- 1 · aankondigen ----
const aan = await kondigAan(env, ik, 10, {
  soort: "rol", nieuwe_strike: 5500, nieuwe_expiratiedatum: "2026-11-20", aantal: 2,
  reden: "CPI van 16 oktober vermijden",
});
eis("een rol aankondigen lukt", Number.isFinite(Number(aan.voornemen)));
// Je kondigt aan vóór je handelt; het nagemaakte rapport staat op 2 oktober.
await env.DB.prepare("update voornemen set aangekondigd_op = ? where id = ?")
  .bind("2026-10-02 14:00:00", aan.voornemen).run();
const nog = await kondigAan(env, ik, 10, { soort: "rol", nieuwe_strike: 5400, nieuwe_expiratiedatum: "2026-12-18" });
eis("een tweede open voornemen op dezelfde tranche wordt geweigerd", Boolean(nog.fout));
const leeg = await kondigAan(env, ik, 11, { soort: "rol" });
eis("een rol zonder nieuw contract wordt geweigerd", Boolean(leeg.fout));

// ---- 2 · de stand komt binnen ----
const uit = await pasVoornemensToe(env, ik, posities, uitvoeringen, "2026-10-02 14:32:00");
console.log("      ", uit);
eis("één voornemen is afgerond", uit.afgerond === 1);

const oud = await haal(10);
eis("de oude tranche staat gesloten", oud.status === "gesloten");
eis("de uitkomst is doorgerold", oud.uitkomst === "doorgerold");
eis("het resultaat is 38,5 − 12,0 = 26,5 punten", Number(oud.resultaat_pt) === 26.5);
eis("de terugkoopprijs van 12,0 staat erbij", Number(oud.teruggekocht_pt) === 12);

const v = await env.DB.prepare("select * from voornemen where id = ?").bind(aan.voornemen).first();
eis("het voornemen staat op uitgevoerd", v.status === "uitgevoerd");
eis("het voornemen wijst naar de nieuwe tranche", Number(v.opvolger) === Number(oud.doorgerold_naar));

const nieuw = await haal(v.opvolger);
console.log(`       nieuwe tranche: ${nieuw.contract} · ${nieuw.ontvangen_premie_pt} pt · ${nieuw.status}`);
eis("de nieuwe tranche draagt de echte fill-prijs", Number(nieuw.ontvangen_premie_pt) === 41);
eis("de nieuwe tranche staat klaar om te publiceren", nieuw.status === "publiceren naar leden");

const plan = (await env.DB.prepare(
  "select soort, niveau from exitregel where positie = ? order by volgorde"
).bind(v.opvolger).all()).results;
console.log("       exitplan:", plan.map((r) => `${r.soort} ${r.niveau ?? "—"}`).join(" · "));
const anker = plan.find((r) => r.soort === "winstanker");
const breakeven = plan.find((r) => r.soort === "break-even");
eis("het winstanker rekent tegen de nieuwe premie (30 % van 41 = 12,3)", Number(anker.niveau) === 12.3);
eis("break-even is de ontvangen premie: terugkopen boven 41 kost geld", Number(breakeven.niveau) === 41);
const expnv = plan.find((r) => r.soort === "expiratieniveau");
eis("het expiratieniveau staat apart op 5500 − 41 = 5459", Number(expnv.niveau) === 5459);

const cyc = await env.DB.prepare("select doelexpiratie from cyclus where id = 1").first();
console.log("       doelexpiratie van de cyclus:", cyc.doelexpiratie);
eis("de doelexpiratie van de cyclus rekt mee tot 20 november", cyc.doelexpiratie === "2026-11-20");

// ---- 3 · een aankondiging die niet uitkomt ----
const afwijkend = await kondigAan(env, ik, 11, {
  soort: "rol", nieuwe_strike: 5300, nieuwe_expiratiedatum: "2026-11-20",
});
await env.DB.prepare("update voornemen set aangekondigd_op = ? where id = ?")
  .bind("2026-09-30 09:00:00", afwijkend.voornemen).run();
const uit2 = await pasVoornemensToe(env, ik, posities, uitvoeringen, "2026-10-02 15:00:00");
const v2 = await env.DB.prepare("select * from voornemen where id = ?").bind(afwijkend.voornemen).first();
console.log("      ", v2.status, "·", v2.afwijking);
eis("een rol die niet past wordt gemarkeerd als afwijkend", v2.status === "wijkt af");
eis("daarbij staat wat er wél geopend werd", Boolean(v2.afwijking));

// ---- 4 · intrekken ----
const derde = await kondigAan(env, ik, 11, { soort: "terugkopen" });
const ingetrokken = await trekIn(env, ik, derde.voornemen, "toch niet gedaan");
eis("een voornemen intrekken lukt", ingetrokken.status === "ingetrokken");
const weer = await trekIn(env, ik, derde.voornemen);
eis("twee keer intrekken wordt geweigerd", Boolean(weer.fout));

console.log(fouten ? `\n${fouten} toets(en) mislukt.` : "\nalles klopt.");
process.exit(fouten ? 1 : 0);
