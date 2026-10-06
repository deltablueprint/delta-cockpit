// Staat alles in beheer, of staat er nog iets in de code?
//
//   node scripts/proef/inrichting.mjs
//
// De afspraak is dat dit systeem metadatagestuurd is: een nieuwe tabel krijgt
// zijn schermen gratis, en wat er op die schermen staat is in te richten zonder
// deploy. Die afspraak verwatert vanzelf — iemand voegt een kolom toe en vergeet
// het veld, of zet een lijstje waarden in een worker omdat het even sneller is.
//
// Deze proef is de bewaker daarvan. Hij kijkt niet of iets werkt maar of het op
// de goede plek staat.
import { readFileSync, readdirSync } from "node:fs";
import { verseDB } from "./db.mjs";
import { BRONNEN } from "../../worker/stroom.js";
import { VENSTERS } from "../../worker/barometer.js";

const db = verseDB("/tmp/delta-inrichting-proef.sqlite");
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// Kolommen die elke tabel heeft en die niemand op een formulier wil zien.
const HUISHOUDING = new Set([
  "id", "archief", "revisie", "aangemaakt_op", "aangemaakt_door",
]);

// Kolommen die met opzet géén veld hebben, met de reden erbij. Een uitzondering
// zonder reden is een vergeten kolom met een vrijbrief.
const MET_OPZET_GEEN_VELD = {
  "gebruiker.wachtwoord_hash":
    "Wat niet op een formulier staat, kan ook niet per ongeluk op een scherm komen.",
};

// Tabellen die met opzet geen scherm hebben: ze worden door de machine gevuld
// en gelezen, en een mens heeft er niets te zoeken.
const ZONDER_SCHERM = new Set([
  "db_table", "db_field", "db_choice", "db_module", "db_view", "db_sectie",
  "db_rule", "db_calc", "schema_versie", "sqlite_sequence", "configuratieversie",
  "favoriet", "bezoek", "gebruiker_voorkeur", "inzending", "audit",
  "brokerpositie", "brokergebeurtenis", "brokerverbinding", "brokerinstelling",
  "lynx_rapport", "cyclus_event",
  // Deze twee hebben een eigen scherm in plaats van een lijst: de drempels van
  // de barometer staan als vijf standen onder elkaar (/barometerdrempels), niet
  // als rijen met sleutels.
  "barometerdrempel",
  // Het verloop van een tranche: door de brug geschreven, op het scherm als
  // lijn. Een lijst met duizenden regels zou niemand openen.
  "positiemeting",
  // De stand van de onderliggende. Eén rij per index, overschreven bij elke
  // hartslag van de brug: een momentopname, geen vastlegging. Wat bewaard moet
  // blijven staat in de gebeurtenissenstroom.
  "marktstand",
]);

const tabellen = (await q(
  "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name"
)).map((t) => t.name);

// ---------------------------------------- 1. elke tabel met een db_table-rij
//    heeft ook velden, en elk veld bestaat echt als kolom
// Alleen wat aan staat. Een uitgeschakelde definitie is geen scherm meer, en
// hoeft dus ook nergens naar te wijzen.
const gedefinieerd = await q("select naam, label, titel_veld from db_table where actief = 1");
for (const t of gedefinieerd) {
  eis(`${t.naam}: de tabel bestaat echt`, tabellen.includes(t.naam));
  if (!tabellen.includes(t.naam)) continue;

  const kolommen = (await q(`pragma table_info("${t.naam}")`)).map((c) => c.name);
  eis(`${t.naam}: het titelveld bestaat`, !t.titel_veld || kolommen.includes(t.titel_veld));

  const velden = await q("select kolom, type, verwijst_naar, keuzelijst from db_field where tabel = ?", t.naam);
  for (const v of velden) {
    eis(`${t.naam}.${v.kolom}: het veld wijst naar een bestaande kolom`, kolommen.includes(v.kolom));
  }

  // Andersom: een kolom zonder veld is onzichtbaar in beheer. Dat mag, maar
  // alleen voor huishouding — niet voor iets inhoudelijks.
  const metVeld = new Set(velden.map((v) => v.kolom));
  for (const k of kolommen) {
    if (HUISHOUDING.has(k) || metVeld.has(k)) continue;
    if (MET_OPZET_GEEN_VELD[`${t.naam}.${k}`]) continue;
    eis(`${t.naam}.${k}: deze kolom heeft geen veld en is dus niet in te richten`, false);
  }
}

