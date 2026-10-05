// De fouten die een review vond, en die niet terug mogen komen.
//
//   node scripts/proef/hersteld.mjs
//
// Elke proef hieronder faalde vóór zijn reparatie. Ze staan bij elkaar omdat ze
// één ding gemeen hebben: het waren stille fouten. Niets viel om, niemand kreeg
// een melding — de uitkomst was gewoon verkeerd, en bij de meeste zouden de
// leden het als eerste gemerkt hebben.
//
// Het waren er negen. Drie ervan gingen over de kaartlaag die eruit is
// (BOUWSPEC §13b) en konden niet blijven staan; ze staan in de git-tak
// 'voor-de-herbouw' en horen terug te komen met de nieuwe werkbank. De zes
// hieronder gaan over de berichten, de spiegel en het lezen van een tijdstip,
// en die staan nog gewoon overeind.
import { verseDB, CYCLUS, MOMENT, POSITIE } from "./db.mjs";
import { conceptUitKaart, vraagNalezen, geefVrij, stuurTerug } from "../../worker/bericht.js";
import { verstuurPublicatie, spiegel } from "../../worker/spiegel.js";
import { stelVast, huidig, stelVoor } from "../../worker/barometer.js";
import { log, stroom } from "../../worker/stroom.js";
import { leesMoment, urenSinds } from "../../worker/tijd.js";

