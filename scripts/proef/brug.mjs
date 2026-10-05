// De ontvangstkant van de brug tegen een echte database.
import { verseDB } from "./db.mjs";
import { neemStand, stand } from "../../worker/brug.js";

// Een verse database uit de migraties. Dit stond op een bestand dat bleef
// liggen, en dan draait de proef tegen het schema van vorige week: een nieuwe
// tabel bestaat er niet en de proef valt om op iets dat niet stuk is.
const env = { DB: verseDB(process.argv[2] || "/tmp/delta-brug-proef.sqlite") };
const toon = (w, x) => console.log(w, JSON.stringify(x));

const put = (conid, strike, aantal, prijs) => ({
  conid, contract: `OESX 20NOV26 ${strike} PUT`, onderliggend: "OESX", soort: "OPT",
  strike, expiratiedatum: "2026-11-20", putcall: "P", multiplier: 10,
  aantal, gem_kostprijs: 38.2, marktprijs: prijs, waarde: prijs * 10 * aantal,
  // De bied- en laatprijs: hiermee meet de barometer. De laatprijs is wat het
  // kost om eruit te stappen.
  biedprijs: prijs - 0.6, laatprijs: prijs + 0.4,
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
// De prijs van een contract. Daar meet de barometer mee: waar staat de ask op
// de weg van waardeloos naar de stoploss. De indexkoers hoeft daar niet voor
// binnen te komen — dat scheelt een abonnement en een afhankelijkheid.
const q = async (sql) => (await env.DB.prepare(sql).all()).results;
let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

const bp = (await q("select laatprijs, biedprijs, gewijzigd_op from brokerpositie where conid = '700000003'"))[0];
eis("de laatprijs komt binnen", bp && Number(bp.laatprijs) === 29.4);
eis("het bod ook", bp && Math.abs(Number(bp.biedprijs) - 28.4) < 0.001);
eis("en er staat wanneer die prijs binnenkwam", !!bp && !!bp.gewijzigd_op);
console.log(`prijzen van de broker: ${fouten === 0 ? "klopt" : fouten + " fout(en)"}`);
if (fouten) process.exit(1);

console.log("na 2 minuten stilte — live:", s.live, "| stil:", s.stil_seconden, "s");
