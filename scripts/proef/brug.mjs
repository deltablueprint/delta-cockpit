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
// De stand van de onderliggende. Daar meet de barometer mee; komt hij niet
// binnen, dan meet die niets en stelt het systeem niets voor.
const q = async (sql) => (await env.DB.prepare(sql).all()).results;
let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };
await neemStand(env, {
  posities: [], gebeurtenissen: [],
  marktstanden: [{ onderliggend: "OESX", stand: 5412.5 }],
});
let ms = (await q("select onderliggend, stand, bron from marktstand")).find((r) => r.onderliggend === "OESX");
eis("de koers van de onderliggende komt binnen", !!ms && Number(ms.stand) === 5412.5);
eis("en weet waar hij vandaan komt", ms && ms.bron === "brug");

await neemStand(env, { posities: [], gebeurtenissen: [], marktstanden: [{ onderliggend: "OESX", stand: 5390 }] });
ms = (await q("select onderliggend, stand from marktstand")).find((r) => r.onderliggend === "OESX");
eis("een nieuwe stand overschrijft de oude", Number(ms.stand) === 5390);
eis("er staat één rij per onderliggende",
    (await q("select count(*) n from marktstand where onderliggend = 'OESX'"))[0].n === 1);

await neemStand(env, { posities: [], gebeurtenissen: [], marktstanden: [{ onderliggend: "", stand: 1 }, { stand: null }] });
eis("onzin wordt overgeslagen zonder te klagen",
    (await q("select count(*) n from marktstand"))[0].n === 1);

// Een stand van 0 is geen koers maar een leeg veld dat door Number() heen kwam.
await neemStand(env, { posities: [], gebeurtenissen: [], marktstanden: [{ onderliggend: "DAX", stand: 0 }] });
eis("een stand van nul is geen koers",
    (await q("select count(*) n from marktstand where onderliggend = 'DAX'"))[0].n === 0);

// Het moment komt van de brug, niet van de ontvangst. Anders is elke koers
// altijd vers en meet de barometer op de hartslag in plaats van op de markt.
await neemStand(env, { posities: [], gebeurtenissen: [],
  marktstanden: [{ onderliggend: "OESX", stand: 5400, moment: "2026-10-01T09:30:00.000Z" }] });
ms = (await q("select moment from marktstand where onderliggend = 'OESX'"))[0];
eis("het tijdstip van de tik wordt bewaard", String(ms.moment).startsWith("2026-10-01 09:30"));

// Een tijdstip uit de toekomst is een klok die verkeerd staat; dan liever nu.
await neemStand(env, { posities: [], gebeurtenissen: [],
  marktstanden: [{ onderliggend: "OESX", stand: 5405, moment: "2099-01-01T00:00:00.000Z" }] });
ms = (await q("select moment from marktstand where onderliggend = 'OESX'"))[0];
eis("een tijdstip uit de toekomst wordt niet overgenomen", !String(ms.moment).startsWith("2099"));

await neemStand(env, { posities: [], gebeurtenissen: [],
  marktstanden: [{ onderliggend: "OESX", stand: 5410, moment: "ergens vanmorgen" }] });
ms = (await q("select moment from marktstand where onderliggend = 'OESX'"))[0];
eis("een onleesbaar tijdstip ook niet", !!ms.moment && !String(ms.moment).includes("ergens"));
console.log(`koers van de onderliggende: ${fouten === 0 ? "klopt" : fouten + " fout(en)"}`);
if (fouten) process.exit(1);

console.log("na 2 minuten stilte — live:", s.live, "| stil:", s.stil_seconden, "s");
