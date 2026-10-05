// De wachtrij leidt af en slaat niets op.
//
//   node scripts/proef/wachtrij.mjs
//
// Twee vragen. Eén: klopt wat er op een kaart komt te staan — de prioriteit die
// met de tijd opschuift, de titel uit het sjabloon, de feiten zonder gaten.
// Twee: kan een kaart alleen de rij uit op de manieren die we bedacht hebben,
// en nooit door te verdwijnen.
import { verseDB, CYCLUS, POSITIE } from "./db.mjs";
import { wachtrij, beantwoord, prioriteitVan, vulIn, feitenVan } from "../../worker/wachtrij.js";
import { weeg } from "../../worker/motor.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-wachtrij-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// ----------------------------------------------------------- de prioriteit
const laag = { prioriteit: "laag", opschalen_naar: "medium", opschalen_na_uur: 168 };
eis("vers begint hij waar de definitie zegt", prioriteitVan(laag, 1).prioriteit === "laag");
eis("en is dan niet opgeschaald", prioriteitVan(laag, 1).opgeschaald === false);
eis("na de termijn schuift hij op", prioriteitVan(laag, 200).prioriteit === "medium");
eis("en dat is zichtbaar", prioriteitVan(laag, 200).opgeschaald === true);
eis("laag is grijs, niet groen", prioriteitVan(laag, 1).kleur === "grijs");
eis("hoog is rood", prioriteitVan({ prioriteit: "hoog" }, 0).kleur === "rood");
eis("medium is amber", prioriteitVan({ prioriteit: "medium" }, 0).kleur === "amber");

// Opschalen kan nooit naar beneden, ook niet als iemand het zo inricht.
const omlaag = { prioriteit: "hoog", opschalen_naar: "laag", opschalen_na_uur: 1 };
eis("opschalen gaat nooit omlaag", prioriteitVan(omlaag, 999).prioriteit === "hoog");

// Een definitie zonder opschaling blijft staan waar hij staat.
eis("zonder termijn verandert er niets",
    prioriteitVan({ prioriteit: "medium" }, 100000).prioriteit === "medium");

// --------------------------------------------------------------- de tekst
const gegevens = { positie: { naam: "OESX 6050 PUT", strike: 6050 }, feiten: { van: 5 } };
eis("een sjabloon wordt ingevuld", vulIn("Gesloten: {{positie.naam}}", gegevens) === "Gesloten: OESX 6050 PUT");
eis("wat ontbreekt valt weg, geen accolades op het scherm",
    vulIn("Gesloten: {{positie.bestaatniet}}", gegevens) === "Gesloten:");
eis("een onbekende groep valt ook weg",
    vulIn("A {{niets.hier}} B", gegevens) === "A B");
eis("een leeg sjabloon geeft niets", vulIn(null, gegevens) === null);

const feiten = feitenVan({ feiten: '["positie.naam","positie.premie","feiten.van"]' }, gegevens);
eis("alleen gevulde feiten komen erin", feiten.length === 2);
eis("het label leest als Nederlands", feiten[0].label === "Naam");
eis("kapotte json geeft een lege lijst", feitenVan({ feiten: "{{{" }, gegevens).length === 0);

// ------------------------------------------------------- een echte kaart
await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche verdwenen bij de broker",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-01 10:00:00",
});
await weeg(env);

let rij = await wachtrij(env, ik, { nu: "2026-09-01T12:00:00Z" });
eis("er staat een kaart in de rij", rij.kaarten.length === 1);
const k = rij.kaarten[0];
eis("de kaart heeft een titel", !!k.titel);
eis("de kaart draagt zijn reden", !!k.reden);
eis("de kaart weet hoe lang hij openstaat", k.uren_open === 2);
eis("de kaart heeft knoppen", k.knoppen.length >= 1);
eis("de prullenbak heeft een doel", k.prullenbak && k.prullenbak.doel === "afsluiten");
eis("de telling klopt", rij.telling.hoog + rij.telling.medium + rij.telling.laag === 1);

