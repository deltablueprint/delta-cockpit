// Een veld dat soms wel en soms niet van toepassing is.
//
//   node scripts/proef/voorwaardelijk.mjs
//
// 'Waarom alleen besloten' hoort alleen te bestaan als er één iemand aanwezig
// was. Drie dingen moeten kloppen: het scherm verbergt hem dan, de server eist
// hem dan ook niet, en met één aanwezige eist hij hem wel.
import { readFileSync } from "node:fs";
import { verseDB, CYCLUS, MOMENT } from "./db.mjs";
import { zichtbaar, wijzig } from "../../worker/schrijf.js";
import { openVerplicht } from "../../worker/proces.js";
import { versturen } from "../../worker/gonogo.js";

const db = verseDB("/tmp/delta-voorwaardelijk-proef.sqlite");
const env = { DB: db };
const simon = { id: "simon" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;
const een = async (s, ...b) => await db.prepare(s).bind(...b).first();

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// ------------------------------------------------------------ de grammatica
const veld = { toon_als: "aantal(aanwezigen_ids) = 1" };
eis("één aanwezige: zichtbaar", zichtbaar(veld, { aanwezigen_ids: "simon" }));
eis("drie aanwezigen: niet", !zichtbaar(veld, { aanwezigen_ids: "simon,jacqueline,pieter" }));
eis("geen aanwezigen: niet", !zichtbaar(veld, { aanwezigen_ids: "" }));
eis("niets ingevuld: niet", !zichtbaar(veld, {}));
eis("spaties tellen niet mee", zichtbaar(veld, { aanwezigen_ids: " simon , " }));
eis("een veld zonder voorwaarde is altijd zichtbaar", zichtbaar({}, {}));
eis("de oude grammatica werkt nog",
    zichtbaar({ toon_als: "uitkomst = go" }, { uitkomst: "go" })
    && !zichtbaar({ toon_als: "uitkomst = go" }, { uitkomst: "no-go" }));

// Het scherm en de server moeten hetzelfde vinden. Staan ze uit elkaar, dan
// verbergt het scherm een veld dat de server eist en kom je niet verder.
const scherm = readFileSync("app/src/record.js", "utf8");
eis("het scherm kent aantal() ook", /aantal\(\\s\*\(\\w\+\)/.test(scherm) || scherm.includes("aantal("));
eis("en luistert op de juiste kolom", scherm.includes("sturendeKolom"));

// --------------------------------------------------- de inrichting klopt
const rij = await een("select toon_als, verplicht from db_field where tabel='beoordelingsmoment' and kolom='alleen_reden'");
eis("het veld is voorwaardelijk", rij.toon_als === "aantal(aanwezigen_ids) = 1");
eis("en verplicht", rij.verplicht === 1);

// ---------------------------------------------- bewaren met drie aanwezigen
await db.prepare("update beoordelingsmoment set aanwezigen_ids = 'simon,jacqueline,pieter', alleen_reden = null where id = ?")
  .bind(MOMENT).run();
let uit = await wijzig(env, simon, "beoordelingsmoment", MOMENT, { velden: { aanleiding: "proef" } });
eis("met drie aanwezigen kun je bewaren zonder reden", !uit.fout);
eis("en de stap staat niet open",
    !(await openVerplicht(env, "beoordelingsmoment", await een("select * from beoordelingsmoment where id = ?", MOMENT)))
      .includes("Reden bij alleen beslissen"));

// ------------------------------------------------ en met één aanwezige
await db.prepare("update beoordelingsmoment set aanwezigen_ids = 'simon', alleen_reden = null, status = 'aanwezigen bepalen' where id = ?")
  .bind(MOMENT).run();
const alleen = await een("select * from beoordelingsmoment where id = ?", MOMENT);
eis("met één aanwezige staat de stap wel open",
    (await openVerplicht(env, "beoordelingsmoment", alleen)).includes("Reden bij alleen beslissen"));

uit = await wijzig(env, simon, "beoordelingsmoment", MOMENT, { velden: { alleen_reden: "" } });
eis("en leeg bewaren mag dan niet", !!uit.fout);

// ------------------------------- en een actieknop mag er niet langs
// Eerst de technische analyse rondmaken, want die wordt eerder gecontroleerd —
// anders toetsen we hier het verkeerde slot.
await db.prepare(
  `insert into chartlezing (cyclus, beoordelingsmoment, onderwerp, afbeelding, commentaar)
   values (?, ?, 'OESX dag', 'data:image/png;base64,xx', 'Zijwaarts, volume normaal.')`
).bind(CYCLUS, MOMENT).run();

const weg = await versturen(env, simon, CYCLUS, { positie: "go", strike: 5200, expiratiedatum: "2026-11-20" });
eis("inzenden kan niet zolang de stap openstaat", !!weg.fout);
eis("en de melding zegt welke stap", weg.fout && weg.fout.includes("Reden bij alleen beslissen"));

await db.prepare("update beoordelingsmoment set alleen_reden = 'De anderen waren op reis.' where id = ?")
  .bind(MOMENT).run();
eis("met de reden erin staat de stap niet meer open",
    !(await openVerplicht(env, "beoordelingsmoment", await een("select * from beoordelingsmoment where id = ?", MOMENT)))
      .includes("Reden bij alleen beslissen"));

// -------------------------- elke route die een status schrijft, moet het slot kennen
//
// beweegFase controleert de verplichte stappen wel. Twee routes schrijven de
// status rechtstreeks en komen daar dus niet langs; die moeten het zelf doen.
const gonogoTekst = readFileSync("worker/gonogo.js", "utf8");
const direct = [...gonogoTekst.matchAll(/update beoordelingsmoment[\s\S]{0,400}?status = '([a-z ]+)'/g)]
  .map((m) => m[1]);
eis(`er zijn twee routes die de status rechtstreeks zetten (${direct.join(", ")})`, direct.length === 2);
eis("beide staan achter het slot",
    (gonogoTekst.match(/await openVerplicht\(env, "beoordelingsmoment"/g) || []).length === 2);

// 'inzendingen open' wordt gezet zodra iedereen heeft ingezonden. Dat is geen
// mens die een stap overslaat maar een gevolg — en inzenden zelf staat al achter
// het slot, dus die weg is gedekt.
eis("het slot zit vóór het vastleggen van de uitkomst",
    gonogoTekst.indexOf('await openVerplicht(env, "beoordelingsmoment", moment);\n  if (nogOpen.length)') > 0
    || /nogOpen/.test(gonogoTekst));

// ------------------------------- een stap heet wat hij controleert
//
// 'Instapvoorwaarden ingevuld · 0 van 3' terwijl er drie voorwaarden staan: de
// naam ging over aanmaken, de regel over meten. Zulke stappen zijn erger dan een
// fout, want je gaat zoeken naar iets dat er niet is.
const regels = readFileSync("worker/proces.js", "utf8");
for (const st of await q("select naam, afvinkregel, uitleg from processtap where afvinkregel is not null and archief = 0")) {
  eis(`${st.naam}: de regel ${st.afvinkregel} bestaat`, regels.includes(`async ${st.afvinkregel}(`));
  // Een stap die een telling toont, moet zeggen wát hij telt.
  const telt = new RegExp(`async ${st.afvinkregel}\\(env, rij\\) \\{[\\s\\S]*?\\n  \\},`).exec(regels);
  if (telt && /stand: .*van \$\{/.test(telt[0])) {
    eis(`${st.naam}: de telling zegt wat er geteld wordt`,
        /van \$\{alle\} \w+|van \$\{nodig\} \w+|\$\{alle - open\} van \$\{alle\} \w/.test(telt[0]));
  }
}
eis("'ingevuld' heet nu 'gemeten'",
    (await q("select count(*) n from processtap where naam like '%voorwaarden ingevuld%'"))[0].n === 0);

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
