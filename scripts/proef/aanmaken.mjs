import { maakAan } from "../../worker/schrijf.js";
import { maakDB } from "./d1.mjs";

const env = { DB: maakDB(process.argv[2] || "/tmp/proef.db") };
const ik = { id: "simon" };

const uit = await maakAan(env, ik, "inzending", {
  velden: {
    beoordelingsmoment: "3",
    positie: "go",
    strike: "5600",
    expiratiedatum: "2026-10-30",
    inzet_pct: "12",
    motivering: "goed momentum",
  },
  ouderkolom: "beoordelingsmoment",
});
console.log(uit);
