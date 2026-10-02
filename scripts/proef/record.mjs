import { maakDB } from "./d1.mjs";
import { record } from "../../worker/record.js";
import { stappenVoor } from "../../worker/proces.js";

const env = { DB: maakDB(process.argv[2] || "/tmp/proef.db") };
const ik = { id: "simon" };
const tabel = process.argv[3] || "cyclus";
const id = Number(process.argv[4] || 7);

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
