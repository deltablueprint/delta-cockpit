import { verseDB, CYCLUS } from "./scripts/proef/db.mjs";
import { werkbank } from "./worker/werkbank.js";
const db = verseDB("/tmp/delta-terugblik.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
// een afgesloten cyclus
await db.prepare("insert into cyclus (label, status, geopend_op, doelexpiratie, afgesloten_op) values ('Oude cyclus','afgesloten','2026-05-01','2026-05-29','2026-05-29')").run();
const r = await db.prepare("select id from cyclus where label = 'Oude cyclus'").first();
console.log("cyclus", r.id);
try {
  const uit = await werkbank(env, ik, { cyclus: r.id });
  console.log("cyclus terug:", uit.cyclus && uit.cyclus.label, "| actief:", uit.actief,
    "| afgelopen:", (uit.afgelopen||[]).map(c=>c.label), "| posities:", (uit.posities||[]).length);
} catch (e) { console.log("FOUT:", e.message, e.stack.split("\n")[1]); }
