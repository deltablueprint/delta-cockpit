// De fouten die een review vond, en die niet terug mogen komen.
//
//   node scripts/proef/hersteld.mjs
//
// Elke proef hieronder faalde vóór zijn reparatie. Ze staan bij elkaar omdat ze
// één ding gemeen hebben: het waren alle negen stille fouten. Niets viel om,
// niemand kreeg een melding — de uitkomst was gewoon verkeerd, en bij zes ervan
// zouden de leden het als eerste gemerkt hebben.
import { verseDB, CYCLUS, MOMENT, POSITIE } from "./db.mjs";
import { weeg, meld, tik, voorwaardeDeugt, aanleidingDeugt } from "../../worker/motor.js";
import { wachtrij, beantwoord, prioriteitVan } from "../../worker/wachtrij.js";
import { conceptUitKaart, vraagNalezen, geefVrij, stuurTerug } from "../../worker/bericht.js";
import { verstuurPublicatie, spiegel } from "../../worker/spiegel.js";
import { achterstand } from "../../worker/achterstand.js";
import { stelVast, huidig } from "../../worker/barometer.js";
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

// ---------------------------------------------------------------------- 1
// De sleutel gold voor altijd in plaats van per openstaande kaart. Een barometer
// die van 4 naar 5 en weer terug naar 4 ging, kreeg de tweede keer geen kaart.
const voorstel = (naar) => log(env, simon, {
  bron: "meting", soort: "barometer_voorstel", cyclus: CYCLUS,
  titel: `Barometer naar ${naar}`, feiten: { van: 0, naar },
});
for (const naar of [4, 5]) {
  await voorstel(naar); await weeg(env);
  const k = (await wachtrij(env, simon)).kaarten.find((x) => x.kaartsoort === "barometer");
  await beantwoord(env, simon, k.id, { knop: 2, reden: "Nog even niet." });
}
await voorstel(4);
await weeg(env);
eis("een stand die terugkomt levert opnieuw een kaart",
    (await wachtrij(env, simon)).kaarten.some((x) => x.kaartsoort === "barometer"));

// Maar twee keer dezelfde vraag tegelijk open: nooit.
await voorstel(4); await weeg(env);
eis("en nooit twee keer tegelijk",
    (await wachtrij(env, simon)).kaarten.filter((x) => x.kaartsoort === "barometer").length === 1);
const open = await q(
  `select sleutel, count(*) n from gebeurtenis
    where vraagt_antwoord = 1 and beantwoord_op is null and sleutel is not null
    group by sleutel having n > 1`
);
eis("de unieke index bewaakt alleen openstaande kaarten", open.length === 0);

// ---------------------------------------------------------------------- 2
// De go/no-go-sleutel had het beoordelingsmoment niet, dus maar één moment
// kreeg kaarten, en na één ronde beantwoorden nooit meer iemand.
await db.prepare("update beoordelingsmoment set status = 'blind inzenden' where id = ?").bind(MOMENT).run();
await db.prepare("insert into beoordelingsmoment (id, cyclus, datum, status) values (99, ?, '2026-10-01', 'blind inzenden')").bind(CYCLUS).run();
await meld(env);
const gonogo = await q("select sleutel, beoordelingsmoment from gebeurtenis where soort = 'gonogo_open'");
const deelnemers = (await een("select count(*) n from gebruiker where actief = 1")).n;
eis(`elk moment krijgt zijn eigen kaarten (${gonogo.length} van ${deelnemers * 2})`,
    gonogo.length === deelnemers * 2);
eis("en beide momenten komen voor",
    new Set(gonogo.map((g) => g.beoordelingsmoment)).size === 2);

// ---------------------------------------------------------------------- 3
// Een barometerbericht zette het stempel 'bij de leden' op de nieuwste stand in
// plaats van op de stand waar het bericht over ging.
await stelVast(env, simon, { cyclus: CYCLUS, stand: 3, venster: "open", reden: "Rustig." });
const barokaart = (await wachtrij(env, simon)).kaarten.find((x) => x.kaartsoort === "barometer");
const baroBericht = (await conceptUitKaart(env, simon, barokaart.id)).publicatie;
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
// achterstand na het versturen bleef hangen en er een tweede bericht ontstond.
const contract = { conid: 777, contract: "OESX 6000 PUT", onderliggend: "OESX", strike: 6000,
                   expiratiedatum: "2026-12-18", aantal: -2 };
await spiegel(env, simon, [contract], [], "2026-09-02");
const pos = await een("select id from positie where conid = '777'");
eis("de positie is gespiegeld", !!pos);
const concept = await een("select id, gebeurtenis from publicatie where positie = ? and soort = 'opening'", pos.id);
eis("er staat een concept klaar", !!concept);
eis("en het weet uit welke gebeurtenis het komt", !!concept.gebeurtenis);