// Niets hiervan staat op de gebeurtenis zelf.
const ruw = (await q("select * from gebeurtenis where id = ?", k.id))[0];
eis("er is geen prioriteit opgeslagen", ruw.prioriteit === undefined);

// Dezelfde kaart, drie dagen later: opgeschaald zonder dat er iets veranderde.
const later = await wachtrij(env, ik, { nu: "2026-09-04T12:00:00Z" });
eis("de kaart is met de tijd meegegaan", later.kaarten[0].uren_open === 74);

// ------------------------------------------------------- knoppen en sloten
let uit = await beantwoord(env, ik, k.id, { knop: 9 });
eis("een knop die niet bestaat wordt geweigerd", !!uit.fout);
uit = await beantwoord(env, ik, k.id, { doel: "splitsen" });
eis("een doel dat niet op deze kaart staat wordt geweigerd", !!uit.fout);
uit = await beantwoord(env, ik, k.id, { knop: 2 });
eis("een knop die een reden vraagt weigert zonder reden", !!uit.fout);
eis("en de kaart staat er nog", (await wachtrij(env, ik)).kaarten.length === 1);

// ------------------------------------------------------------ uitstellen
uit = await beantwoord(env, ik, k.id, { doel: "afsluiten" });
eis("de prullenbak is een geldig doel", !uit.fout);
eis("en de kaart is uit de rij", (await wachtrij(env, ik)).kaarten.length === 0);
eis("maar de gebeurtenis staat er nog",
    (await q("select count(*) n from gebeurtenis where id = ?", k.id))[0].n === 1);
eis("met een antwoord erop",
    !!(await q("select antwoord from gebeurtenis where id = ?", k.id))[0].antwoord);
eis("en met wie het beantwoordde",
    (await q("select beantwoord_door from gebeurtenis where id = ?", k.id))[0].beantwoord_door === "simon");

uit = await beantwoord(env, ik, k.id, { doel: "afsluiten" });
eis("twee keer beantwoorden kan niet", !!uit.fout);

// Een tweede kaart om uitstellen op te proberen.
await log(env, ik, {
  bron: "ibkr", soort: "positie_geopend", titel: "Nieuwe tranche",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-02 10:00:00",
});
await weeg(env);
const tweede = (await wachtrij(env, ik)).kaarten[0];
eis("de tweede kaart staat er", !!tweede);

uit = await beantwoord(env, ik, tweede.id, { doel: "afsluiten", tot: null, knop: null });
eis("afsluiten werkt ook hier", !uit.fout);

// Uitstellen zelf: op een definitie die dat als prullenbakdoel heeft.
await db.prepare("update processtap set prullenbak_doel = 'uitstellen' where kaartsoort = 'week_update'").run();
await log(env, ik, {
  bron: "klok", soort: "week_verstreken", titel: "Een week zonder bericht",
  cyclus: CYCLUS, moment: "2026-09-03 06:00:00", feiten: { week: "2026-36" },
});
await weeg(env);
const derde = (await wachtrij(env, ik)).kaarten.find((x) => x.kaartsoort === "week_update");
eis("de week-kaart staat er", !!derde);
if (derde) {
  uit = await beantwoord(env, ik, derde.id, { doel: "uitstellen", tot: "2099-01-01 06:00:00" });
  eis("uitstellen lukt", !uit.fout);
  const naUitstel = await wachtrij(env, ik);
  eis("de uitgestelde kaart is uit de rij",
      !naUitstel.kaarten.some((x) => x.id === derde.id));
  const nog = (await q("select beantwoord_op, wachten_tot from gebeurtenis where id = ?", derde.id))[0];
  eis("maar hij is niet beantwoord", nog.beantwoord_op === null);
  eis("en hij heeft een datum waarop hij terugkomt", !!nog.wachten_tot);
  const terug = await wachtrij(env, ik, { nu: "2099-06-01T06:00:00Z" });
  eis("en hij komt terug", terug.kaarten.some((x) => x.id === derde.id));
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
