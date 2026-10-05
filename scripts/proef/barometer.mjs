// De barometer zegt wat wij van een lid vragen — en liegt niet over het venster.
//
//   node scripts/proef/barometer.mjs
//
// Twee dingen die hier mis kunnen gaan. Eén: de stand en het venster gaan
// alsnog aan elkaar vastzitten, en dan hadden we net zo goed één meter kunnen
// houden. Twee: wat wij weten en wat de leden weten lopen door elkaar, en dan
// staat er op het ledenscherm iets dat nooit verstuurd is.
import { verseDB, CYCLUS } from "./db.mjs";
import { huidig, stelVoor, stelVast, meldGepubliceerd } from "../../worker/barometer.js";
import { conceptUitKaart } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";

const db = verseDB("/tmp/delta-barometer-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// ------------------------------------------------------------- de schaal
let nu = await huidig(env, CYCLUS);
eis("een verse cyclus heeft nog geen stand", nu.wij === null);
eis("en de leden dus ook niet", nu.leden === null);
eis("de schaal heeft vijf standen", nu.schaal.length === 5);
eis("1 is rustig", nu.schaal[0].waarde === "1" && nu.schaal[0].label === "Niets");
eis("5 is het drukst", nu.schaal[4].label === "Paraat");
eis("het venster is een verloop van zes standen", nu.vensters.length === 6);
eis("de namen komen uit beheer, niet uit de code",
    (await q("select count(*) n from db_choice where tabel='barometerstand' and kolom='stand'"))[0].n === 5);

// --------------------------------------------- een nieuwe cyclus begint ergens
// Een cyclus die vandaag geopend wordt staat op pre-analyse. Niet op niets: dan
// moet elk scherm zelf verzinnen wat 'geen stand' betekent, en dat verzinnen ze
// allemaal anders.
{
  const { maakAan } = await import("../../worker/schrijf.js");
  const gemaakt = await maakAan(env, ik, "cyclus", {
    velden: { label: "OESX nov 2026", status: "analyse", geopend_op: "2026-10-05" },
  });
  eis("de cyclus is aangemaakt", !!gemaakt.id);
  const vers = await huidig(env, gemaakt.id);
  eis("een nieuwe cyclus staat meteen op pre-analyse",
      !!vers.wij && vers.wij.venster.waarde === "pre_analyse");
  eis("en op stand 1, rustig", !!vers.wij && Number(vers.wij.stand.waarde) === 1);
  eis("de leden weten er nog niets van", vers.leden === null);
  eis("er is precies één stand, geen dubbele",
      (await q("select count(*) n from barometerstand where cyclus = ?", gemaakt.id))[0].n === 1);
}

// ----------------------------------------------------------- vaststellen
let uit = await stelVast(env, ik, { cyclus: CYCLUS, stand: 9, venster: "open", reden: "x" });
eis("een stand buiten de schaal kan niet", !!uit.fout);
uit = await stelVast(env, ik, { cyclus: CYCLUS, stand: 2, venster: "halfopen", reden: "x" });
eis("een venster dat niet bestaat kan niet", !!uit.fout);
uit = await stelVast(env, ik, { cyclus: CYCLUS, stand: 2, venster: "open", reden: "   " });
eis("een stand zonder reden kan niet", !!uit.fout);
uit = await stelVast(env, ik, { cyclus: 999, stand: 2, venster: "open", reden: "x" });
eis("een cyclus die niet bestaat kan niet", !!uit.fout);

uit = await stelVast(env, ik, {
  cyclus: CYCLUS, stand: 1, venster: "open",
  reden: "Rustige markt, de optie staat ver uit het geld.",
});
eis("vaststellen lukt", !uit.fout);
nu = await huidig(env, CYCLUS);
eis("wij weten de stand", nu.wij.stand.waarde === 1);
eis("en hij heeft een label uit beheer", nu.wij.stand.label === "Niets");
eis("1 mag hier groen zijn — dit is een toestand, geen openstaande kaart",
    nu.wij.stand.kleur === "groen");
eis("de leden weten nog niets", nu.leden === null);
eis("dus wij en zij staan niet gelijk", nu.gelijk === false);

uit = await stelVast(env, ik, { cyclus: CYCLUS, stand: 1, venster: "open", reden: "nog eens" });
eis("dezelfde stand nog eens vastleggen kan niet", !!uit.fout);

// ------------------------------- stand en venster zitten niet aan elkaar vast
// Dit is waarom het er twee zijn. Rustig én dicht moet kunnen.
uit = await stelVast(env, ik, {
  cyclus: CYCLUS, stand: 1, venster: "pre_analyse",
  reden: "Het kapitaal zit nog vast in de lopende cyclus.",
});
eis("rustig en gesloten tegelijk kan", !uit.fout);
nu = await huidig(env, CYCLUS);
eis("de stand bleef 1", nu.wij.stand.waarde === 1);
eis("en het venster is dicht", nu.wij.venster.waarde === "pre_analyse");

// En andersom: druk én open.
uit = await stelVast(env, ik, {
  cyclus: CYCLUS, stand: 4, venster: "open",
  reden: "De koers nadert de strike, maar er is ruimte voor een nieuwe tranche.",
});
eis("dichtbij blijven en open tegelijk kan ook", !uit.fout);

// ---------------------------------------------------- het systeem stelt voor
uit = await stelVoor(env, { cyclus: CYCLUS, naar: 4, venster: "open" });
eis("een voorstel dat al staat wordt overgeslagen", uit.overgeslagen === "staat al zo");

uit = await stelVoor(env, { cyclus: CYCLUS, naar: 5, reden: "De koers staat onder de strike." });
eis("een echt voorstel wordt een gebeurtenis", !!uit.gebeurtenis);
eis("maar verandert nog niets",
    (await huidig(env, CYCLUS)).wij.stand.waarde === 4);

// Het voorstel staat in de stroom en vraagt om een antwoord. Wie die vlag zet
// is een vraag voor de werkbank; hier gaat het om wat erna gebeurt.
const kaart = { id: uit.gebeurtenis };
await db.prepare("update gebeurtenis set vraagt_antwoord = 1 where id = ?").bind(kaart.id).run();
const voorstelrij = (await q("select titel from gebeurtenis where id = ?", kaart.id))[0];
eis("het voorstel zegt van en naar", voorstelrij.titel.includes("5"));

// ---------------------------------------------- van kaart naar bericht naar leden
const concept = await conceptUitKaart(env, ik, kaart.id, "barometer");
eis("de kaart levert een bericht op", !!concept.publicatie);
const b = (await q("select * from publicatie where id = ?", concept.publicatie))[0];
eis("het bericht gaat over de barometer", b.soort === "barometer");
eis("en heeft geen positie nodig", b.positie === null);
eis("de nieuwe stand staat erin", b.tekst.includes("5"));

// De mens neemt het voorstel over.
uit = await stelVast(env, ik, {
  cyclus: CYCLUS, stand: 5, venster: "pre_analyse",
  reden: "De koers staat onder de strike. Wij kijken dagelijks mee.",
  gebeurtenis: kaart.id,
});
eis("het voorstel overnemen lukt", !uit.fout);
const rij = (await q("select * from barometerstand where id = ?", uit.barometerstand))[0];
eis("en de herkomst zegt dat het een voorstel was", rij.herkomst === "voorstel");
eis("met de kaart erbij", rij.gebeurtenis === kaart.id);

nu = await huidig(env, CYCLUS);
eis("wij staan op 5", nu.wij.stand.waarde === 5);
eis("de leden weten nog steeds niets", nu.leden === null);

// Zolang het bericht niet weg is, weten de leden het niet.
eis("de leden lopen achter op de barometer", (await huidig(env, CYCLUS)).gelijk === false);

await verstuurPublicatie(env, ik, concept.publicatie);
nu = await huidig(env, CYCLUS);
eis("na het versturen weten de leden het", nu.leden !== null);
eis("en het is dezelfde stand", nu.leden.stand.waarde === 5);
eis("wij en zij staan gelijk", nu.gelijk === true);
eis("er staat wanneer het bij ze kwam", !!nu.leden.gepubliceerd_op);
eis("en met welk bericht", nu.leden.publicatie === concept.publicatie);

// Er is geen weg om een stand bij de leden te krijgen zonder bericht.
const zonder = await meldGepubliceerd(env, CYCLUS, null);
eis("niets meer om te melden", zonder === null);

// ------------------------------------------------------------- het verloop
const verloop = await q("select * from barometerstand where cyclus = ? order by id", CYCLUS);
eis("elke stand is bewaard, niet overschreven", verloop.length === 4);
eis("elke stand draagt zijn reden", verloop.every((r) => !!String(r.reden || "").trim()));
eis("alleen de gemelde stand is gepubliceerd",
    verloop.filter((r) => r.gepubliceerd_op).length === 1);

// ------------------------------------------- het venster is een verloop
//
// Zes standen, in volgorde, van 'we kijken' tot 'afgerond'. Het gaat over de
// voorbereidingstijd van een lid: wie pas hoort dat we erin zitten als we erin
// zitten, is mentaal te laat.
const volgorde = nu.vensters.map((v) => v.waarde);
eis("de standen staan in de goede volgorde",
    JSON.stringify(volgorde) === JSON.stringify(
      ["pre_analyse", "besluit", "opent_binnenkort", "open", "in_positie", "afgerond"]));
eis("'gemist' is geen venstertoestand", !volgorde.includes("gemist"));

// Twee standen zijn een oordeel van ons en worden nooit door het systeem
// voorgesteld: 'opent binnenkort' en 'open'. Dat is juist wat een lid het
// meeste waard is, en een systeem dat het zelf zet, zet het een keer verkeerd.
// Waar die regel straks staat is nog te bouwen; dat hij geldt, staat vast.
eis("'opent binnenkort' bestaat als stand", volgorde.includes("opent_binnenkort"));
eis("'open' ook", volgorde.includes("open"));

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