// ------------------------------------- 2. elke tabel is ergens te bereiken
for (const naam of tabellen) {
  if (ZONDER_SCHERM.has(naam)) continue;
  // Een rij die uit staat telt ook: dat is een vastgelegd besluit ('deze tabel
  // doet niet meer mee'), geen vergeten tabel.
  const heeft = await q("select naam, actief from db_table where naam = ?", naam);
  eis(`${naam}: heeft een db_table-rij`, heeft.length === 1);
}

// ------------------------------------------- 3. elk keuzeveld heeft keuzes
const keuzevelden = await q("select tabel, kolom from db_field where type = 'keuze' and actief = 1");
for (const v of keuzevelden) {
  const n = (await q("select count(*) n from db_choice where tabel = ? and kolom = ? and actief = 1", v.tabel, v.kolom))[0].n;
  eis(`${v.tabel}.${v.kolom}: een keuzeveld zonder keuzes is een leeg lijstje`, n > 0);
}

// -------------------------------- 4. elke verwijzing wijst naar iets echts
const verwijzingen = await q("select tabel, kolom, verwijst_naar from db_field where type = 'verwijzing' and actief = 1");
for (const v of verwijzingen) {
  eis(`${v.tabel}.${v.kolom}: een verwijzing zegt waarheen`, !!v.verwijst_naar);
  if (!v.verwijst_naar) continue;
  eis(`${v.tabel}.${v.kolom}: ${v.verwijst_naar} bestaat als tabel`, tabellen.includes(v.verwijst_naar));
}

// ------------------------------------- 5. elk veld staat in een sectie die bestaat
const secties = await q("select tabel, naam from db_sectie");
const sectieset = new Set(secties.map((s) => `${s.tabel}.${s.naam}`));
for (const v of await q("select tabel, kolom, sectie from db_field where actief = 1 and sectie is not null")) {
  eis(`${v.tabel}.${v.kolom}: de sectie '${v.sectie}' bestaat`, sectieset.has(`${v.tabel}.${v.sectie}`));
}

// ------------------------------ 6. elke lijstweergave toont bestaande kolommen
for (const w of await q("select tabel, naam, kolommen from db_view where actief = 1")) {
  let lijst = [];
  try { lijst = JSON.parse(w.kolommen); } catch { /* blijft leeg */ }
  eis(`${w.tabel}/${w.naam}: de kolommen zijn een json-lijst`, Array.isArray(lijst) && lijst.length > 0);
  const echt = (await q(`pragma table_info("${w.tabel}")`)).map((c) => c.name);
  for (const k of lijst) {
    eis(`${w.tabel}/${w.naam}: de kolom ${k} bestaat`, echt.includes(k));
  }
}

// ------------------------------- 7. elk menu-item komt ergens uit of heen
for (const m of await q("select label, groep, doeltabel, route from db_module where actief = 1")) {
  eis(`menu '${m.label}': heeft een tabel of een route`, !!(m.doeltabel || m.route));
  if (m.doeltabel) {
    eis(`menu '${m.label}': ${m.doeltabel} bestaat`, tabellen.includes(m.doeltabel));
  }
}
// Eén naam per groep. Twee namen voor hetzelfde is hoe een menu uit elkaar valt.
const groepen = [...new Set((await q("select distinct groep from db_module where actief = 1")).map((g) => g.groep))];
for (const g of groepen) {
  eis(`de menugroep '${g}' is er een die we kennen`,
      ["COMMUNICATIE", "STRATEGIE", "VASTLEGGING", "BEHEER"].includes(g));
}


// ------------------- 8. de code implementeert, de database verklaart
//
// Sommige waarden bestaan op twee plekken: de code weet wat eraan te doen, en
// de database zegt welke er mogen bestaan. Dat is geen dubbeling maar een
// werkverdeling — zolang de twee lijsten gelijk blijven. Lopen ze uiteen, dan
// richt je in beheer iets in dat de code niet kent (de knop doet niets) of
// kent de code iets dat je nergens kunt kiezen (dode code).
//
// De modules spreken hun lijst zelf uit; deze proef raadt niets uit de tekst.
const PAREN = [
  { wat: "de bron van een gebeurtenis",      waarden: BRONNEN,       tabel: "gebeurtenis",   kolom: "bron" },
  { wat: "het venster van de barometer",     waarden: VENSTERS,      tabel: "barometerstand", kolom: "venster" },
];

for (const paar of PAREN) {
  eis(`${paar.wat}: de code heeft een lijst`, Array.isArray(paar.waarden) && paar.waarden.length > 0);
  const inBeheer = (await q(
    "select waarde from db_choice where tabel = ? and kolom = ? and actief = 1", paar.tabel, paar.kolom
  )).map((c) => String(c.waarde));

  for (const w of paar.waarden) {
    eis(`${paar.wat}: '${w}' staat in de code maar is niet te kiezen in beheer`, inBeheer.includes(String(w)));
  }
  for (const w of inBeheer) {
    eis(`${paar.wat}: '${w}' is te kiezen in beheer maar de code kent het niet`,
        paar.waarden.map(String).includes(w));
  }
}

