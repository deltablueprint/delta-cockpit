// Kaarten die ontstaan uit iets dat er níét gebeurde.
//
//   node scripts/proef/toestand.mjs
//
// Een go/no-go waarin jouw stem ontbreekt is geen gebeurtenis — er is alleen
// een toestand die blijft hangen. De melder zoekt die op met de SELECT uit de
// definitie. Twee dingen moeten daarbij kloppen: hij mag alleen lezen, en hij
// mag nooit twee kaarten voor dezelfde toestand opleveren.
import { verseDB, CYCLUS, MOMENT } from "./db.mjs";
import { meld, draai, aanleidingDeugt, naWijziging } from "../../worker/motor.js";
import { wachtrij, beantwoord } from "../../worker/wachtrij.js";

const db = verseDB("/tmp/delta-toestand-proef.sqlite");
const env = { DB: db };
const ik = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;
const een = async (s, ...b) => await db.prepare(s).bind(...b).first();

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// ---------------------------------------------------------- het slot
eis("een gewone select mag", aanleidingDeugt("select 1 as cyclus from cyclus"));
eis("niets mag niet", !aanleidingDeugt(""));
for (const stuk of [
  "update cyclus set status = 'x'",
  "delete from gebeurtenis",
  "select 1; drop table cyclus",
  "select 1 -- en de rest",
  "select 1 /* weg */ from cyclus",
  "insert into cyclus values (1)",
  "pragma foreign_keys = off",
  "with x as (select 1) select * from x",   // moet met select beginnen
]) {
  eis(`geweigerd: ${stuk.slice(0, 32)}`, !aanleidingDeugt(stuk));
}
eis("ongebalanceerde haakjes mogen niet", !aanleidingDeugt("select (1 from cyclus"));

// Elke aanleiding die écht is ingericht, komt door het slot.
for (const d of await q("select kaartsoort, aanleiding from processtap where aanleiding is not null")) {
  eis(`de aanleiding van ${d.kaartsoort} deugt`, aanleidingDeugt(d.aanleiding));
}

// -------------------------------------------- een open go/no-go per deelnemer
await db.prepare("update beoordelingsmoment set status = 'blind inzenden' where id = ?").bind(MOMENT).run();

let verslag = await meld(env);
eis("er is niets overgeslagen", verslag.overgeslagen.length === 0);

let kaarten = await q("select * from gebeurtenis where vraagt_antwoord = 1 and soort = 'gonogo_open'");
const deelnemers = (await q("select count(*) n from gebruiker where actief = 1"))[0].n;
eis(`elke deelnemer krijgt zijn eigen kaart (${kaarten.length} van ${deelnemers})`, kaarten.length === deelnemers);
eis("elke kaart heeft een eigen sleutel",
    new Set(kaarten.map((k) => k.sleutel)).size === kaarten.length);
eis("de kaart weet om welk moment het gaat",
    kaarten.every((k) => k.beoordelingsmoment === MOMENT));
eis("en bij welke cyclus", kaarten.every((k) => k.cyclus === CYCLUS));
eis("de kaart draagt een leesbare titel", kaarten.every((k) => /stem ontbreekt/.test(k.titel)));

// Nog eens melden mag niets toevoegen. Dit is de cron die elk uur draait: zonder
// dit zou er elk uur een kaart bij komen voor dezelfde ontbrekende stem.
verslag = await meld(env);
eis("nog eens melden levert niets op", verslag.gemeld === 0);
eis("en er staan er niet meer",
    (await q("select count(*) n from gebeurtenis where soort = 'gonogo_open'"))[0].n === kaarten.length);

for (let i = 0; i < 5; i++) await draai(env);
eis("ook na vijf ronden niet",
    (await q("select count(*) n from gebeurtenis where soort = 'gonogo_open'"))[0].n === kaarten.length);

// ------------------------------------- de toestand lost op, de kaart gaat mee
//
// Dit is waar een systeem als dit meestal scheef gaat: het werk is gedaan, maar
// de kaart staat er nog en de werkbank beweert iets dat niet meer klopt.
//
// Een toestandskaart is geen vraag maar een constatering — 'jouw stem ontbreekt'
// — en een constatering die niet meer waar is, hoort weg. Niet omdat iemand hem
// wegklikte, maar omdat het werk gedaan is.
const vanSimon = kaarten.find((k) => k.sleutel.endsWith(":simon"));
eis("de kaart van simon staat er", !!vanSimon);