const db = verseDB("/tmp/delta-hersteld-proef.sqlite");
const env = { DB: db };
const simon = { id: "simon" };
const jacq = { id: "jacqueline" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;
const een = async (s, ...b) => await db.prepare(s).bind(...b).first();

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// ---------------------------------------------------------------------- 3
// Een barometerbericht zette het stempel 'bij de leden' op de nieuwste stand in
// plaats van op de stand waar het bericht over ging.
await stelVast(env, simon, { cyclus: CYCLUS, stand: 3, venster: "open", reden: "Rustig." });
const voorstel = await stelVoor(env, { cyclus: CYCLUS, naar: 4, reden: "De stand gaat naar 4." });
const barokaart = { id: voorstel.gebeurtenis };
await db.prepare("update gebeurtenis set vraagt_antwoord = 1 where id = ?").bind(barokaart.id).run();
const baroBericht = (await conceptUitKaart(env, simon, barokaart.id, "barometer")).publicatie;
await db.prepare("update publicatie set tekst = 'De stand gaat naar 4.' where id = ?").bind(baroBericht).run();
// De stand die bij deze kaart hoort vastleggen, en daarná een nieuwere.
await stelVast(env, simon, { cyclus: CYCLUS, stand: 4, venster: "open", reden: "Uit het voorstel.", gebeurtenis: barokaart.id });
await stelVast(env, simon, { cyclus: CYCLUS, stand: 5, venster: "pre_analyse", reden: "Toch onrustig." });
await verstuurPublicatie(env, simon, baroBericht);

const gemeld = await q("select id, stand, gepubliceerd_op from barometerstand where cyclus = ? order by id", CYCLUS);
const welGemeld = gemeld.filter((g) => g.gepubliceerd_op);
eis("precies één stand is gemeld", welGemeld.length === 1);
eis("en dat is de stand waar het bericht over ging", welGemeld.length === 1 && welGemeld[0].stand === 4);
const b = await huidig(env, CYCLUS);
eis("wij staan op 5", b.wij.stand.waarde === 5);
eis("de leden op 4", b.leden.stand.waarde === 4);
eis("dus wij en zij staan niet gelijk", b.gelijk === false);

// ---------------------------------------------------------------------- 4
// Het concept dat de spiegel klaarzet kende zijn gebeurtenis niet, waardoor de
// publicatie na het versturen niet aan zijn gebeurtenis te koppelen was en er
// een tweede bericht ontstond.
const contract = { conid: 777, contract: "OESX 6000 PUT", onderliggend: "OESX", strike: 6000,
                   expiratiedatum: "2026-12-18", aantal: -2 };
await spiegel(env, simon, [contract], [], "2026-09-02");
const pos = await een("select id from positie where conid = '777'");
eis("de positie is gespiegeld", !!pos);
const concept = await een("select id, gebeurtenis from publicatie where positie = ? and soort = 'opening'", pos.id);
eis("er staat een concept klaar", !!concept);
eis("en het weet uit welke gebeurtenis het komt", !!concept.gebeurtenis);

await db.prepare("update gebeurtenis set vraagt_antwoord = 1 where id = ?").bind(concept.gebeurtenis).run();
const nogmaals = await conceptUitKaart(env, simon, concept.gebeurtenis, "nieuwe_positie");
eis("de knop maakt geen tweede bericht", nogmaals.publicatie === concept.id);
eis("en zegt dat het al bestond", nogmaals.bestond_al === true);

await db.prepare("update publicatie set tekst = 'Nieuwe positie.' where id = ?").bind(concept.id).run();
await verstuurPublicatie(env, simon, concept.id);
eis("en het bericht staat op verstuurd",
    (await een("select status from publicatie where id = ?", concept.id)).status === "verstuurd");

// ---------------------------------------------------------------------- 5
// De opsteller kon het vierogenprincipe omzeilen: zijn eigen bericht terugsturen
// zette het op 'concept' met de nalezer eraf, en daarna mocht het gewoon weg.
const eigen = await een("select id from publicatie where soort = 'sluiting' or soort = 'opening' order by id desc limit 1");
const tekstje = await db.prepare(
  "insert into publicatie (cyclus, soort, status, titel, tekst, kanaal) values (?, 'vrij', 'concept', 'Proef', 'Iets.', 'leden')"
).bind(CYCLUS).run();
const pid = tekstje.meta.last_row_id;
await vraagNalezen(env, simon, pid, "jacqueline");
let uit = await stuurTerug(env, simon, pid, "Ik doe het zelf wel.");
eis("de opsteller kan zijn eigen bericht niet terugsturen", !!uit.fout);
eis("en het ligt nog steeds bij de nalezer",
    (await een("select status from publicatie where id = ?", pid)).status === "nalezen");
uit = await stuurTerug(env, jacq, pid, "De tweede alinea klopt niet.");
eis("de nalezer kan dat wel", !uit.fout);

// ---------------------------------------------------------------------- 6
// Een bericht ging twee keer de deur uit als er twee keer tegelijk op werd
// gedrukt: de voorwaarde stond in de lezing, niet in de UPDATE.
await vraagNalezen(env, simon, pid, "jacqueline");
await geefVrij(env, jacq, pid);
const [een1, een2] = await Promise.all([
  verstuurPublicatie(env, simon, pid),
  verstuurPublicatie(env, simon, pid),
]);
eis("van twee keer tegelijk versturen slaagt er precies één",
    [een1, een2].filter((r) => !r.fout).length === 1);
eis("er staat één 'verstuurd' in de stroom voor dit bericht",
    (await een("select count(*) n from gebeurtenis where publicatie = ? and soort = 'bericht_verstuurd'", pid)).n === 1);

// ---------------------------------------------------------------------- 8
// Feiten werden afgekapt op 2000 tekens, wat van geldige json bijna altijd
// ongeldige json maakte — en die werd later blind geparseerd. Eén zo'n rij legde
// de hele tijdlijn van een cyclus plat.
await log(env, simon, {
  bron: "mens", soort: "proef_groot", cyclus: CYCLUS, titel: "Veel feiten",
  feiten: { lap: "x".repeat(5000) },
});
const tijdlijn = await stroom(env, CYCLUS, 200);
eis("de tijdlijn is nog te lezen", Array.isArray(tijdlijn) && tijdlijn.length > 0);
const groot = tijdlijn.find((g) => g.soort === "proef_groot");
eis("de grote rij staat erin", !!groot);
eis("en zegt netjes dat de feiten te groot waren", groot && groot.feiten && groot.feiten.te_groot === true);

// Een rij met kapotte json blijft ook leesbaar.
await db.prepare("update gebeurtenis set feiten = '{kapot' where soort = 'proef_groot'").run();
const nogsteeds = await stroom(env, CYCLUS, 200);
eis("één kapotte rij breekt de tijdlijn niet", nogsteeds.length > 0);
eis("die rij toont alleen geen feiten",
    nogsteeds.find((g) => g.soort === "proef_groot").feiten === null);

// ---------------------------------------------------------------------- 9
// Tijdstippen lezen ging mis bij alles wat niet exact 'jjjj-mm-dd uu:mm:ss' was.
eis("een database-tijdstip leest", !!leesMoment("2026-09-01 10:00:00"));
eis("een ISO-tijdstip ook", !!leesMoment("2026-10-01T08:00:00.000Z"));
eis("een kale datum ook", !!leesMoment("2026-10-01"));
eis("leeg geeft niets", leesMoment("") === null);
eis("onzin geeft niets", leesMoment("ergens in oktober") === null);
eis("en de leeftijd van iets ISO is geen NaN",
    urenSinds("2026-10-01T08:00:00.000Z", new Date("2026-10-01T12:00:00Z")) === 4);
eis("een moment in de toekomst geeft geen negatieve leeftijd",
    urenSinds("2099-01-01 00:00:00", new Date("2026-10-01T12:00:00Z")) === 0);

// De sloten op ingerichte SQL, het uitstellen van een kaart, de sleutel per
// openstaande kaart, de prioriteit die niet naar 'laag' mag vallen en het
// weeknummer stonden hier ook. Die hoorden bij de kaartlaag die eruit is; hun
// proeven staan in de git-tak 'voor-de-herbouw' en komen terug zodra de nieuwe
// werkbank er is. De fouten zelf zijn niet vergeten — ze staan in BOUWSPEC.

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