// Elke afvinkregel die op een processtap staat, bestaat ook echt in de code.
const regels = readFileSync("worker/proces.js", "utf8");
for (const r of await q("select distinct afvinkregel w from processtap where afvinkregel is not null")) {
  eis(`de afvinkregel '${r.w}' bestaat in worker/proces.js`, regels.includes(`async ${r.w}(`));
}

// ------------------- 9. wat het systeem zelf weet, vraagt het niet
//
// Een formulier dat opent met een leeg veld dat niemand ooit anders invult, is
// een vraag die geen vraag is. Twee daarvan liggen vast, want ze komen terug bij
// elke nieuwe tabel: wie het aanmaakt, en wanneer.
for (const v of await q(
  "select tabel, standaard from db_field where kolom = 'aangemaakt_door' and actief = 1"
)) {
  eis(`${v.tabel}.aangemaakt_door vult zichzelf met de ingelogde gebruiker`, v.standaard === "ik");
}

// En de standaard moet er een zijn die de worker kent; 'gisteren' zou als tekst
// in het veld belanden.
const BEKEND = ["vandaag", "nu", "ik"];
for (const v of await q(
  `select tabel, kolom, type, standaard from db_field
    where actief = 1 and standaard is not null and standaard <> ''
      and type in ('datum', 'tijdstip', 'verwijzing')`
)) {
  eis(`${v.tabel}.${v.kolom}: '${v.standaard}' is een standaard die de worker kent`,
      BEKEND.includes(v.standaard));
}

// ------------------- 10. elke import bestaat ook echt, ook in de worker
//
// De app wordt gebouwd door vite, en die waarschuwt bij een import die nergens
// op uitkomt. De worker wordt door wrangler gebundeld zonder dat er iemand kijkt:
// daar valt zo'n fout pas om bij de eerste aanroep, in productie, met een
// algemene 500 als enige spoor.
import { readdirSync as mapLees, readFileSync as bestandLees } from "node:fs";

for (const map of ["worker", "scripts/proef"]) {
  const bestanden = mapLees(map).filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  for (const bestand of bestanden) {
    const tekst = bestandLees(`${map}/${bestand}`, "utf8");
    for (const m of tekst.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/gis)) {
      // Alleen eigen bestanden; node: en pakketten slaan we over.
      const pad = m[2].replace(/^\.\//, "").replace(/^\.\.\/\.\.\//, "");
      const bron = pad.endsWith(".js") || pad.endsWith(".mjs") ? pad : `${pad}.js`;
      const vol = bron.includes("/") ? bron : `${map}/${bron}`;
      // Bestaat het bestand niet, dan is dat geen reden om door te lopen — dat
      // is juist de fout die deze controle moet vangen. Hij sloeg hem over, en
      // daardoor bleef een invoer uit een verwijderde module groen — precies
      // wat er bij het slopen van de kaartlaag gebeurd had kunnen zijn.
      let bronTekst;
      try {
        bronTekst = bestandLees(vol, "utf8");
      } catch {
        eis(`${bestand}: importeert uit ${bron}, en dat bestand bestaat`, false);
        continue;
      }
      for (const naam of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)) {
        eis(`${bestand}: ${bron} exporteert ${naam}`,
            new RegExp(`export\\s+(const|let|var|function|async function|class)\\s+${naam}\\b`).test(bronTekst)
            || new RegExp(`export\\s*\\{[^}]*\\b${naam}\\b`).test(bronTekst));
      }
    }
  }
}


// --------------------------------- de kaartlaag is ook uit beheer verdwenen
//
// De code is weg (0125), maar beheer liet de velden nog invullen. Een formulier
// dat om een 'Voorwaarde' en een 'Sleutel' vraagt terwijl niets die leest, is
// erger dan een formulier zonder: iemand vult hem in en wacht op een kaart.
// Niets is verwijderd — alles staat op actief = 0 (0126).
const KAARTVELDEN = [
  "kaartsoort", "voorwaarde", "aanleiding", "sleutel_bron", "prioriteit",
  "opschalen_na_uur", "opschalen_naar", "kaarttitel", "feiten", "eigenaar_bron",
  "knop1_doel", "knop1_label", "knop1_sjabloon", "knop2_doel", "knop2_label",
  "knop2_reden_verplicht", "prullenbak", "prullenbak_doel", "tweede_lezer",
  "bron", "reden",
];
for (const kolom of KAARTVELDEN) {
  const v = await q("select actief from db_field where tabel='processtap' and kolom = ?", kolom);
  eis(`het kaartveld '${kolom}' staat niet meer op het formulier`,
      v.length === 0 || Number(v[0].actief) === 0);
}
eis("en de rijen zijn niet verwijderd, alleen uitgezet",
    (await q("select count(*) n from db_field where tabel='processtap'"))[0].n >= KAARTVELDEN.length);