await db.prepare(
  "insert into inzending (cyclus, beoordelingsmoment, deelnemer, status, verstuurd_op) values (?, ?, 'simon', 'verstuurd', datetime('now'))"
).bind(CYCLUS, MOMENT).run();
verslag = await meld(env);
eis("wie ingezonden heeft krijgt geen nieuwe kaart", verslag.gemeld === 0);
eis("en zijn kaart sluit zichzelf", verslag.gesloten === 1);
const na = await een("select beantwoord_op, antwoord from gebeurtenis where id = ?", vanSimon.id);
eis("de kaart is beantwoord", !!na.beantwoord_op);
eis("en het antwoord zegt waarom", na.antwoord === "vanzelf opgelost");
eis("hij staat niet meer in de rij",
    !(await wachtrij(env, ik, { van: "alles" })).kaarten.some((k) => k.id === vanSimon.id));

// De kaarten van de anderen staan er nog: die hebben niet ingezonden.
eis("de kaarten van de anderen blijven staan",
    (await q("select count(*) n from gebeurtenis where soort = 'gonogo_open' and beantwoord_op is null"))[0].n === 2);

verslag = await meld(env);
eis("een tweede ronde sluit niets dubbel", verslag.gesloten === 0);
eis("en maakt geen nieuwe", verslag.gemeld === 0);

// Keert de toestand terug — de inzending wordt ingetrokken — dan hoort de kaart
// gewoon weer te verschijnen. De sleutel is vrij, want hij is beantwoord.
await db.prepare("update inzending set verstuurd_op = null where beoordelingsmoment = ? and deelnemer = 'simon'")
  .bind(MOMENT).run();
verslag = await meld(env);
eis("komt de toestand terug, dan komt de kaart terug", verslag.gemeld === 1);

// --------------------------------------------------- de charts en het besluit
await db.prepare("update beoordelingsmoment set status = 'blind versturen' where id = ?").bind(MOMENT).run();
await meld(env);
eis("het ontbrekende besluit wordt een kaart",
    (await q("select count(*) n from gebeurtenis where soort = 'reviewbesluit_open'"))[0].n === 1);

// Elke voorwaarde op rood vraagt om herbeoordeling — één kaart per voorwaarde,
// want het zijn losse vragen die ieder hun eigen antwoord krijgen.
const rood = (await q("select count(*) n from voorwaarde v join cyclus c on c.id = v.cyclus where v.status = 'rood' and v.archief = 0 and c.archief = 0 and c.status not in ('afgesloten','geannuleerd')"))[0].n;
eis("er staat minstens één voorwaarde op rood", rood > 0);
await meld(env);
const herb = await q("select * from gebeurtenis where soort = 'herbeoordeling_open'");
eis(`elke rode voorwaarde wordt een kaart (${herb.length} van ${rood})`, herb.length === rood);
eis("en de titel zegt welke", herb.every((h) => /rood/.test(h.titel)));
eis("elk met een eigen sleutel", new Set(herb.map((h) => h.sleutel)).size === herb.length);
await meld(env);
eis("ook die komen niet dubbel",
    (await q("select count(*) n from gebeurtenis where soort = 'herbeoordeling_open'"))[0].n === rood);

// ------------------------------------------ een kapotte aanleiding kost één kaart
await db.prepare("update processtap set aanleiding = 'select onzin from nergens' where kaartsoort = 'chartlezing'").run();
verslag = await draai(env);
eis("de kapotte aanleiding wordt overgeslagen",
    verslag.overgeslagen.some((o) => o.kaart === "chartlezing"));
eis("en de ronde loopt gewoon door", typeof verslag.bekeken === "number");

await db.prepare("update processtap set aanleiding = 'delete from cyclus' where kaartsoort = 'chartlezing'").run();
verslag = await draai(env);
eis("een aanleiding die wil schrijven wordt geweigerd",
    verslag.overgeslagen.some((o) => o.kaart === "chartlezing" && /deugt niet/.test(o.reden)));
eis("en er is niets gewist",
    (await q("select count(*) n from cyclus"))[0].n > 0);

// -------------------------------------------------- de kaarten zijn bruikbaar
// Het moment staat inmiddels op 'blind versturen', dus de go/no-go-kaarten zijn
// vanzelf gesloten — daar is niets meer te stemmen. Wat er staat, moet bruikbaar
// zijn, en de twee die bij deze stand horen moeten er zijn.
const rij = await wachtrij(env, ik, { van: "alles" });
for (const soort of ["reviewbesluit", "herbeoordeling"]) {
  eis(`${soort}: staat in de wachtrij`, rij.kaarten.some((x) => x.kaartsoort === soort));
}
eis("de go/no-go-kaarten zijn vanzelf weg bij deze stand",
    !rij.kaarten.some((x) => x.kaartsoort === "gonogo"));

