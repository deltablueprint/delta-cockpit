// Een record aanmaken zoals het formulier het doet: met de ouder erbij en de
// validatieregels eroverheen.
//
//   node scripts/proef/aanmaken.mjs
import { maakAan } from "../../worker/schrijf.js";
import { verseDB, MOMENT } from "./db.mjs";

const env = { DB: verseDB() };
const ik = { id: "simon" };
let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } else console.log(`goed  ${wat}`); };

const velden = {
  beoordelingsmoment: String(MOMENT),
  positie: "go",
  strike: "5600",
  expiratiedatum: "2026-10-30",
  inzet_pct: "12",
  reden: "de daling van 2,4 % is er, en de skew betaalt",
};

// ---- zonder reden wordt het geweigerd ----
const zonder = await maakAan(env, ik, "inzending", {
  velden: { ...velden, reden: "" }, ouderkolom: "beoordelingsmoment",
});
console.log("      ", zonder.fout || "(geen fout)");
eis("zonder argumentatie wordt het geweigerd", zonder.status === 422);
eis("en het veld wordt aangewezen", (zonder.blokkades || []).some((b) => b.veld === "reden"));

// ---- met reden lukt het ----
const uit = await maakAan(env, ik, "inzending", { velden, ouderkolom: "beoordelingsmoment" });
console.log("      ", JSON.stringify(uit));
eis("met argumentatie lukt het", !uit.fout && Number(uit.id) > 0);

const rij = await env.DB.prepare("select * from inzending where id = ?").bind(uit.id).first();
eis("de ouder staat erin", Number(rij.beoordelingsmoment) === MOMENT);
eis("het oordeel staat erin", rij.positie === "go");
eis("de deelnemer is wie het aanmaakte", rij.deelnemer === "simon");

console.log(fouten === 0 ? "\nalles klopt." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
