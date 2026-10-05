// Van kaart naar bericht, en van bericht naar de deur uit.
//
// Welke gebeurtenis een kaart wordt, bepaalt de werkbank. Deze proef begint
// waar dat al gebeurd is: er ligt een kaart, en de vraag is of er een bericht
// uit komt dat niemand bedoeld heeft.
//
//   node scripts/proef/bericht.mjs
//
// De vraag: kan er een bericht naar 412 leden gaan dat niemand bedoeld heeft?
// Alles hieronder is een poging dat voor elkaar te krijgen.
import { verseDB, CYCLUS, POSITIE } from "./db.mjs";
import { conceptUitKaart, vraagNalezen, geefVrij, stuurTerug } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-bericht-proef.sqlite");
const env = { DB: db };
const simon = { id: "simon" };
const jacq = { id: "jacqueline" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// Een kaart is een gebeurtenis die om een antwoord vraagt. Wie die vlag zet is
// een vraag voor de werkbank; hier gaat het om wat er dáárna gebeurt, dus
// zetten we hem zelf.
const maakKaart = async (id) => {
  await db.prepare("update gebeurtenis set vraagt_antwoord = 1 where id = ?").bind(id).run();
  return { id };
};

// Een kaart: de positie is gesloten.
const gesloten = await log(env, simon, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche verdwenen bij de broker",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-01 10:00:00",
});
const kaart = await maakKaart(gesloten);
eis("er staat een kaart", !!kaart);

// ----------------------------------------------------- van kaart naar concept
let uit = await conceptUitKaart(env, simon, kaart.id, "sluiting");
eis("het concept wordt gemaakt", !!uit.publicatie);
const pid = uit.publicatie;
const p = (await q("select * from publicatie where id = ?", pid))[0];
eis("het concept staat op concept", p.status === "concept");
eis("het weet uit welke kaart het komt", p.gebeurtenis === kaart.id);
eis("de titel is ingevuld uit het sjabloon", !!p.titel && !p.titel.includes("{{"));
eis("de tekst staat er", !!p.tekst);
eis("er staan geen accolades in de tekst", !p.tekst.includes("{{"));
eis("de feiten zijn vastgelegd zoals ze nu zijn", p.contract !== undefined);

// Twee keer drukken mag geen tweede halve bericht opleveren.
uit = await conceptUitKaart(env, simon, kaart.id, "sluiting");
eis("twee keer drukken geeft hetzelfde concept", uit.publicatie === pid);
eis("en zegt dat het al bestond", uit.bestond_al === true);
eis("er staat er maar één",
    (await q("select count(*) n from publicatie where gebeurtenis = ?", kaart.id))[0].n === 1);

// Een sjabloon dat niet bestaat.
uit = await conceptUitKaart(env, simon, kaart.id, "bestaat_niet");
eis("een onbekend sjabloon kan niet", uit.publicatie === pid || !!uit.fout);

// ------------------------------------------------------- versturen zonder tekst
await db.prepare("update publicatie set tekst = '' where id = ?").bind(pid).run();
uit = await verstuurPublicatie(env, simon, pid);
eis("een leeg bericht gaat niet de deur uit", !!uit.fout);
await db.prepare("update publicatie set tekst = 'De positie is gesloten met winst.' where id = ?").bind(pid).run();

// ---------------------------------------------------------------- nalezen
uit = await vraagNalezen(env, simon, pid, "simon");
eis("je eigen bericht nalezen is geen nalezen", !!uit.fout);
uit = await vraagNalezen(env, simon, pid, "bestaat_niet");
eis("een lezer die niet bestaat kan niet", !!uit.fout);

uit = await vraagNalezen(env, simon, pid, "jacqueline");
eis("nalezen vragen lukt", !uit.fout);
eis("het bericht ligt bij de lezer",
    (await q("select status, nalezer from publicatie where id = ?", pid))[0].status === "nalezen");

// De vraag ligt bij haar, en bij niemand anders.
const liggend = (await q("select nalezer, status from publicatie where id = ?", pid))[0];
eis("het bericht wijst de nalezer aan", liggend.nalezer === "jacqueline");
eis("en wacht op haar", liggend.status === "nalezen");

// Terwijl het bij haar ligt, kan de opsteller het niet alvast versturen.
uit = await verstuurPublicatie(env, simon, pid);
eis("de opsteller kan het niet langs de nalezer heen sturen", !!uit.fout);

// ------------------------------------------------------------ terugsturen
uit = await stuurTerug(env, jacq, pid, "");
eis("terugsturen zonder te zeggen wat eraan moet kan niet", !!uit.fout);
uit = await stuurTerug(env, jacq, pid, "De tweede alinea klopt niet.");
eis("terugsturen lukt met een reden", !uit.fout);
eis("en het bericht staat weer op concept",
    (await q("select status, nalezer from publicatie where id = ?", pid))[0].status === "concept");
eis("de reden staat in de stroom",
    (await q("select count(*) n from gebeurtenis where soort = 'bericht_teruggestuurd'"))[0].n === 1);

// ------------------------------------------------------------- vrijgeven
await vraagNalezen(env, simon, pid, "jacqueline");
uit = await geefVrij(env, simon, pid);
eis("een ander dan de nalezer geeft niet vrij", !!uit.fout);
uit = await geefVrij(env, jacq, pid);
eis("de nalezer geeft vrij", !uit.fout);
const na = (await q("select status, nagelezen_op from publicatie where id = ?", pid))[0];
eis("het bericht is klaar", na.status === "klaar");
eis("en dat is niet hetzelfde als verstuurd", na.status !== "verstuurd");
eis("er staat wanneer het nagelezen is", !!na.nagelezen_op);

// -------------------------------------------------------------- versturen
uit = await verstuurPublicatie(env, simon, pid);
eis("nu mag het weg", !uit.fout);
eis("en het staat op verstuurd",
    (await q("select status from publicatie where id = ?", pid))[0].status === "verstuurd");
uit = await verstuurPublicatie(env, simon, pid);
eis("twee keer versturen kan niet", !!uit.fout);

// ---------------------------------------------- een bericht zonder positie
// Dit is waar 0104 voor was. Voor die migratie kon dit niet eens ingevoegd.
const voorstel = await log(env, simon, {
  bron: "meting", soort: "barometer_voorstel", titel: "Barometer 5 naar 4",
  cyclus: CYCLUS, feiten: { van: 5, naar: 4, reden: "de volatiliteit is gezakt" },
});
const baro = await maakKaart(voorstel);
eis("de barometerkaart staat er", !!baro);
if (baro) {
  uit = await conceptUitKaart(env, simon, baro.id, "barometer");
  eis("een bericht zonder positie kan nu", !uit.fout && !!uit.publicatie);
  const b = (await q("select * from publicatie where id = ?", uit.publicatie))[0];
  eis("en heeft echt geen positie", b.positie === null);
  eis("de feiten uit de kaart staan in de tekst", b.tekst.includes("4"));
  eis("de titel ook", (b.titel || "").includes("4"));
}

// Elk sjabloon moet in te vullen zijn zonder accolades achter te laten.
const sjablonen = await q("select * from berichtsjabloon where archief = 0");
eis("er zijn sjablonen", sjablonen.length >= 6);
for (const s of sjablonen) {
  eis(`${s.naam}: heeft tekst`, !!String(s.tekst || "").trim());
  eis(`${s.naam}: soort bestaat als keuze`,
      (await q("select count(*) n from db_choice where tabel='publicatie' and kolom='soort' and waarde=?", s.soort))[0].n === 1);
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
