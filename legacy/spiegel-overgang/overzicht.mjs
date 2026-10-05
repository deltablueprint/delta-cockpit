// Wat het scherm 'Einde van een tranche' te zien krijgt, in één oogopslag.
//
//   node scripts/proef/overzicht.mjs
//
// Bouwt de demodatabase en roept het eindpunt aan zoals de app dat doet.
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";
import { voorstellen } from "../../worker/afloop.js";

const pad = "/tmp/delta-overzicht-proef.sqlite";
rmSync(pad, { force: true });
const ruw = new DatabaseSync(pad);
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  ruw.exec(readFileSync("migrations/" + f, "utf8"));
}
ruw.exec(readFileSync("scripts/demo-afloop.sql", "utf8"));
ruw.close();

const env = { DB: maakDB(pad) };
const uit = await voorstellen(env, "2026-10-03");

console.log(`\nRAPPORT van ${uit.opgehaald_op}`);
console.log(`\nVRAAGT OM DUIDING`);
for (const r of uit.regels.filter((r) => r.gewijzigd)) {
  console.log(`  ${r.cyclusnaam} · tranche ${r.nummer} · ${r.contract}`);
  console.log(`    voorstel: ${r.voorstel ?? "—"}   resultaat: ${r.resultaat_pt ?? "—"} pt`);
  console.log(`    ${r.waarom}`);
}
console.log(`\nNIEUW BIJ LYNX (${uit.nieuw.length})`);
for (const p of uit.nieuw) {
  console.log(`  ${p.contract} · ${p.aantal} × · ${p.premie_pt ?? "geen prijs"} pt`);
  for (const k of p.mogelijk_vervolg_op) {
    console.log(`    kan het vervolg zijn van ${k.cyclusnaam} · tranche ${k.tranche}` +
                (k.sluiting ? ` (teruggekocht tegen ${k.sluiting.prijs_pt} pt)` : ""));
  }
}
console.log(`\nLOOPT DOOR (${uit.regels.filter((r) => !r.gewijzigd).length})`);
for (const r of uit.regels.filter((r) => !r.gewijzigd)) {
  console.log(`  ${r.cyclusnaam} · tranche ${r.nummer} · ${r.contract}`);
}
const vlag = await env.DB.prepare("select label, duiding_open from cyclus where duiding_open > 0").all();
console.log(`\nVLAG IN DE CYCLILIJST`);
for (const c of vlag.results) console.log(`  ${c.label}: ${c.duiding_open} ×`);
