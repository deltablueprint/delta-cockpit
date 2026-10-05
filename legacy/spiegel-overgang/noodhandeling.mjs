// Eerst handelen bij Lynx, daarna de applicatie laten volgen.
//
//   node scripts/proef/noodhandeling.mjs
//
// Geen aankondiging: er wordt gerold bij de broker en de cockpit moet het zelf
// zien. Toetst dat de vlag gezet wordt, dat het nieuwe contract als onbekend
// opduikt, en dat één handeling het verband legt — met de echte prijzen en een
// tranche die klaarstaat om te publiceren.
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";
import { leesPosities, leesTransacties } from "../../worker/lynx.js";
import { markeer, verweesd, neemOver, resultaatPunten } from "../../worker/afloop.js";

const pad = "/tmp/delta-nood-proef.sqlite";
rmSync(pad, { force: true });
const ruw = new DatabaseSync(pad);
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  ruw.exec(readFileSync("migrations/" + f, "utf8"));
}
ruw.exec(`insert into cyclus (id,label,geopend_op,doelexpiratie) values (1,'OESX okt 2026','2026-09-01','2026-10-30')`);
ruw.exec(`insert into positie (id,cyclus,tranche,status,contract,strike,expiratiedatum,aantal,ontvangen_premie_pt,conid,inzet_pct)
          values (10,1,1,'bewaken','OESX 30OKT26 5600 PUT',5600,'2026-10-30',2,38.5,'7000001',24)`);
ruw.close();

const env = { DB: maakDB(pad) };
const ik = { id: "simon" };
const xml = readFileSync(new URL("./materiaal/afloop.xml", import.meta.url), "utf8");
const posities = leesPosities(xml);
const uitvoeringen = leesTransacties(xml);

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } else console.log(`goed  ${wat}`); };

// ---- de stand komt binnen, zonder dat er iets aangekondigd was ----
await markeer(env, posities, uitvoeringen, "2026-10-03");

const t = await env.DB.prepare("select * from positie where id = 10").first();
console.log(`       tranche 1: ${t.duiding_voorstel} · ${t.duiding_waarom}`);
eis("de tranche draagt wat het systeem zag", t.duiding_voorstel === "doorgerold");
const c = await env.DB.prepare("select duiding_open from cyclus where id = 1").first();
eis("de cyclus draagt de vlag", Number(c.duiding_open) === 1);

// ---- het nieuwe contract kent niemand ----
const vreemd = await verweesd(env, posities);
console.log("       onbekend bij de cockpit:", vreemd.map((p) => p.contract).join(" · "));
eis("het nieuw geopende contract duikt op als onbekend",
    vreemd.some((p) => p.contract === "OESX 20NOV26 5500 PUT"));
eis("daarbij staat welke tranche net iets deed",
    vreemd[0].mogelijk_vervolg_op.some((k) => Number(k.id) === 10));

// ---- één handeling legt het verband ----
const nieuw = vreemd.find((p) => p.contract === "OESX 20NOV26 5500 PUT");
const sluiting = uitvoeringen.filter((r) => r.richting === "koop" && String(r.conid) === "7000001").pop();
const opening = uitvoeringen.find((r) => String(r.conid) === String(nieuw.conid));

const uit = await neemOver(env, ik, {
  cyclus: 1,
  vervolg_op: 10,
  sluittijdstip: sluiting.datum,
  resultaat_pt: resultaatPunten(t, sluiting),
  positie: {
    contract: nieuw.contract, strike: nieuw.strike, expiratiedatum: nieuw.expiratiedatum,
    aantal: nieuw.aantal, premie_pt: opening.prijs_pt, conid: nieuw.conid, datum: opening.datum,
  },
});
eis("het overnemen levert een nieuwe tranche", Number.isFinite(Number(uit.tranche)));

const oud = await env.DB.prepare("select * from positie where id = 10").first();
eis("de oude tranche staat gesloten als doorgerold",
    oud.status === "gesloten" && oud.uitkomst === "doorgerold");
eis("met het echte resultaat van 26,5 punten", Number(oud.resultaat_pt) === 26.5);

const n = await env.DB.prepare("select * from positie where id = ?").bind(uit.tranche).first();
console.log(`       nieuwe tranche: ${n.contract} · ${n.ontvangen_premie_pt} pt · ${n.status}`);
eis("de nieuwe tranche draagt de echte fill-prijs", Number(n.ontvangen_premie_pt) === 41);
eis("en staat klaar om te publiceren", n.status === "publiceren naar leden");
eis("de oude wijst naar de nieuwe", Number(oud.doorgerold_naar) === Number(uit.tranche));

// ---- en de vlag gaat uit ----
await markeer(env, posities, uitvoeringen, "2026-10-03");
const na = await env.DB.prepare("select duiding_open from cyclus where id = 1").first();
eis("de vlag gaat uit zodra het afgehandeld is", Number(na.duiding_open) === 0);

// ---- een losse positie, zonder vervolg ----
const los = await neemOver(env, ik, {
  cyclus: 1,
  positie: { contract: "OESX 18DEC26 5400 PUT", strike: 5400, expiratiedatum: "2026-12-18",
             aantal: 1, premie_pt: 52, conid: "7000004" },
});
const l = await env.DB.prepare("select * from positie where id = ?").bind(los.tranche).first();
console.log(`       losse tranche: nummer ${l.tranche} · ${l.status}`);
eis("een losse positie wordt een nieuwe tranche", Number(l.tranche) === 3);
// Vijf regels: stoploss, winstanker, break-even, expiratieniveau, eventregel.
eis("met een exitplan erbij",
    Number((await env.DB.prepare("select count(*) as n from exitregel where positie = ?").bind(los.tranche).first()).n) === 5);

console.log(fouten ? `\n${fouten} toets(en) mislukt.` : "\nalles klopt.");
process.exit(fouten ? 1 : 0);
