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

// ------------------------------------------------- twee rekeningen, één cockpit
//
// De Flex-query hangt aan een login, en die login ziet vaak het live account én
// het paper account. Komt er een rapport over een andere rekening binnen dan
// waar de brug op zit, dan beschrijven de twee bronnen verschillende
// portefeuilles — en alles wat je daarna leest is een mengsel. Dat moet
// weigeren, niet aanvullen.
{
  const { neemRapportAan, rekeningenIn } = await import("../../worker/lynx.js");
  const vreemdXml = `<?xml version="1.0"?><FlexQueryResponse queryName="Delta" type="AF">
    <FlexStatements count="1"><FlexStatement accountId="U9999999" fromDate="2026-10-01" toDate="2026-10-06">
      <OpenPositions><OpenPosition accountId="U9999999" conid="700000003" assetCategory="OPT"
        symbol="ESTX50" position="-1" multiplier="10" strike="5825" expiry="20261030" putCall="P"/></OpenPositions>
    </FlexStatement></FlexStatements></FlexQueryResponse>`;

  let f = 0;
  const e = (wat, goed) => { if (!goed) { f++; console.log(`FOUT  ${wat}`); } };

  e("de rekeningen zijn uit het rapport te lezen", rekeningenIn(vreemdXml).includes("U9999999"));

  await env.DB.prepare("update brokerverbinding set rekening = 'DUR234269' where id = 1").run();
  const uit = await neemRapportAan(env, vreemdXml, "proef");
  e("een rapport van een andere rekening wordt geweigerd", !!uit.fout && uit.status === 409);
  e("en het zegt om welke twee rekeningen het gaat",
    String(uit.fout).includes("U9999999") && String(uit.fout).includes("DUR234269"));

  const eigen = vreemdXml.replaceAll("U9999999", "DUR234269");
  const ok = await neemRapportAan(env, eigen, "proef");
  e("een rapport van de eigen rekening gaat er gewoon in", !ok.fout);

  console.log(`twee rekeningen: ${f === 0 ? "klopt" : f + " fout(en)"}`);
  if (f) process.exit(1);
}

// --------------------------------------- één contract, twee namen en één schaal
//
// Eurex noemt de optie op de Euro Stoxx 50 OESX, IBKR stuurt hem door als
// ESTX50. En IBKR rekent de gemiddelde kostprijs van een optie per contract:
// bij multiplier 10 staat er 133,50 waar wij 13,35 punten bedoelen. Allebei
// stil fout: het ene geeft een naam die een lid nergens anders ziet, het andere
// een premie die tien keer te hoog is — in een bericht dat de deur uit gaat.
{
  const { huisContract, huisSymbool } = await import("../../worker/positie.js");
  const { brugPosities } = await import("../../worker/brug.js");

  let f = 0;
  const e = (wat, goed) => { if (!goed) { f++; console.log(`FOUT  ${wat}`); } };

  e("ESTX50 heet bij ons OESX", huisSymbool("ESTX50") === "OESX");
  e("en een hele contractnaam gaat mee",
    huisContract("ESTX50 30OKT26 5825 PUT") === "OESX 30OKT26 5825 PUT");
  e("een naam die we niet kennen blijft staan", huisContract("AEX 20NOV26 900 PUT").startsWith("AEX"));

  await neemStand(env, {
    verbonden: true, rekening: "DUR234269", kapitaal: 999984,
    posities: [{
      conid: "778899", contract: "ESTX50 30OKT26 5825 PUT", onderliggend: "ESTX50",
      soort: "OPT", strike: 5825, expiratiedatum: "2026-10-30", putcall: "P",
      multiplier: 10, aantal: -1, gem_kostprijs: 133.50, marktprijs: 14.91,
    }],
    gebeurtenissen: [],
  });

  const rij = (await q("select contract, onderliggend from brokerpositie where conid = '778899'"))[0];
  e("de brug zet de huisnaam in de database", rij && rij.contract === "OESX 30OKT26 5825 PUT");
  e("ook het onderliggende", rij && rij.onderliggend === "OESX");

  const [bp] = (await brugPosities(env)).filter((x) => String(x.conid) === "778899");
  e("de premie komt in punten bij de herkenning aan", bp && Math.abs(bp.gem_kostprijs - 13.35) < 0.001);

  console.log(`naam en schaal: ${f === 0 ? "klopt" : f + " fout(en)"}`);
  if (f) process.exit(1);
}

// ----------------------------------------- de Gateway aan en uit vanuit de kop
//
// IBKR laat per login één sessie toe: zolang de Gateway aangemeld is kan er geen
// mens in LYNX. De schakelaar in de kop zet die Gateway uit — en dat gaat langs
// dezelfde weg als elke andere instelling: de brug leest hem af in het antwoord
// op zijn eigen zending. De cockpit stuurt niets naar de brug.
{
  const { zetInstellingen, stand } = await import("../../worker/brug.js");

  let f = 0;
  const e = (wat, goed) => { if (!goed) { f++; console.log(`FOUT  ${wat}`); } };

  const uit = await zetInstellingen(env, { id: "simon" }, { gateway_aan: "0" });
  e("de schakelaar is te zetten", !uit.fout);

  const s2 = await stand(env);
  const inst = (s2.instellingen || []).find((r) => r.sleutel === "gateway_aan");
  e("en staat in de stand die het scherm ophaalt", inst && inst.waarde === "0");

  // De brug haalt hem op in het antwoord op zijn eigen zending — geen tweede
  // weg, geen inkomende verbinding.
  const antwoord = await neemStand(env, {
    verbonden: true, rekening: "DUR234269", kapitaal: 1, posities: [], gebeurtenissen: [],
  });
  e("de brug krijgt hem mee in zijn eigen antwoord",
    antwoord.instellingen && Number(antwoord.instellingen.gateway_aan) === 0);

  await zetInstellingen(env, { id: "simon" }, { gateway_aan: "1" });
  const terug = await neemStand(env, {
    verbonden: true, rekening: "DUR234269", kapitaal: 1, posities: [], gebeurtenissen: [],
  });
  e("en weer aan ook", Number(terug.instellingen.gateway_aan) === 1);

  console.log(`de schakelaar: ${f === 0 ? "klopt" : f + " fout(en)"}`);
  if (f) process.exit(1);
}
