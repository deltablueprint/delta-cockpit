// De werkbank zegt wat er is, en niet meer dan dat.
//
//   node scripts/proef/werkbank.mjs
//
// Drie dingen kunnen hier stilletjes misgaan, en alle drie liegen ze op een
// scherm waar iemand een bericht aan 412 leden op baseert:
//   - de barometer meet op een koers die te oud is, of op geen koers,
//   - de zwakste positie bepaalt de stand niet,
//   - een kaart blijft staan nadat het bericht weg is, of verdwijnt terwijl
//     het nog niet weg is.
import { verseDB, CYCLUS, MOMENT, POSITIE } from "./db.mjs";
import { werkbank, publiceer, nietMelden, kaarten, conceptVoorKaart } from "../../worker/werkbank.js";
import { metingen, standVan, plekVan, ijkpunten, drempels, VAKKEN } from "../../worker/meting.js";
import { stelVast, huidig } from "../../worker/barometer.js";
import { conceptUitKaart } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-werkbank-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;
const een = async (s, ...b) => await db.prepare(s).bind(...b).first();

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// De positie uit db.mjs staat op strike 5600 met 38,5 premie. We hangen er een
// brokerregel aan, want daar komen de ask en de onderliggende vandaan.
await db.prepare(
  `insert into brokerpositie (conid, contract, onderliggend, strike, expiratiedatum,
                              aantal, marktprijs, biedprijs, laatprijs, gewijzigd_op)
   values ('5001', 'OESX 30OKT26 5600 PUT', 'OESX', 5600, '2026-10-30', -4, 21.0, 20.2, 21.0,
           '2026-10-19 11:55:00')`
).run();

// ------------------------------------------------------------- de ijkpunten
//
// Alle grenzen zijn ask-niveaus: dat is de prijs waartegen je er werkelijk uit
// komt, en het getal waar de regels tegen toetsen. De stoploss is een vast
// niveau uit de standaardset — géén veelvoud van de premie.
let d = await drempels(env);
eis("de stoploss staat op ask 60", d.grenzen[1].waarde === 60 && d.grenzen[1].eenheid === "punten");
eis("de waarschuwing op ask 50", d.grenzen[2].waarde === 50 && d.grenzen[2].eenheid === "punten");
eis("break-even ligt vast op de premie",
    d.grenzen[3].waarde === 100 && d.grenzen[3].eenheid === "pct_premie");
eis("het winstanker op 30 % van de premie open",
    d.grenzen[5].waarde === 30 && d.grenzen[5].eenheid === "pct_premie");

// Het voorbeeld uit BOUWSPEC §10.1: premie 18,0 → break-even ask 18,0,
// winstanker 70 % → ask 5,4.
let ijk = ijkpunten(18, 60, d);
eis("break-even is de ask gelijk aan wat je ontving", ijk.breakeven === 18);
eis("het winstanker is de ask op 30 % van de premie", Math.abs(ijk.winstanker - 5.4) < 0.001);
eis("de helft binnen is de ask op de helft van de premie", ijk.helft === 9);
eis("de stoploss komt van de positie", ijk.stoploss === 60);
eis("de waarschuwing ligt ervoor", ijk.waarschuwing === 50);
eis("zonder premie zijn er geen ijkpunten", ijkpunten(null, 60, d) === null && ijkpunten(0, 60, d) === null);

// Een aangescherpte stoploss telt, en de waarschuwing kan er nooit boven liggen.
const scherp = ijkpunten(18, 40, d);
eis("een aangescherpte stoploss telt", scherp.stoploss === 40);
eis("en de waarschuwing blijft eronder", scherp.waarschuwing <= scherp.stoploss);

// Een premie boven het vaste waarschuwingsniveau. Dan valt ask 50 buiten het
// bereik tussen stoploss en break-even, en moet de balk zijn volgorde houden.
const hoog = ijkpunten(55, 60, d);
eis("bij een hoge premie blijft de volgorde kloppen",
    hoog.stoploss > hoog.waarschuwing && hoog.waarschuwing > hoog.breakeven
    && hoog.breakeven > hoog.helft && hoog.helft > hoog.winstanker);

