// De werkbank volgt het proces, stap voor stap.
//
//   node scripts/proef/flow.mjs
//
// Eén cyclus, van openen tot een verstuurd bericht, en na elke handeling de
// vraag: staat er in de werkbank precies wat er op dat moment van ons gevraagd
// wordt? Niet meer — een kaart die blijft staan nadat het werk gedaan is, laat
// de werkbank iets beweren dat niet klopt. En niet minder.
import { verseDB, CYCLUS, MOMENT, POSITIE } from "./db.mjs";
import { draai, meld, weeg } from "../../worker/motor.js";
import { wachtrij } from "../../worker/wachtrij.js";
import { tedoen } from "../../worker/stappen.js";
import { conceptUitKaart } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";
import { log } from "../../worker/stroom.js";
import { stelVast } from "../../worker/barometer.js";

const db = verseDB("/tmp/delta-flow-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;
const een = async (s, ...b) => await db.prepare(s).bind(...b).first();

let fouten = 0;
let waar = "";
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  [${waar}] ${wat}`); } };

// De kaartsoorten die nu openstaan, op naam.
const open = async () =>
  (await wachtrij(env, ik, { van: "alles" })).kaarten.map((k) => k.kaartsoort).sort();

// Wat er volgens de werkbank op dit moment gevraagd wordt, moet kloppen met wat
// het proces zegt. Deze functie is het hart van deze proef.
async function verwacht(stap, soorten) {
  waar = stap;
  await draai(env, { aanleiding: "mens", klok: false });
  const nu = await open();
  const wil = [...soorten].sort();
  eis(`de wachtrij toont ${wil.join(", ") || "niets"} (en toont: ${nu.join(", ") || "niets"})`,
      JSON.stringify(nu) === JSON.stringify(wil));
}

// --------------------------------------------------------------- de opening
// Een verse cyclus zonder besluit en zonder positie vraagt nog niets van de
// wachtrij: het werk zit in de processtappen, niet in kaarten.
await db.prepare("delete from voorwaarde where cyclus = ?").bind(CYCLUS).run();
await db.prepare("update beoordelingsmoment set status = 'uitkomst vastgelegd' where cyclus = ?").bind(CYCLUS).run();
await db.prepare("update positie set status = 'gesloten' where cyclus = ?").bind(CYCLUS).run();

// Een cyclus die nog nooit een venster had, vraagt er meteen om: de leden zien
// niets terwijl het proces wel ergens staat.
await verwacht("venster nooit gezet", ["venster"]);

// Zet hem op wat er hoort, en de kaart verdwijnt vanzelf.
const zetVenster = async (stand) => {
  await stelVast(env, ik, {
    cyclus: CYCLUS, stand: 2, venster: stand, reden: "Proef.",
  }).catch(() => null);
};
await zetVenster("pre_analyse");
await verwacht("verse cyclus, venster klopt", []);

const stappen = (await tedoen(env, CYCLUS)).stappen;
eis("maar er is wel werk: het staat bij de stappen", stappen.length > 0);

// --------------------------------------------------- een besluit dat opent
// Een besluit dat opent zet twee dingen in gang: de charts moeten gelezen, en
// de leden horen te weten dat er een besluit loopt.
await db.prepare("update beoordelingsmoment set status = 'inzendingen open' where id = ?").bind(MOMENT).run();
await verwacht("besluit open", ["chartlezing", "venster"]);

await zetVenster("besluit");
await verwacht("en het venster is bijgesteld", ["chartlezing"]);

// De charts lezen laat de kaart vanzelf verdwijnen. Dit is de bug die Simon
// vond: hij vulde de analyse in en de kaart bleef staan.
await db.prepare(
  `insert into chartlezing (cyclus, beoordelingsmoment, onderwerp, afbeelding, commentaar)
   values (?, ?, 'OESX dag', 'data:image/png;base64,xx', 'neerwaartse trend')`
).bind(CYCLUS, MOMENT).run();
await verwacht("charts gelezen", []);

// --------------------------------------------------------- blind inzenden
await db.prepare("update beoordelingsmoment set status = 'blind inzenden' where id = ?").bind(MOMENT).run();
await verwacht("blind inzenden", ["gonogo", "gonogo", "gonogo"]);

// Eén voor één inzenden: elke stem die binnenkomt haalt precies één kaart weg.
const deelnemers = (await q("select id from gebruiker where actief = 1 order by id")).map((g) => g.id);
let over = deelnemers.length;
for (const wie of deelnemers) {
  await db.prepare(
    "insert into inzending (cyclus, beoordelingsmoment, deelnemer, status, verstuurd_op) values (?, ?, ?, 'verstuurd', datetime('now'))"
  ).bind(CYCLUS, MOMENT, wie).run();
  over--;
  await verwacht(`${wie} heeft ingezonden`, Array(over).fill("gonogo"));
}

// ------------------------------------------------------ het besluit vastleggen
await db.prepare("update beoordelingsmoment set status = 'blind versturen' where id = ?").bind(MOMENT).run();
await verwacht("uitkomst nog niet vastgelegd", ["reviewbesluit"]);

await db.prepare("update beoordelingsmoment set status = 'uitkomst vastgelegd' where id = ?").bind(MOMENT).run();
// Het besluit is rond, dus het venster klopt niet meer: terug naar gesloten.
await verwacht("uitkomst vastgelegd", ["venster"]);
await zetVenster("pre_analyse");
await verwacht("en het venster weer gesloten", []);

// 'Opent binnenkort' en 'Open' zijn jullie oordeel. Staat het venster daarop,
// dan houdt het systeem zijn mond — ook al zegt het proces iets anders.
await zetVenster("opent_binnenkort");
await verwacht("een oordeel van jullie wordt niet tegengesproken", []);
await zetVenster("open");
await verwacht("ook 'open' niet", []);
await zetVenster("pre_analyse");

// ------------------------------------------------ een voorwaarde die omslaat
await db.prepare(
  "insert into voorwaarde (cyclus, naam, soort, status, volgorde) values (?, 'VSTOXX bandbreedte', 'meting', 'rood', 10)"
).bind(CYCLUS).run();
await verwacht("een voorwaarde staat op rood", ["herbeoordeling"]);

await db.prepare("update voorwaarde set status = 'groen' where cyclus = ?").bind(CYCLUS).run();
await verwacht("en weer op groen", []);

// En nog eens rood: de kaart hoort gewoon terug te komen.
await db.prepare("update voorwaarde set status = 'rood' where cyclus = ?").bind(CYCLUS).run();
await verwacht("weer rood", ["herbeoordeling"]);
await db.prepare("update voorwaarde set status = 'groen' where cyclus = ?").bind(CYCLUS).run();
await verwacht("en weer groen", []);

// --------------------------------------------- een positie die opent en sluit
// Dit is de andere helft: wat van IBKR komt. Een kaart die om een bericht vraagt
// lost nooit vanzelf op — daar is het antwoord het punt — dus die moet blijven
// staan tot het bericht weg is.
await log(env, ik, {
  bron: "ibkr", soort: "positie_geopend", cyclus: CYCLUS, positie: POSITIE,
  titel: "Nieuwe tranche herkend",
});
// De tranche staat in de markt: dat is een bericht aan de leden én een venster
// dat bijgesteld hoort te worden.
await db.prepare("update positie set status = 'bewaken' where id = ?").bind(POSITIE).run();
await verwacht("IBKR meldt een opening", ["positie_geopend", "venster"]);
await zetVenster("in_positie");
await verwacht("en het venster staat op in positie", ["positie_geopend"]);

waar = "een ronde later";
await draai(env, { aanleiding: "mens", klok: false });
eis("een berichtkaart lost niet vanzelf op",
    (await open()).includes("positie_geopend"));

const kaart = (await wachtrij(env, ik, { van: "alles" })).kaarten
  .find((k) => k.kaartsoort === "positie_geopend");
const concept = await conceptUitKaart(env, ik, kaart.id);
await verwacht("een concept opstellen haalt hem ook niet weg", ["positie_geopend"]);

await db.prepare("update publicatie set tekst = 'We zijn een positie ingegaan.' where id = ?")
  .bind(concept.publicatie).run();
await verstuurPublicatie(env, ik, concept.publicatie);
await verwacht("pas het versturen sluit hem", []);

// ------------------------------------------- en de twee soorten door elkaar
// Een toestand en een bericht tegelijk: ze mogen elkaar niet in de weg zitten.
await db.prepare("update voorwaarde set status = 'rood' where cyclus = ?").bind(CYCLUS).run();
await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS, positie: POSITIE,
  titel: "Tranche verdwenen bij de broker",
});
await verwacht("allebei tegelijk", ["herbeoordeling", "positie_gesloten"]);

await db.prepare("update voorwaarde set status = 'groen' where cyclus = ?").bind(CYCLUS).run();
await verwacht("de toestand lost op, het bericht blijft", ["positie_gesloten"]);

// ------------------------------------------- de kaart leest als een vraag
waar = "de kop van een kaart";
const alle = (await wachtrij(env, ik, { van: "alles" })).kaarten;
for (const k of alle) {
  eis(`${k.kaartsoort}: de titel bevat geen accolades`, !String(k.titel).includes("{{"));
  // Waar het over gaat hoort naast de titel te staan, niet erin. Anders leest
  // 'Technische analyse Test Cyclus' als één zin.
  if (k.waarover) {
    eis(`${k.kaartsoort}: de cyclusnaam staat niet in de titel`,
        !String(k.titel).includes(k.waarover));
  }
}
const metCyclus = await q(
  "select kaartsoort, kaarttitel from processtap where kaartsoort is not null and kaarttitel like '%cyclus.naam%'"
);
eis(`geen enkele kaarttitel draagt de cyclusnaam (${metCyclus.map((m) => m.kaartsoort).join(", ")})`,
    metCyclus.length === 0);

// ----------------------------------- elke kaart hoort in één van twee hoeken
//
// De werkbank heeft twee secties: Communicatie naar leden, en Taken. Welke kaart
// waar hoort beslist de wachtrij, op grond van waar knop 1 heen gaat. Er mag
// geen kaart zijn die nergens hoort.
waar = "de twee hoeken";
await db.prepare("update voorwaarde set status = 'rood' where cyclus = ?").bind(CYCLUS).run();
await draai(env, { aanleiding: "mens", klok: false });
const hoeken = (await wachtrij(env, ik, { van: "alles" })).kaarten;
for (const k of hoeken) {
  eis(`${k.kaartsoort}: hoort in leden of werk (en hoort in: ${k.hoek})`,
      k.hoek === "leden" || k.hoek === "werk");
}
// En de indeling moet kloppen met wat de definitie zegt.
for (const d of await q("select kaartsoort, knop1_doel from processtap where kaartsoort is not null")) {
  const k = hoeken.find((x) => x.kaartsoort === d.kaartsoort);
  if (!k) continue;
  eis(`${d.kaartsoort}: ${d.knop1_doel} hoort bij ${k.hoek}`,
      k.hoek === (d.knop1_doel === "publicatie" ? "leden" : "werk"));
}
eis("er staat werk in beide hoeken",
    hoeken.some((k) => k.hoek === "leden") && hoeken.some((k) => k.hoek === "werk"));

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