await weeg(env);
const openkaart = (await wachtrij(env, simon)).kaarten.find((k) => k.positie === pos.id);
eis("er is een kaart voor die positie", !!openkaart);
const nogmaals = await conceptUitKaart(env, simon, openkaart.id);
eis("de knop maakt geen tweede bericht", nogmaals.publicatie === concept.id);
eis("en zegt dat het al bestond", nogmaals.bestond_al === true);

await db.prepare("update publicatie set tekst = 'Nieuwe positie.' where id = ?").bind(concept.id).run();
await verstuurPublicatie(env, simon, concept.id);
eis("het versturen sluit de kaart",
    !!(await een("select beantwoord_op from gebeurtenis where id = ?", openkaart.id)).beantwoord_op);
const na = await achterstand(env, { cyclus: CYCLUS, nu: "2026-09-03T12:00:00Z" });
eis("en de achterstand telt deze positie niet meer",
    !na.posten.some((p) => p.gebeurtenis === openkaart.id));

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

// ---------------------------------------------------------------------- 7
// Uitstellen met onzin als datum liet een kaart voorgoed verdwijnen uit de rij,
// zonder dat hij beantwoord was.
await db.prepare("update processtap set prullenbak_doel = 'uitstellen' where kaartsoort = 'week_update'").run();
await log(env, simon, {
  bron: "klok", soort: "week_verstreken", cyclus: CYCLUS,
  titel: "Een week zonder bericht", feiten: { week: "2026-40" },
});
await weeg(env);
const weekkaart = (await wachtrij(env, simon)).kaarten.find((k) => k.kaartsoort === "week_update");
eis("de week-kaart staat er", !!weekkaart);
if (weekkaart) {
  await beantwoord(env, simon, weekkaart.id, { doel: "uitstellen", tot: "nooit" });
  const gezet = await een("select wachten_tot, beantwoord_op from gebeurtenis where id = ?", weekkaart.id);
  eis("onzin als datum wordt niet opgeslagen", /^\d{4}-\d{2}-\d{2} /.test(String(gezet.wachten_tot || "")));
  eis("en hij komt gewoon morgen terug",
      (await wachtrij(env, simon, { nu: "2099-01-01T12:00:00Z" })).kaarten.some((k) => k.id === weekkaart.id));
}

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

// De prioriteit van een verkeerd ingerichte kaart valt niet naar 'laag'.
eis("een onbekende prioriteit wordt medium, niet laag",
    prioriteitVan({ prioriteit: "kritiek" }, 0).prioriteit === "medium");
eis("en wordt als onbekend gemeld", prioriteitVan({ prioriteit: "kritiek" }, 0).onbekend === true);
eis("geen valse opschaling",
    prioriteitVan({ prioriteit: "kritiek", opschalen_naar: "hoog", opschalen_na_uur: 1 }, 99).opgeschaald === true);
eis("hoog blijft hoog en is niet opgeschaald",
    prioriteitVan({ prioriteit: "hoog", opschalen_naar: "hoog", opschalen_na_uur: 1 }, 99).opgeschaald === false);

// --------------------------------------------------------------------- 10
// De sloten op ingerichte SQL.
eis("een voorwaarde zonder 'soort' mag niet", !voorwaardeDeugt("1 = 1"));
eis("een voorwaarde met 'soort' mag wel", voorwaardeDeugt("soort = 'positie_geopend'"));
eis("een aanleiding mag geen wachtwoorden lezen",
    !aanleidingDeugt("select wachtwoord_hash as titel, id as sleuteldeel from gebruiker"));
eis("en geen select *", !aanleidingDeugt("select * from gebruiker"));
eis("maar de deelnemerslijst mag wel",
    aanleidingDeugt("select g.id as sleuteldeel, g.naam as titel from gebruiker g where g.actief = 1"));

// --------------------------------------------------------------------- 11
// Het weeknummer klopte in tien van de dertien jaren geen enkele dag.
const weken = await import("../../worker/motor.js");
// week() is niet geëxporteerd; we meten hem via de klok, die hem in de feiten zet.
await db.prepare("update cyclus set geopend_op = '2025-12-22' where id = ?").bind(CYCLUS).run();
await db.prepare("delete from gebeurtenis where soort = 'week_verstreken'").run().catch(() => null);
await tik(env, { nu: "2025-12-29T06:00:00Z" });
const slag = await een("select feiten from gebeurtenis where soort = 'week_verstreken' order by id desc limit 1");
if (slag) {
  const f = JSON.parse(slag.feiten);
  eis(`29 december 2025 valt in week 2026-01 (gekregen: ${f.week})`, f.week === "2026-01");
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