for (const kolom of ["kaartsoort", "knop1_doel", "knop2_doel", "sleutel_bron",
                     "prioriteit", "prullenbak_doel", "opschalen_naar", "eigenaar_bron", "bron"]) {
  eis(`de keuzelijst '${kolom}' is niet meer te kiezen`,
      (await q("select count(*) n from db_choice where tabel='processtap' and kolom = ? and actief = 1", kolom))[0].n === 0);
}

eis("de twaalf kaartdefinities staan op archief",
    (await q("select count(*) n from processtap where kaartsoort is not null and archief = 0"))[0].n === 0);
eis("het proces 'Wachtrij' ook",
    (await q("select archief from proces where id = 4"))[0].archief === 1);
eis("'Motorrondes' staat niet meer in het menu",
    (await q("select count(*) n from db_module where label = 'Motorrondes' and actief = 1"))[0].n === 0);
eis("de werkbank staat weer in het menu",
    (await q("select count(*) n from db_module where route = '/werkbank' and actief = 1"))[0].n === 1);
eis("de tabel 'motorronde' staat niet meer in de definitielaag",
    (await q("select count(*) n from db_table where naam = 'motorronde' and actief = 1"))[0].n === 0);
eis("en haar velden en keuzes ook niet",
    (await q("select count(*) n from db_field where tabel = 'motorronde' and actief = 1"))[0].n === 0
    && (await q("select count(*) n from db_choice where tabel = 'motorronde' and actief = 1"))[0].n === 0);
eis("de weergaven van motorronde en de kaartenweergave zijn uit",
    (await q("select count(*) n from db_view where (tabel = 'motorronde' or (tabel = 'processtap' and naam = 'kaarten')) and actief = 1"))[0].n === 0);
eis("de twee instellingen van de achterstandsmeter zijn gearchiveerd",
    (await q("select count(*) n from instelling where sleutel in ('achterstand_amber_uur','achterstand_rood_uur') and archief = 0"))[0].n === 0);
eis("geen favoriet of bezoek wijst nog naar de werkbank",
    (await q("select count(*) n from favoriet where route like '/werkbank%'"))[0].n === 0
    && (await q("select count(*) n from bezoek where route like '/werkbank%'"))[0].n === 0);

// Elke tabel die in de definitielaag actief staat, hoort ook ergens vandaan te
// bereiken te zijn. Precies dit gat liet 'motorronde' staan: de menuregel was
// weg, de tabel niet, en #/t/motorronde werkte gewoon nog.
const inHetMenu = new Set((await q("select doeltabel from db_module where actief = 1 and doeltabel is not null"))
  .map((m) => String(m.doeltabel)));
const ALLEEN_VIA_EEN_ANDER = new Set([
  "chartlezing", "inzending", "voorwaarde", "meting", "event", "positie_event",
  "cyclus_event", "exitplan", "publicatie", "gebruiker_voorkeur", "favoriet", "bezoek",
  // Wie een positie volgt open je vanaf die positie; wie een bericht kreeg
  // vanaf dat bericht. Een lijst van alle volgers over alle posities heen zegt
  // niets — het gaat altijd over één positie of één bericht.
  "positievolger", "publicatie_ontvanger",
]);
for (const t of await q("select naam from db_table where actief = 1")) {
  if (inHetMenu.has(String(t.naam)) || ALLEEN_VIA_EEN_ANDER.has(String(t.naam))) continue;
  eis(`de tabel '${t.naam}' staat actief in beheer, en is ook ergens te bereiken`, false);
}

eis("de instelling van de motorrondgang is gearchiveerd",
    (await q("select count(*) n from instelling where sleutel = 'motor_rondgang_seconden' and archief = 0"))[0].n === 0);

// Wat blijft moet blijven: een kaart gaat straks over een positie, en de stroom
// en de barometer zijn de basis van de nieuwe werkbank.
for (const [tabel, kolom] of [["gebeurtenis", "vraagt_antwoord"], ["gebeurtenis", "sleutel"],
                              ["gebeurtenis", "beantwoord_op"], ["barometerstand", "venster"]]) {
  eis(`${tabel}.${kolom} staat er nog`,
      (await q("select count(*) n from db_field where tabel = ? and kolom = ? and actief = 1", tabel, kolom))[0].n === 1);
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