for (const k of rij.kaarten) {
  const soort = k.kaartsoort;
  eis(`${soort}: heeft een knop`, k.knoppen.length > 0);
  eis(`${soort}: heeft een prioriteit`, ["hoog", "medium", "laag"].includes(k.prioriteit));
  eis(`${soort}: toont geen accolades`, !String(k.titel).includes("{{"));
}

// ------------------------------- een toestand hoeft niet op de cron te wachten
//
// De klokronde draait elk uur. Voor een go/no-go is dat te traag: je zet het
// moment op 'blind inzenden' omdat het gesprek nú begint, en dan hoort de kaart
// er binnen een seconde te staan en niet over negenenvijftig minuten.
const { raaktEenAanleiding } = await import("../../worker/motor.js");

eis("een wijziging op beoordelingsmoment raakt een aanleiding",
    await raaktEenAanleiding(env, "beoordelingsmoment"));
eis("en op voorwaarde ook", await raaktEenAanleiding(env, "voorwaarde"));
eis("en op inzending ook", await raaktEenAanleiding(env, "inzending"));
eis("maar op publicatie niet", !(await raaktEenAanleiding(env, "publicatie")));
eis("en op een tabel die niet bestaat ook niet", !(await raaktEenAanleiding(env, "bestaat_niet")));

// Een verse toestand, en dan de ronde die na een wijziging hoort te lopen.
await db.prepare("delete from gebeurtenis where soort = 'reviewbesluit_open'").run();
await db.prepare("update beoordelingsmoment set status = 'blind versturen' where id = 99").run()
  .catch(() => null);
await db.prepare("insert or ignore into beoordelingsmoment (id, cyclus, datum, status) values (99, ?, '2026-10-02', 'blind versturen')")
  .bind(CYCLUS).run();
const ronde = await naWijziging(env, "beoordelingsmoment");
eis("de ronde na een wijziging draait", !!ronde);
eis("en levert de kaart meteen op",
    (await q("select count(*) n from gebeurtenis where soort = 'reviewbesluit_open'"))[0].n > 0);
eis("zonder de klok mee te nemen", ronde.slagen === 0);

// Een wijziging op een tabel die geen enkele aanleiding noemt, draait niets.
eis("een wijziging die niets raakt draait geen ronde",
    (await naWijziging(env, "publicatie")) === null);

// ------------------------------------------------ de brug is de klok
//
// Er is geen cron meer. De hartslag van de brug komt elke tien seconden langs en
// draait de motor. Twee dingen moeten daarbij kloppen: hij doet bij de eerste
// tik echt alles, en hij doet het niet elke tien seconden opnieuw.
await db.prepare("delete from gebeurtenis").run();
await db.prepare("delete from motorronde").run();
await db.prepare("update beoordelingsmoment set status = 'blind inzenden' where id = ?").bind(MOMENT).run();

let tik1 = await draai(env, { aanleiding: "brug" });
eis("de eerste hartslag doet de hele rondgang", tik1.gemeld > 0);
const naTik1 = (await q("select count(*) n from gebeurtenis where vraagt_antwoord = 1"))[0].n;
eis("en levert kaarten op", naTik1 > 0);

const tik2 = await draai(env, { aanleiding: "brug" });
eis("de tik erna doet de rondgang niet opnieuw", tik2.gemeld === 0);
eis("en levert niets dubbels op",
    (await q("select count(*) n from gebeurtenis where vraagt_antwoord = 1"))[0].n === naTik1);
eis("een tik die niets deed laat geen spoor na",
    (await q("select count(*) n from motorronde"))[0].n === 1);

// De grens is in te stellen. Hoog zetten betekent: wel wegen, geen rondgang.
await db.prepare("update instelling set waarde = '3600' where sleutel = 'motor_rondgang_seconden'").run();
await db.prepare("update beoordelingsmoment set status = 'blind versturen' where id = ?").bind(MOMENT).run();
const tik3 = await draai(env, { aanleiding: "brug" });
eis("met een hoge grens slaat hij de rondgang over", tik3.gemeld === 0);

// Een handeling van een mens wacht nooit op die grens: die is er juist voor het
// geval dat het nú moet.
const nu = await naWijziging(env, "beoordelingsmoment");
eis("een wijziging doorbreekt de grens", !!nu && nu.gemeld > 0);
await db.prepare("update instelling set waarde = '10' where sleutel = 'motor_rondgang_seconden'").run();

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
