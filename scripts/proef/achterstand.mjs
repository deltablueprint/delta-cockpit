// De achterstand meet de leden, niet ons.
//
//   node scripts/proef/achterstand.mjs
//
// De valkuil van elke meter als deze is dat hij blijft hangen: iets wordt
// afgehandeld en het getal zakt niet. Daarom staat hier bij elke manier om een
// post af te sluiten de vraag of de meter meegaat.
import { verseDB, CYCLUS, POSITIE, MOMENT } from "./db.mjs";
import { achterstand, inWoorden } from "../../worker/achterstand.js";
import { conceptUitKaart } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";
import { beantwoord, wachtrij } from "../../worker/wachtrij.js";
import { weeg, meld } from "../../worker/motor.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-achterstand-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// --------------------------------------------------------------- leeg
let a = await achterstand(env);
eis("zonder kaarten lopen de leden niet achter", a.bij === true);
eis("en het getal is nul", a.uren === 0 && a.aantal === 0);
eis("de meter staat grijs, niet groen", a.kleur === "grijs");
eis("er is altijd een lijst, ook als die leeg is", Array.isArray(a.posten));
eis("en een zin die klopt", inWoorden(a) === "De leden zijn bij.");

// ------------------------------------------------- één ding dat zij niet weten
await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche verdwenen bij de broker",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-01 10:00:00",
});
await weeg(env);

a = await achterstand(env, { nu: "2026-09-01T16:00:00Z" });
eis("nu lopen ze wel achter", a.bij === false);
eis("zes uur", a.uren === 6);
eis("op één ding", a.aantal === 1);
eis("binnen een dag is dat nog grijs", a.kleur === "grijs");
eis("de post zegt waar het vastzit", a.posten[0].stand === "nog geen bericht");

a = await achterstand(env, { nu: "2026-09-02T16:00:00Z" });
eis("na een dag wordt het amber", a.kleur === "amber");
a = await achterstand(env, { nu: "2026-09-05T16:00:00Z" });
eis("na drie dagen wordt het rood", a.kleur === "rood");
eis("en de zin telt in dagen", inWoorden(a).includes("4 dagen"));

// De grenzen staan in beheer, niet in de code.
await db.prepare("update instelling set waarde = '1' where sleutel = 'achterstand_rood_uur'").run();
a = await achterstand(env, { nu: "2026-09-01T16:00:00Z" });
eis("een andere grens geeft een andere kleur", a.kleur === "rood");
await db.prepare("update instelling set waarde = '72' where sleutel = 'achterstand_rood_uur'").run();

// Een onzinnige waarde mag de meter niet omleggen.
await db.prepare("update instelling set waarde = 'nogal wat' where sleutel = 'achterstand_amber_uur'").run();
a = await achterstand(env, { nu: "2026-09-02T16:00:00Z" });
eis("onzin in een instelling valt terug op de standaard", a.kleur === "amber");
await db.prepare("update instelling set waarde = '24' where sleutel = 'achterstand_amber_uur'").run();

// ------------------------------------------- het concept zakt de meter niet
const kaart = (await wachtrij(env, ik)).kaarten[0];
const concept = await conceptUitKaart(env, ik, kaart.id);
a = await achterstand(env, { nu: "2026-09-02T16:00:00Z" });
eis("een concept opstellen haalt de achterstand niet weg", a.bij === false);
eis("maar de post zegt nu wél waar het ligt", a.posten[0].stand.startsWith("bericht"));
eis("en wijst naar het bericht", a.posten[0].publicatie === concept.publicatie);

// ------------------------------------------------ pas versturen zakt de meter
await db.prepare("update publicatie set tekst = 'De positie is gesloten.' where id = ?")
  .bind(concept.publicatie).run();
await verstuurPublicatie(env, ik, concept.publicatie);
a = await achterstand(env, { nu: "2026-09-02T16:00:00Z" });
eis("pas als het bericht weg is, zijn de leden bij", a.bij === true);
eis("en de meter staat echt op nul", a.aantal === 0);
// Het versturen sluit ook de kaart die erom vroeg: anders blijft die staan voor
// iets dat de leden allang weten.
eis("en de kaart die erom vroeg is dicht",
    !(await wachtrij(env, ik)).kaarten.some((k) => k.id === kaart.id));

// ------------------------------------ 'niet melden' zakt de meter ook
await log(env, ik, {
  bron: "ibkr", soort: "positie_geopend", titel: "Nieuwe tranche",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-03 10:00:00",
});
await weeg(env);
a = await achterstand(env, { nu: "2026-09-03T16:00:00Z" });
eis("de nieuwe post telt mee", a.aantal === 1);

const tweede = (await wachtrij(env, ik)).kaarten.find((k) => k.kaartsoort === "positie_geopend");
await beantwoord(env, ik, tweede.id, { knop: 2, reden: "Dit is een correctieboeking, geen echte positie." });
a = await achterstand(env, { nu: "2026-09-03T16:00:00Z" });
eis("bewust niet melden is ook bij zijn", a.bij === true);

// -------------------------------------- een kaart die niet over de leden gaat
// De technische analyse vraagt geen bericht. Die hoort dus niet in deze meter,
// hoe lang hij ook openstaat.
// Niet met de hand gelogd: de melder zoekt deze toestand zelf op (0112), en zo
// ontstaat de kaart ook echt zoals hij in productie ontstaat.
await db.prepare("update beoordelingsmoment set status = 'inzendingen open' where id = ?").bind(MOMENT).run();
await meld(env);
a = await achterstand(env, { nu: "2026-09-10T16:00:00Z" });
eis("werk dat niet over de leden gaat telt niet mee", a.bij === true);
eis("ook al staat de kaart al weken open",
    (await wachtrij(env, ik)).kaarten.some((k) => k.kaartsoort === "chartlezing"));

// ----------------------------------------------------------- per cyclus
await log(env, ik, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche weg",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-08 10:00:00",
});
await weeg(env);
const vanDeze = await achterstand(env, { cyclus: CYCLUS, nu: "2026-09-09T10:00:00Z" });
const vanAlles = await achterstand(env, { nu: "2026-09-09T10:00:00Z" });
eis("filteren op een cyclus werkt", vanDeze.aantal === vanAlles.aantal);
const vanAndere = await achterstand(env, { cyclus: 999, nu: "2026-09-09T10:00:00Z" });
eis("een cyclus zonder posten staat op nul", vanAndere.bij === true);

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