// ---------------------------------------------------- de plek op de balk
//
// Van verlies links naar winst rechts. De ask daalt dus naar rechts, en
// break-even staat in het midden.
eis("break-even staat in het midden", plekVan(18, ijk) === 50);
eis("de stoploss staat op de grens van het smalle stuk", plekVan(60, ijk) === 8);
eis("de waarschuwing erna", plekVan(50, ijk) === 26);
eis("de helft binnen", plekVan(9, ijk) === 68);
eis("het winstanker", plekVan(5.4, ijk) === 84);
eis("waardeloos is helemaal rechts", plekVan(0, ijk) === 100);
eis("voorbij de stoploss staat links", plekVan(90, ijk) < 8);
eis("en hoe ver eroverheen maakt niet uit — het is één smal stuk",
    plekVan(90, ijk) === plekVan(500, ijk));
eis("tussen twee ijkpunten wordt lineair geïnterpoleerd",
    Math.abs(plekVan(55, ijk) - 17) < 0.001);
eis("zonder ask is er geen plek", plekVan(null, ijk) === null);
eis("en zonder ijkpunten ook niet", plekVan(21, null) === null);

// De zes vakken staan op vaste plekken, zodat twee tranches met verschillende
// premies dezelfde zonebreedtes tonen.
eis("er zijn zes vakken", VAKKEN.length === 6);
eis("ze sluiten op elkaar aan", VAKKEN.every((v, i) => i === 0 ? v.van === 0 : v.van === VAKKEN[i - 1].tot));
eis("en lopen van 0 tot 100", VAKKEN[0].van === 0 && VAKKEN[5].tot === 100);
const ander = ijkpunten(40, 60, d);
eis("een andere premie geeft dezelfde zonebreedtes", plekVan(40, ander) === plekVan(18, ijk));

// ----------------------------------------------------------- de stand
eis("voorbij de stoploss is het de zwaarste stand", standVan(90, ijk) === 1);
eis("op de stoploss ook", standVan(60, ijk) === 1);
eis("tussen stoploss en waarschuwing: onder druk", standVan(55, ijk) === 1);
eis("tussen waarschuwing en break-even: krap", standVan(30, ijk) === 2);
eis("net onder break-even: aandacht", standVan(14, ijk) === 3);
eis("voorbij de helft: comfortabel", standVan(7, ijk) === 4);
eis("voorbij het winstanker: veilig", standVan(2, ijk) === 5);
eis("waardeloos ook", standVan(0, ijk) === 5);
eis("zonder ask is er geen stand", standVan(null, ijk) === null);
eis("en onzin ook niet", standVan(NaN, ijk) === null && standVan(-1, ijk) === null);

// De stand ís de zone waarin de markering staat. Eén som, geen apart rekenwerk.
for (const ask of [0, 1, 5.4, 9, 14, 18, 30, 50, 60, 75]) {
  const plek = plekVan(ask, ijk);
  const vak = VAKKEN.find((v) => plek >= v.van && (plek < v.tot || v.tot === 100));
  eis(`ask ${ask}: de stand is de zone waarin de markering staat`,
      standVan(ask, ijk) === (vak.stand === 0 ? 1 : vak.stand));
}

// Grenzen die door elkaar lopen zijn een inrichtingsfout. Ook dan hoort er een
// bruikbare meter uit te komen.
await db.prepare("update barometerdrempel set grens_waarde = 70 where stand = 2").run();
d = await drempels(env);
ijk = ijkpunten(38.5, 60, d);
eis("een waarschuwing boven de stoploss valt terug op het midden",
    ijk.waarschuwing > ijk.breakeven && ijk.waarschuwing < ijk.stoploss);
await db.prepare("update barometerdrempel set grens_waarde = 50 where stand = 2").run();

await db.prepare("update barometerdrempel set grens_waarde = -3 where stand = 5").run();
d = await drempels(env);
eis("onzin in het winstanker valt terug op de standaard",
    d.grenzen[5].waarde === 30 && d.grenzen_rechtgezet === true);
await db.prepare("update barometerdrempel set grens_waarde = 30 where stand = 5").run();

