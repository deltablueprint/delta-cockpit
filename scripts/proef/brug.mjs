// De ontvangstkant van de brug tegen een echte database.
import { maakDB } from "./d1.mjs";
import { neemStand, stand } from "../../worker/brug.js";

const env = { DB: maakDB(process.argv[2] || "/tmp/brug.db") };
const toon = (w, x) => console.log(w, JSON.stringify(x));

const put = (conid, strike, aantal, prijs) => ({
  conid, contract: `OESX 20NOV26 ${strike} PUT`, onderliggend: "OESX", soort: "OPT",
  strike, expiratiedatum: "2026-11-20", putcall: "P", multiplier: 10,
  aantal, gem_kostprijs: 38.2, marktprijs: prijs, waarde: prijs * 10 * aantal,
});

toon("eerste zending ", await neemStand(env, {
  verbonden: true, rekening: "DU1234567", kapitaal: 250000,
  posities: [put("700000003", 5600, -2, 31.5), put("700000004", 5500, -1, 12.0)],
  gebeurtenissen: [{ soort: "positie", conid: "700000003", contract: "OESX 20NOV26 5600 PUT", van: null, naar: -2 }],
}));

let s = await stand(env);
console.log("live:", s.live, "| stil:", s.stil_seconden, "s | posities:", s.posities.length, "| kapitaal:", s.kapitaal);

// Eén positie sluit: hij hoort uit het beeld te verdwijnen, en de gebeurtenis blijft.
toon("na sluiting   ", await neemStand(env, {
  verbonden: true, rekening: "DU1234567", kapitaal: 251200,
  posities: [put("700000003", 5600, -2, 29.0)],
  gebeurtenissen: [
    { soort: "uitvoering", conid: "700000004", contract: "OESX 20NOV26 5500 PUT",
      richting: "koop", aantal: 1, prijs: 12.0, uitvoering_id: "EX-1", moment: "2026-10-03T14:02:11Z" },
    { soort: "positie", conid: "700000004", contract: "OESX 20NOV26 5500 PUT", van: -1, naar: 0 },
  ],
}));

// Dezelfde uitvoering nog eens: die mag niet dubbel in het spoor komen.
await neemStand(env, {
  verbonden: true, posities: [put("700000003", 5600, -2, 29.0)],
  gebeurtenissen: [{ soort: "uitvoering", conid: "700000004", contract: "OESX 20NOV26 5500 PUT",
                     richting: "koop", aantal: 1, prijs: 12.0, uitvoering_id: "EX-1" }],
});

s = await stand(env);
console.log("posities nu:", s.posities.map((p) => `${p.contract} ${p.aantal}`).join(" · "));
console.log("spoor:", s.gebeurtenissen.map((g) => `${g.soort}:${g.contract}${g.prijs ? `@${g.prijs}` : ""}`).join(" · "));
console.log("uitvoeringen in het spoor:", s.gebeurtenissen.filter((g) => g.soort === "uitvoering").length, "(hoort 1 te zijn)");

// En als de brug zwijgt.
await env.DB.prepare("update brokerverbinding set laatste_bericht = datetime('now','-2 minutes') where id = 1").run();
s = await stand(env);
console.log("na 2 minuten stilte — live:", s.live, "| stil:", s.stil_seconden, "s");
