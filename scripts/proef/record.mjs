// Eén record ophalen zoals het scherm het krijgt.
//
//   node scripts/proef/record.mjs                 een verse database
//   node scripts/proef/record.mjs positie 9       een andere tabel
//   node scripts/proef/record.mjs cyclus 7 /pad/naar.sqlite   een bestaande
import { maakDB } from "./d1.mjs";
import { verseDB, CYCLUS } from "./db.mjs";
import { record } from "../../worker/record.js";
import { stappenVoor } from "../../worker/proces.js";

const tabel = process.argv[2] || "cyclus";
const id = Number(process.argv[3] || CYCLUS);
const env = { DB: process.argv[4] ? maakDB(process.argv[4]) : verseDB() };
const ik = { id: "simon" };

try {
  const uit = await record(env, tabel, id, ik);
  if (uit.fout) { console.log("FOUT:", uit.fout); process.exit(1); }
  console.log("titel        ", uit.waarden[uit.tabel.titel_veld]);
  console.log("fase         ", uit.proces ? uit.proces.nu : "—");
  console.log("tabbladen    ", uit.relaties.map((r) => `${r.label} (${r.aantal})`).join(" · "));
  console.log("stappen:");
  for (const s of uit.stappen) {
    console.log(`  [${s.gedaan ? "x" : " "}] ${s.fase.padEnd(20)} ${s.naam}${s.stand ? ` — ${s.stand}` : ""}`);
  }
} catch (fout) {
  console.log("UITZONDERING:", fout.message);
  console.log(fout.stack.split("\n").slice(0, 4).join("\n"));
}