// Break-even is geen instelling. Zet iemand hem toch, dan telt hij niet mee.
await db.prepare("update barometerdrempel set grens_waarde = 80 where stand = 3").run();
d = await drempels(env);
eis("break-even blijft de premie, wat er ook in de tabel staat", d.grenzen[3].waarde === 100);
await db.prepare("update barometerdrempel set grens_waarde = 100 where stand = 3").run();

// ------------------------------------------------------------- de meting
//
// De positie uit db.mjs: premie 38,5, stoploss 60 (de standaard), ask 21.
// 21 van 60 is 35 % van de weg naar de stoploss — precies op de grens, en die
// telt mee naar beneden: comfortabel.
let meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
const p1 = meet.posities[0];
eis("de ask komt van de laatprijs", p1.ask === 21 && p1.ask_is_marktprijs === false);
eis("het bod staat erbij", p1.bod === 20.2);
eis("de plek op de balk wordt gemeten", Math.abs(p1.plek - 66.4) < 0.1);
eis("en levert een stand op", p1.stand === 3);
eis("het open resultaat is premie min ask", p1.resultaat === 17.5);
eis("break-even is de ask gelijk aan de premie", p1.breakeven === 38.5);
eis("de stoploss staat er met wat er nog te gaan is", p1.tot_stoploss === 39);
eis("er staat hoeveel van de premie binnen is", Math.abs(p1.binnen - 45.45) < 0.01);
eis("de dagen tot expiratie kloppen", p1.dagen === 11);
eis("het systeem stelt die stand voor", meet.voorstel === 3);
eis("en zegt welke positie dat bepaalt", meet.zwakste.id === POSITIE);
eis("de strike doet niet mee aan de meting", p1.plek === meet.zwakste.plek);

// Een ask die tegen de stoploss aan ligt is de zwaarste stand.
await db.prepare("update brokerpositie set laatprijs = 60 where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("op de stoploss is het de zwaarste stand", meet.posities[0].stand === 1);
eis("maar nog niet voorbij de grens", meet.posities[0].voorbij_de_grens === false);
await db.prepare("update brokerpositie set laatprijs = 70 where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("eroverheen ook", meet.posities[0].stand === 1);
eis("en dan staat het er apart bij", meet.posities[0].voorbij_de_grens === true);
await db.prepare("update brokerpositie set laatprijs = 0.1 where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("bijna waardeloos is veilig", meet.posities[0].stand === 5);
await db.prepare("update brokerpositie set laatprijs = 21.0 where conid = '5001'").run();

// Een stoploss die per positie anders staat, verandert de schaal mee.
await db.prepare("update positie set stoploss_ask = 45 where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("een aangescherpte stoploss verschuift de ijkpunten", meet.posities[0].stoploss === 45);
eis("maar de stand verandert niet, want die hangt aan break-even",
    meet.posities[0].stand === 3);
await db.prepare("update positie set stoploss_ask = 60 where conid = '5001'").run();

// Een stoploss ónder break-even is geen stoploss maar een winstdoel. Deze balk
// kan dat niet tonen, en dan tekent hij liever niets.
await db.prepare("update positie set stoploss_ask = 20 where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("een stoploss onder break-even is niet te tekenen", meet.posities[0].stand === null);
await db.prepare("update positie set stoploss_ask = 60 where conid = '5001'").run();

// Zonder premie is er geen break-even en dus geen schaal.
await db.prepare("update positie set ontvangen_premie_pt = 0 where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("zonder premie wordt er niet gemeten", meet.posities[0].stand === null);
eis("en het scherm krijgt te horen waarom",
    meet.waarom_niet === "het exitplan is niet te lezen: geen premie, of een stoploss onder break-even");
await db.prepare("update positie set ontvangen_premie_pt = 38.5 where conid = '5001'").run();

// Zonder laatprijs valt hij terug op de marktprijs, en zegt dat erbij.
await db.prepare("update brokerpositie set laatprijs = null where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("zonder laatprijs is de marktprijs de ask", meet.posities[0].ask === 21);
eis("en dat staat erbij", meet.posities[0].ask_is_marktprijs === true);
await db.prepare("update brokerpositie set laatprijs = 21.0 where conid = '5001'").run();

// Zonder enige prijs valt er niets te meten.
await db.prepare("update brokerpositie set laatprijs = null, marktprijs = null where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("zonder prijs is er geen stand", meet.posities[0].stand === null);
eis("en ook dat wordt gezegd", meet.waarom_niet === "geen prijs van de broker");
await db.prepare("update brokerpositie set laatprijs = 21.0, marktprijs = 21.0 where conid = '5001'").run();

// Een prijs van gisteren is erger dan geen prijs: hij ziet er even stellig uit.
await db.prepare("update brokerpositie set gewijzigd_op = '2026-10-18 12:00:00' where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("een oude prijs telt niet mee", meet.posities[0].stand === null);
eis("en dat wordt gezegd", meet.waarom_niet === "de prijs is te oud");
eis("het scherm weet hoe oud", meet.posities[0].prijs_minuten_oud > 1000);
for (const [wat, moment] of [["onleesbaar", "ergens vanmorgen"], ["uit de toekomst", "2027-01-01 12:00:00"]]) {
  await db.prepare("update brokerpositie set gewijzigd_op = ? where conid = '5001'").bind(moment).run();
  const m2 = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
  eis(`een prijstijdstip ${wat} telt niet als vers`, m2.posities[0].stand === null);
}
await db.prepare("update brokerpositie set gewijzigd_op = '2026-10-19 11:55:00' where conid = '5001'").run();

// ------------------------------------------------- de zwakste bepaalt de stand
// Een tweede tranche die bijna waardeloos staat mag de meter niet zachter maken.
await db.prepare(
  `insert into positie (cyclus, beoordelingsmoment, tranche, status, contract, strike,
                        expiratiedatum, aantal, ontvangen_premie_pt, conid, herkomst)
   values (?, ?, 2, 'bewaken', 'OESX 30OKT26 5200 PUT', 5200, '2026-10-30', 1, 11.0, '5002', 'broker')`
).bind(CYCLUS, MOMENT).run();
await db.prepare(
  `insert into brokerpositie (conid, contract, onderliggend, strike, expiratiedatum, aantal,
                              laatprijs, biedprijs, gewijzigd_op)
   values ('5002', 'OESX 30OKT26 5200 PUT', 'OESX', 5200, '2026-10-30', -1, 1.5, 1.1, '2026-10-19 11:55:00')`
).run();

meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
const rustig = meet.posities.find((p) => p.strike === 5200);
eis("de tweede tranche staat veilig", rustig.stand === 5);
eis("maar de zwakste bepaalt de barometer", meet.voorstel === 3 && meet.zwakste.id === POSITIE);

// En een positie die dicht is telt niet mee.
await db.prepare("update positie set status = 'gesloten', uitkomst = 'waardeloos geexpireerd' where conid = '5001'").run();
meet = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("een gesloten positie telt niet mee", meet.voorstel === 5);
eis("en krijgt zelf geen stand", meet.posities.find((p) => p.strike === 5600).stand === null);
await db.prepare("update positie set status = 'bewaken', uitkomst = null where conid = '5001'").run();

// --------------------------------------------------- de barometer slaapt
await stelVast(env, ik, { cyclus: CYCLUS, stand: 1, venster: "besluit", reden: "We kijken." });
let w = await werkbank(env, ik, { cyclus: CYCLUS, nu: "2026-10-19T12:00:00Z" });
eis("voor we erin zitten slaapt de barometer", w.barometer.wakker === false);
eis("en wordt er niets voorgesteld", w.barometer.voorstel === null);
eis("het scherm weet waarom hij slaapt", w.barometer.slaapt_waarom === "wij zitten er nog niet in");

let uit = await publiceer(env, ik, { cyclus: CYCLUS, stand: 3, reden: "Ruim." });
eis("een slapende barometer kan niet gezet worden", !!uit.fout);

uit = await publiceer(env, ik, { cyclus: CYCLUS, venster: "in_positie", reden: "Wij zitten erin." });
eis("het venster verzetten lukt", !uit.fout);

w = await werkbank(env, ik, { cyclus: CYCLUS, nu: "2026-10-19T12:00:00Z" });
eis("nu is de barometer wakker", w.barometer.wakker === true);
eis("en stelt het systeem de stand van de zwakste voor", w.barometer.voorstel === 3);
eis("de werkbank zegt dat er iets op de leden wacht", w.wacht.voorstel === true);

// Allebei tegelijk kan ook, en dat is één bericht in plaats van twee.
uit = await publiceer(env, ik, { cyclus: CYCLUS, stand: 3, venster: "in_positie", reden: "De positie loopt goed." });
eis("stand en venster in één keer lukt", !uit.fout);
const na = await huidig(env, CYCLUS);
eis("de stand staat waar we hem zetten", Number(na.wij.stand.waarde) === 3);
eis("en draagt zijn reden", na.wij.reden === "De positie loopt goed.");
eis("zonder reden gaat er niets vast", !!(await publiceer(env, ik, { cyclus: CYCLUS, stand: 3, reden: "  " })).fout);
eis("en niets kiezen ook niet", !!(await publiceer(env, ik, { cyclus: CYCLUS, reden: "x" })).fout);

// Een positie zonder ingevulde premie levert geen verzonnen break-even op. Dat
// is precies de stand waarin spiegel.js een tranche aanmaakt waarvan de prijs
// nog niet binnen is.
await db.prepare("update positie set ontvangen_premie_pt = null where conid = '5001'").run();
let m = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
let zonder = m.posities.find((p) => p.strike === 5600);
eis("zonder premie is er geen premie", zonder.premie === null);
eis("en geen break-even", zonder.breakeven === null);
eis("en geen open resultaat", zonder.resultaat === null);
eis("en dus ook geen stand", zonder.stand === null);
await db.prepare("update positie set ontvangen_premie_pt = 38.5 where conid = '5001'").run();

// Een tranche die nog niet uitgevoerd is draagt de strike van het bésluit en
// staat niet in de markt. Die mag de barometer niet bepalen.
for (const stand of ["besluit goedgekeurd", "exitplan vastgelegd", "order bij lynx", "uitvoering ophalen"]) {
  await db.prepare("update positie set status = ? where conid = '5001'").bind(stand).run();
  m = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
  eis(`een positie in '${stand}' telt niet mee`, m.voorstel === 5);
}
await db.prepare("update positie set status = 'bewaken' where conid = '5001'").run();

await db.prepare("update positie set aantal = 0 where conid = '5001'").run();
m = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("een positie zonder contracten telt niet mee", m.voorstel === 5);
await db.prepare("update positie set aantal = 4 where conid = '5001'").run();

// Een gesloten positie toont wat hij opleverde, ook als de brokerregel weg is.
await db.prepare(
  "update positie set status = 'gesloten', uitkomst = 'waardeloos geexpireerd', resultaat_pt = 38.5 where conid = '5001'"
).run();
await db.prepare("delete from brokerpositie where conid = '5001'").run();
m = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
zonder = m.posities.find((p) => p.strike === 5600);
eis("een afgeronde positie toont zijn resultaat", zonder.resultaat === 38.5);
await db.prepare("update positie set status = 'bewaken', uitkomst = null, resultaat_pt = null where conid = '5001'").run();
await db.prepare(
  `insert into brokerpositie (conid, contract, onderliggend, strike, expiratiedatum,
                              aantal, marktprijs, biedprijs, laatprijs, gewijzigd_op)
   values ('5001', 'OESX 30OKT26 5600 PUT', 'OESX', 5600, '2026-10-30', -4, 21.0, 20.2, 21.0,
           '2026-10-19 11:55:00')`
).run();

// ------------------------------------------------------------- de kaarten
const geopend = await log(env, ik, {
  bron: "ibkr", soort: "positie_geopend", cyclus: CYCLUS, positie: POSITIE,
  titel: "Nieuwe positie bij de broker", moment: "2026-10-19 09:00:00",
});
let lijst = await kaarten(env, CYCLUS);
eis("een geopende positie geeft een kaart", lijst.length === 1 && lijst[0].soort === "positie_geopend");
eis("de kaart wijst het sjabloon aan", lijst[0].sjabloon === "nieuwe_positie");

// Het bericht versturen sluit de kaart. Niet een vlag die bijgewerkt wordt — de
// kaart is een vraag over de stroom, en die vraag heeft nu een ander antwoord.
const concept = await conceptUitKaart(env, ik, geopend, "nieuwe_positie");
eis("er komt een concept uit", !!concept.publicatie);
lijst = await kaarten(env, CYCLUS);
eis("zolang het concept niet weg is, blijft de kaart staan", lijst.length === 1);
await db.prepare("update publicatie set tekst = 'Nieuwe positie.' where id = ?").bind(concept.publicatie).run();
await verstuurPublicatie(env, ik, concept.publicatie);
lijst = await kaarten(env, CYCLUS);
eis("na het versturen is de kaart weg", lijst.length === 0);

// Niet melden is een besluit, geen wegklikken.
const gesloten = await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS, positie: POSITIE,
  titel: "Tranche verdwenen bij de broker", moment: "2026-10-19 10:00:00",
});
eis("er staat weer een kaart", (await kaarten(env, CYCLUS)).length === 1);
eis("niet melden zonder reden kan niet", !!(await nietMelden(env, ik, gesloten, "")).fout);
eis("met een reden wel", !(await nietMelden(env, ik, gesloten, "Dit is dezelfde tranche als gisteren.")).fout);
eis("en dan is de kaart weg", (await kaarten(env, CYCLUS)).length === 0);
eis("twee keer kan niet", !!(await nietMelden(env, ik, gesloten, "nog eens")).fout);
const dicht = await een("select antwoord, detail, beantwoord_door from gebeurtenis where id = ?", gesloten);
eis("de reden staat op de gebeurtenis", dicht.antwoord === "niet melden" && !!dicht.detail);
eis("en wie het besloot", dicht.beantwoord_door === "simon");

// ---------------------------------------------------------------- doorrol
// Sluiten en kort erna openen is één handeling. Er komt geen kaart bij; de
// kaart van de sluiting verandert van vorm.
const uitRol = await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS, positie: POSITIE,
  titel: "Positie gesloten", moment: "2026-10-20 14:02:00",
});
const inRol = await log(env, ik, {
  bron: "ibkr", soort: "positie_geopend", cyclus: CYCLUS, positie: POSITIE,
  titel: "Positie geopend", moment: "2026-10-20 14:08:00",
});
lijst = await kaarten(env, CYCLUS);
eis("sluiten en openen vlak erna is één doorrol", lijst.length === 1 && lijst[0].soort === "doorrol");
eis("de kaart zegt wat hij eerst was", /gesloten/i.test(lijst[0].was || ""));
eis("en laadt het doorrolsjabloon", lijst[0].sjabloon === "doorrol");
eis("met beide kanten erin", !!lijst[0].rol && !!lijst[0].rol.uit.contract && !!lijst[0].rol.in.contract);
eis("en het netto resultaat van de beweging", typeof lijst[0].rol.netto === "string");

// Het doorrolbericht dekt beide kanten. Zonder dat kwam de opening terug als
// losse kaart zodra het bericht weg was, en vroeg de werkbank om een tweede
// bericht over dezelfde handeling — bij 412 leden het ergste wat dit scherm kan
// doen.
const rolConcept = await conceptVoorKaart(env, ik, lijst[0].id);
eis("de doorrolkaart levert een bericht op", !!rolConcept.publicatie);
const rolBericht = await een("select soort, tekst from publicatie where id = ?", rolConcept.publicatie);
eis("en dat is het doorrolsjabloon, niet dat van de sluiting", rolBericht.soort === "doorrol");
await db.prepare("update publicatie set tekst = 'We rolden door.' where id = ?").bind(rolConcept.publicatie).run();
await verstuurPublicatie(env, ik, rolConcept.publicatie);
eis("na het versturen staat er niets meer open", (await kaarten(env, CYCLUS)).length === 0);
eis("de tweede kant is meegegaan",
    (await een("select antwoord from gebeurtenis where id = ?", inRol)).antwoord === "meegegaan in de doorrol");

// Terugdraaien voor de volgende toets.
await db.prepare("update gebeurtenis set beantwoord_op = null, antwoord = null where id in (?, ?)").bind(uitRol, inRol).run();
await db.prepare("update publicatie set archief = 1 where gebeurtenis in (?, ?)").bind(uitRol, inRol).run();

// Drie gebeurtenissen vlak na elkaar: de dichtstbijzijnde hoort bij elkaar, niet
// de eerste in de lijst.
const dichtA = await log(env, ik, { bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS,
  positie: POSITIE, titel: "A dicht", moment: "2026-10-22 13:00:00" });
const dichtB = await log(env, ik, { bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS,
  positie: POSITIE, titel: "B dicht", moment: "2026-10-22 13:20:00" });
await log(env, ik, { bron: "ibkr", soort: "positie_geopend", cyclus: CYCLUS,
  positie: POSITIE, titel: "C open", moment: "2026-10-22 13:30:00" });
let drie = (await kaarten(env, CYCLUS)).filter((k) => String(k.moment).startsWith("2026-10-22"));
eis("drie gebeurtenissen geven twee kaarten", drie.length === 2);
const rol = drie.find((k) => k.soort === "doorrol");
eis("er is er één een doorrol", !!rol);
eis("en die hoort bij de sluiting die er het dichtst bij ligt", rol && rol.ids[0] === dichtB);
eis("de andere sluiting blijft een losse kaart",
    drie.some((k) => k.id === dichtA && k.soort === "positie_gesloten"));
await db.prepare("delete from gebeurtenis where moment like '2026-10-22%'").run();

// Een waardeloze expiratie krijgt van de spiegel alleen een datum mee, zonder
// tijd. Dan is het 00:00 en zou een doorrol later op die dag nooit binnen een
// uur vallen — precies het normale maandelijkse geval.
await db.prepare("update gebeurtenis set moment = '2026-10-23' where id = ?").bind(uitRol).run();
await db.prepare("update gebeurtenis set moment = '2026-10-23 14:08:00' where id = ?").bind(inRol).run();
lijst = await kaarten(env, CYCLUS);
eis("een doorrol na expiratie wordt ook herkend", lijst.length === 1 && lijst[0].soort === "doorrol");
await db.prepare("update gebeurtenis set moment = '2026-10-20 14:02:00' where id = ?").bind(uitRol).run();
await db.prepare("update gebeurtenis set moment = '2026-10-20 14:08:00' where id = ?").bind(inRol).run();

// Niet melden neemt de tweede kant mee.
await nietMelden(env, ik, uitRol, "Dit gaat niet naar de leden.");
eis("niet melden sluit de hele doorrol", (await kaarten(env, CYCLUS)).length === 0);
eis("ook de tweede kant",
    !!(await een("select beantwoord_op from gebeurtenis where id = ?", inRol)).beantwoord_op);
await db.prepare("update gebeurtenis set beantwoord_op = null, antwoord = null where id in (?, ?)").bind(uitRol, inRol).run();

// Een gewone gebeurtenis is geen kaart. Zonder deze grens kon elke regel uit de
// stroom een bericht aan de leden worden, met het verkeerde sjabloon erbij.
const gewoon = await log(env, ik, { bron: "meting", soort: "barometer_voorstel", cyclus: CYCLUS,
  titel: "Een voorstel", moment: "2026-10-20 15:00:00" });
eis("een gewone gebeurtenis levert geen bericht op", !!(await conceptVoorKaart(env, ik, gewoon)).fout);
eis("en kan ook niet op 'niet melden'", !!(await nietMelden(env, ik, gewoon, "omdat het kan")).fout);

// Een resultaat dat nog niet bekend is, is geen nul. Op een kaart leest 0,0 als
// 'gesloten op break-even', en dat gaat zo het bericht aan de leden in.
{
  const open2 = await log(env, ik, { bron: "ibkr", soort: "positie_geopend", cyclus: CYCLUS,
    positie: POSITIE, titel: "Zonder cijfers", moment: "2026-10-25 09:00:00" });
  await db.prepare("update positie set resultaat_pt = null, aantal = null where id = ?").bind(POSITIE).run();
  const k = (await kaarten(env, CYCLUS)).find((x) => x.id === open2);
  const feit = (naam) => (k.feiten.find(([l]) => l === naam) || [])[1];
  eis("een onbekende inzet is een streepje, geen nul", feit("Inzet") === "\u2014");
  await db.prepare("update positie set aantal = 4 where id = ?").bind(POSITIE).run();
  await db.prepare("delete from gebeurtenis where id = ?").bind(open2).run();
}

// Ver uit elkaar is het geen doorrol maar twee losse dingen.
await db.prepare("update gebeurtenis set moment = '2026-10-21 09:00:00' where id = ?").bind(inRol).run();
lijst = await kaarten(env, CYCLUS);
eis("een dag later is het geen doorrol", lijst.length === 2 && !lijst.some((x) => x.soort === "doorrol"));

// De grens staat in beheer.
await db.prepare("update instelling set waarde = '2000' where sleutel = 'doorrol_minuten'").run();
lijst = await kaarten(env, CYCLUS);
eis("met een ruimere grens wel", lijst.length === 1 && lijst[0].soort === "doorrol");
await db.prepare("update instelling set waarde = '60' where sleutel = 'doorrol_minuten'").run();

// ------------------------------------- een voorstel op de halve portefeuille
// Twee onderliggenden, één zonder koers: het voorstel is dan waar maar niet
// volledig, en dat ziet er precies hetzelfde uit als een voorstel dat alles
// meeweegt. Dus moet het scherm het horen.
await db.prepare(
  `insert into positie (cyclus, beoordelingsmoment, tranche, status, contract, strike,
                        expiratiedatum, aantal, ontvangen_premie_pt, conid, herkomst)
   values (?, ?, 3, 'bewaken', 'DAX 30OKT26 20000 PUT', 20000, '2026-10-30', 1, 40.0, '5003', 'broker')`
).bind(CYCLUS, MOMENT).run();
await db.prepare(
  `insert into brokerpositie (conid, contract, onderliggend, strike, expiratiedatum, aantal, laatprijs)
   values ('5003', 'DAX 30OKT26 20000 PUT', 'DAX', 20000, '2026-10-30', -1, 12.0)`
).run();
m = await metingen(env, CYCLUS, { nu: "2026-10-19T12:00:00Z" });
eis("er wordt nog steeds een stand voorgesteld", m.voorstel !== null);
eis("maar de ongemeten positie wordt genoemd",
    m.ongemeten.length === 1 && /DAX/.test(m.ongemeten[0].contract));
await db.prepare("delete from positie where conid = '5003'").run();
await db.prepare("delete from brokerpositie where conid = '5003'").run();

// Een stand die geen getal is mag er niet in. Een cliënt die {"stand": true}
// stuurt zou de barometer anders op 1 zetten zonder dat iemand iets merkt.
for (const raar of [true, [4], {}, "", "vier", null]) {
  const r = await publiceer(env, ik, { cyclus: CYCLUS, stand: typeof raar === "number" ? raar : null, reden: "x" });
  eis(`stand ${JSON.stringify(raar)} wordt niet als getal doorgelaten`, !!r.fout);
}
for (const buiten of [0, 6, 4.5, -1]) {
  eis(`stand ${buiten} ligt buiten de schaal`,
      !!(await publiceer(env, ik, { cyclus: CYCLUS, stand: buiten, reden: "x" })).fout);
}

// ------------------------------------------------------------ het hele beeld
w = await werkbank(env, ik, { cyclus: CYCLUS, nu: "2026-10-21T12:00:00Z" });
eis("de werkbank kent de lopende cycli", w.cycli.length >= 1);
eis("en opent op een cyclus", w.cyclus && w.cyclus.id === CYCLUS);
eis("met de posities erbij", w.posities.length === 2);
eis("de kaarten erbij", Array.isArray(w.kaarten));
eis("en wat er verstuurd is", w.verstuurd.some((v) => v.soort === "opening" || v.titel));
eis("het venster draagt zijn verloop", w.venster.verloop.length === 6);
eis("de drempels gaan mee naar het scherm, zodat de legende ze kan tonen",
    w.drempels.grenzen[1].waarde === 60 && w.drempels.grenzen[2].waarde === 50);
eis("en de vakken van de balk ook, zodat de balk niet iets anders toont dan de meter rekent",
    Array.isArray(w.vakken) && w.vakken.length === 6);

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
