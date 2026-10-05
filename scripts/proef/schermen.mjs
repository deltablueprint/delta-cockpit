// De schermen vragen alleen wat er is, en bieden alleen aan wat mag.
//
//   node scripts/proef/schermen.mjs
//
// Er is geen browser, dus getekend wordt er niets. Wat wel te controleren valt
// is het enige wat hier stuk gaat: een scherm dat een route aanroept die niet
// bestaat, een knop die aangeboden wordt in een stand waarin hij niet mag, en
// een route die nergens in het menu of in een ander scherm te bereiken is.
import { readFileSync } from "node:fs";
import { verseDB, CYCLUS, POSITIE } from "./db.mjs";
import { conceptUitKaart, vraagNalezen, geefVrij, stuurTerug } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";
import { huidig, stelVast } from "../../worker/barometer.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-schermen-proef.sqlite");
const env = { DB: db };
const simon = { id: "simon" };
const jacq = { id: "jacqueline" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

const opsteller = readFileSync("app/src/opsteller.js", "utf8");
const api = readFileSync("app/src/api.js", "utf8");
const main = readFileSync("app/src/main.js", "utf8");
const css = readFileSync("app/src/stijl.css", "utf8");

// ------------------------------------------------------------- de routes
eis("main.js kent /bericht/:id", main.includes("berichtRoute"));
eis("main.js kent /werkbank", main.includes('pad === "/werkbank"'));
eis("main.js roept de opsteller aan", main.includes("opstellerscherm(inhoud, kruimel,"));

// Een scherm dat nergens vandaan te bereiken is, bestaat niet.

// ------------------------------------- elke aanroep komt ergens op een route
//
// Dit is de controle die ontbrak toen de kaartlaag eruit ging. Er werden drie
// routes mee weggeknipt die niets met de kaartlaag te maken hadden — nalezen,
// vrijgeven en terugsturen — en niets viel om: de proeven riepen de functies in
// worker/bericht.js rechtstreeks aan, dus die bleven groen. Alleen de weg
// ernaartoe was weg. Een scherm dat erop drukte had HTML teruggekregen waar het
// JSON verwachtte, en het vierogenprincipe was onbereikbaar.
//
// Dus beide richtingen: elk pad dat app/src/api.js aanroept komt in
// worker/index.js ergens op uit, en elke route die de worker aanbiedt wordt
// ergens gebruikt.
const worker = readFileSync("worker/index.js", "utf8");

// Wat de worker aanbiedt: letterlijke paden en patronen.
const letterlijk = [...worker.matchAll(/pad === "([^"]+)"/g)].map((m) => m[1]);
const patronen = [...worker.matchAll(/pad\.match\(\/(.*?)\/([gimsuy]*)\)/g)].map((m) => {
  try { return new RegExp(m[1].replace(/\\\//g, "/"), m[2]); } catch { return null; }
}).filter(Boolean);
eis(`de worker biedt routes aan (${letterlijk.length} vast, ${patronen.length} met een patroon)`,
    letterlijk.length > 10 && patronen.length > 3);

// Wat de schermen aanroepen. Een ${...} wordt een 1, ook als er accolades in
// staan; de queryreeks telt niet mee.
// Een `${...}` kan van alles worden: een tabelnaam, een getal, of niets (een
// queryreeks die er soms wel en soms niet is). Daarom proberen we alle drie, en
// is het pad goed zodra één invulling op een route uitkomt.
const stukken = (tekst) => {
  const uit = []; let vast = "", i = 0;
  while (i < tekst.length) {
    if (tekst[i] === "$" && tekst[i + 1] === "{") {
      let diep = 1; i += 2;
      while (i < tekst.length && diep > 0) {
        if (tekst[i] === "{") diep++;
        else if (tekst[i] === "}") diep--;
        i++;
      }
      uit.push(vast); vast = ""; uit.push(null);      // null = hier stond een invoeging
    } else vast += tekst[i++];
  }
  uit.push(vast);
  return uit;
};

const invullingen = (tekst) => {
  let paden = [""];
  for (const stuk of stukken(tekst)) {
    paden = stuk === null
      ? paden.flatMap((p) => ["1", "tabel", ""].map((w) => p + w))
      : paden.map((p) => p + stuk);
  }
  return [...new Set(paden.map((p) => p.split("?")[0]))];
};

const aanroepen = [...api.matchAll(/haal\(\s*`([^`]+)`/g)]
  .map((m) => invullingen(m[1]))
  .filter((paden) => paden.some((p) => p.startsWith("/api/")));
eis(`de schermen roepen routes aan (${aanroepen.length})`, aanroepen.length > 10);

const kent = (pad) => letterlijk.includes(pad) || patronen.some((r) => r.test(pad));
for (const paden of aanroepen) {
  eis(`api.js roept ${paden[0]} aan, en de worker kent dat pad`, paden.some(kent));
}

// En andersom. Een route die niemand aanroept is dode code, of het spoor van
// iets dat half verwijderd is. Wat er met opzet bij staat, staat hier met naam
// en reden — zo is de schuld zichtbaar in plaats van stil.
const GEEN_SCHERM = {
  "/api/lynx/rapport": "de brug levert hier het Flex-rapport af",
  "/api/lynx/diagnose": "diagnose, met de hand opgevraagd",
};
for (const pad of letterlijk) {
  if (pad.startsWith("/api/brug")) continue;        // de brug is geen scherm
  if (GEEN_SCHERM[pad]) continue;
  eis(`de worker biedt ${pad} aan, en een scherm gebruikt dat`,
      aanroepen.some((paden) => paden.includes(pad)) || api.includes(pad));
}

// Elke api-functie die een scherm importeert, bestaat.
for (const [naam, tekst] of [["opsteller", opsteller], ["werkbank", readFileSync("app/src/werkbank.js", "utf8")]]) {
  const stuk = (tekst.match(/import \{([^}]+)\} from "\.\/api\.js"/s) || [])[1] || "";
  for (const f of stuk.split(",").map((x) => x.trim().split(" as ")[0]).filter(Boolean)) {
    eis(`${naam}: api.js exporteert ${f}`, new RegExp(`export const ${f}\\b`).test(api));
  }
}

// ----------------------------------- de standen waarin een knop mag bestaan
//
// Dit is het hart van deze proef. De opsteller biedt per stand andere knoppen
// aan, en de worker weigert wat niet mag. Die twee moeten hetzelfde vinden,
// anders staat er een knop die bij het indrukken een foutmelding geeft.
await log(env, simon, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche verdwenen bij de broker",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-01 10:00:00",
});
const gesloten = await log(env, simon, {
  bron: "ibkr", soort: "positie_gesloten", titel: "Tranche verdwenen bij de broker",
  cyclus: CYCLUS, positie: POSITIE, moment: "2026-09-01 10:01:00",
});
await db.prepare("update gebeurtenis set vraagt_antwoord = 1 where id = ?").bind(gesloten).run();
const { publicatie } = await conceptUitKaart(env, simon, gesloten, "sluiting");
await db.prepare("update publicatie set tekst = 'De positie is gesloten.' where id = ?").bind(publicatie).run();

const stand = async () => (await q("select status from publicatie where id = ?", publicatie))[0].status;

// concept: versturen mag, vrijgeven niet, terugsturen niet.
eis("in concept staat het op concept", (await stand()) === "concept");
eis("vrijgeven kan niet vanuit concept", !!(await geefVrij(env, simon, publicatie)).fout);
eis("de opsteller biedt vrijgeven dan ook niet aan in concept",
    opsteller.includes('p.status === "nalezen"') && opsteller.includes("opvrij"));

// nalezen: de opsteller mag niet versturen, de lezer wel vrijgeven.
await vraagNalezen(env, simon, publicatie, "jacqueline");
eis("het ligt bij de nalezer", (await stand()) === "nalezen");
eis("de opsteller kan niet versturen", !!(await verstuurPublicatie(env, simon, publicatie)).fout);
eis("een derde geeft niet vrij", !!(await geefVrij(env, { id: "pieter" }, publicatie)).fout);
eis("het scherm toont alleen de lezer de vrijgeefknop", opsteller.includes("ikBenDeLezer"));
eis("en zegt de anderen waarom er niets kan", opsteller.includes("opwacht"));

// terugsturen vraagt een reden, en het scherm vraagt die ook.
eis("terugsturen zonder reden kan niet", !!(await stuurTerug(env, jacq, publicatie, "")).fout);
eis("het scherm vraagt om die reden", opsteller.includes("opredenvak") && opsteller.includes("Wat moet eraan?"));

await geefVrij(env, jacq, publicatie);
eis("na vrijgeven staat het op klaar", (await stand()) === "klaar");
const weg = await verstuurPublicatie(env, simon, publicatie);
eis("en dan mag het weg", !weg.fout);
eis("verstuurd", (await stand()) === "verstuurd");

// Verstuurd: alles dicht. Het scherm toont dan geen enkele actie.
eis("de opsteller zet alles vast als het verstuurd is", opsteller.includes("const dicht = p.status ===") );
eis("en toont wanneer en door wie", opsteller.includes("verstuurdRegel"));
eis("er is geen wisknop op de opsteller", !/wissen|verwijder/i.test(opsteller.replace(/^\/\/.*$/gm, "")));

// ------------------------------------------------------ de barometer
// Het losse barometerscherm is weg: het was een tweede weg om een stand te
// zetten, langs de regel dat de barometer slaapt tot het venster op 'In
// positie' staat. Eén handeling, één weg. De werkbank doet het nu.
const b = await huidig(env, CYCLUS);
eis("het scherm krijgt de schaal mee", b.schaal.length === 5);
eis("en de vensters", b.vensters.length === 6);
const wb = readFileSync("app/src/werkbank.js", "utf8");
eis("de werkbank bouwt de namen uit wat ze kreeg, niet uit een eigen lijst",
    wb.includes("data.barometer.schaal") && wb.includes("data.venster.verloop"));
eis("er staat geen vaste standnaam in het scherm",
    !/Niets|Meekijken|Paraat|Dichtbij blijven|Comfortabel|Onder druk|Vrijwel afgerond|Veilig|Aandacht/.test(wb));

await stelVast(env, simon, { cyclus: CYCLUS, stand: 2, venster: "open", reden: "Rustig." });
const herhaald = await stelVast(env, simon, { cyclus: CYCLUS, stand: 2, venster: "open", reden: "Nog eens." });
eis("dezelfde stand nog eens vastleggen kan niet", !!herhaald.fout);

const na = await huidig(env, CYCLUS);
eis("vastleggen is niet melden", na.gelijk === false);

// --------------------------------- blauw is vastgelegd, groen is nog niet weg
//
// Twee randen met twee betekenissen. Lopen ze door elkaar, dan weet je op het
// drukste moment van de maand niet of een stand al bij de leden ligt.
const wbcss = css;
eis("de stand zoals hij vastligt heeft een blauw kader",
    /\.vhok\.nu \{[^}]*var\(--blue\)/.test(wbcss));
eis("wat je net koos heeft een groen kader",
    /\.vhok\.gekozen \{[^}]*var\(--grn\)/.test(wbcss));
eis("en dat geldt ook voor de regels naast de meter",
    /\.lreg\.nu \{[^}]*var\(--blue\)/.test(wbcss) && /\.lreg\.gekozen \{[^}]*var\(--grn\)/.test(wbcss));
eis("het systeemvoorstel blijft een stippellijn, en geen van beide kleuren",
    /\.lreg\.tip \{[^}]*dashed/.test(wbcss));
// Het venster krijgt geen voorstel: het is een oordeel over de markt, en juist
// dat is voor een lid het meeste waard (BOUWSPEC §13a). Daarom staat er ook
// geen stippellijn op een venstervakje.
eis("het venster stelt zichzelf niet voor", !/vensterTip/.test(readFileSync("app/src/werkbank.js", "utf8")));

const wbtekst = readFileSync("app/src/werkbank.js", "utf8");
eis("de meter tekent het gekozen vak groen, niet blauw",
    /if \(gekozen\) svg \+=[^;]*stroke="#1F5E45"/.test(wbtekst));

// ------------------------------------------------------------- de opmaak
for (const klasse of ["opsteller", "opfeiten", "opacties", "werkbank", "vensterrij", "meterrij", "spoorbalk", "publiceerbalk"]) {
  eis(`de opmaak kent .${klasse}`, css.includes(`.${klasse}`));
}
// Alles wat in de schermen een klasse krijgt, moet ook opmaak hebben; anders
// staat er een vak zonder rand of een knop zonder knopvorm.
for (const tekst of [opsteller, readFileSync("app/src/werkbank.js", "utf8")]) {
  const klassen = [...tekst.matchAll(/class="(op|baro)([a-z]*)"/g)].map((m) => m[1] + m[2]);
  for (const k of [...new Set(klassen)]) {
    eis(`.${k} heeft opmaak`, css.includes(`.${k}`));
  }
}

// ------------------------------- een scherm dat weg is, schrijft niet meer
//
// De werkbank peilt elke tien seconden. Klik je intussen door naar een ander
// scherm, dan tikt die klok gewoon door — en tekende hij zichzelf over het
// scherm waar je inmiddels was. Dat zag eruit als een omleiding, maar het was
// erger: op een formulier waar je in zat te typen was je je werk kwijt.
//
// Niet 'komt de wacht ergens voor' — dat is te makkelijk waar. De wacht moet de
// eerste regel zijn van alles wat later nog iets tekent: de klok die afgaat, en
// het antwoord dat terugkomt. Een eerdere versie van deze proef telde alleen
// vóórkomens, en liet daardoor precies de fout door die hij moest vangen.
const werkbank = readFileSync("app/src/werkbank.js", "utf8");

eis("de werkbank weet of hij nog de levende is", werkbank.includes("leeftNog"));
eis("de controle kijkt naar de route",
    werkbank.includes('location.hash.slice(1).split("?")[0] === "/werkbank"'));
eis("en naar het bezoek, zodat twee werkbanken elkaar niet overschrijven",
    werkbank.includes("dit === bezoek"));

const naSetTimeout = werkbank.split(/await new Promise\(\(r\) => setTimeout\(r, \d+\)\);/)[1] || "";
eis("de klok kijkt als eerste of dit scherm nog bestaat",
    /^\s*if \(!leeftNog\(\)\) return;/.test(naSetTimeout));

const naHetAntwoord = werkbank.split(/const uit = await haalWerkbank\([^)]*\);/)[1] || "";
eis("en na het antwoord opnieuw, want ondertussen kan er geklikt zijn",
    /^\s*if \(!leeftNog\(\)\) return;/.test(naHetAntwoord));

const naTeken = werkbank.split(/\n  function teken\(\) \{/)[1] || "";
eis("tekenen gebeurt niet meer na vertrek",
    /^\s*if \(!leeftNog\(\)\) return;/.test(naTeken));

// En het scherm mag niet onder je handen vandaan hertekenen terwijl je een
// stand aan het kiezen bent.
eis("een peiling laat een lopende keuze met rust",
    /if \(kiesStand === null && kiesVenster === null\) await haal\(\);/.test(werkbank));

// Elke luisteraar op het document moet zichzelf opruimen, anders peilen er na
// tien keer openen tien tegelijk.
for (const bestand of ["werkbank.js", "opsteller.js"]) {
  const t = readFileSync(`app/src/${bestand}`, "utf8");
  const erbij = (t.match(/document\.addEventListener\(/g) || []).length;
  const eraf = (t.match(/document\.removeEventListener\(/g) || []).length;
  eis(`${bestand}: elke luisteraar op het document ruimt zichzelf op (${erbij} erbij, ${eraf} eraf)`,
      erbij === 0 || eraf >= 1);
}

// Een scherm met een timer moet die kunnen stoppen, óf na elke tik controleren
// of het nog bestaat. Dat tweede is hier het sterkere: een clearTimeout werkt
// alleen als iemand hem aanroept op de goede plek, terwijl een lus die zichzelf
// elke ronde afvraagt of hij nog mag bestaan niet vergeten kan worden.
for (const bestand of ["werkbank.js", "opsteller.js"]) {
  const t = readFileSync(`app/src/${bestand}`, "utf8");
  if (!/setTimeout|setInterval/.test(t)) continue;
  eis(`${bestand}: een timer wordt gestopt of kijkt na elke tik of het scherm nog bestaat`,
      /clearTimeout|clearInterval/.test(t) || /leeftNog\(\)/.test(t));
}

// ------------------------------------------- elke import bestaat ook echt
//
// `vite build` waarschuwt hierover maar bouwt gewoon door, en de deploy slaagt.
// Je merkt het pas als het scherm bij een gebruiker wit blijft. Eén keer gebeurd:
// een scherm importeerde ICOON uit ikonen.js, dat die naam niet exporteert.
import { readdirSync as lees } from "node:fs";

const bestanden = lees("app/src").filter((f) => f.endsWith(".js"));
for (const bestand of bestanden) {
  const tekst = readFileSync(`app/src/${bestand}`, "utf8");
  for (const m of tekst.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/([a-z0-9_.-]+)["']/gis)) {
    const namen = m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const bron = m[2].endsWith(".js") ? m[2] : `${m[2]}.js`;
    if (!bestanden.includes(bron)) {
      eis(`${bestand}: importeert uit ${bron}, en dat bestaat`, false);
      continue;
    }
    const bronTekst = readFileSync(`app/src/${bron}`, "utf8");
    for (const naam of namen) {
      eis(`${bestand}: ${bron} exporteert ${naam}`,
          new RegExp(`export\\s+(const|let|var|function|async function|class)\\s+${naam}\\b`).test(bronTekst)
          || new RegExp(`export\\s*\\{[^}]*\\b${naam}\\b`).test(bronTekst));
    }
  }
}

// --------------------------------------------- één knophoogte, overal
//
// Er was een modifier 'klein' van 26 px. Zodra er ergens een kleine naast een
// gewone kwam te staan — en dat gebeurde in de kop van elke gerelateerde lijst —
// stonden er twee hoogtes naast elkaar. Per plek repareren helpt niet: de
// volgende knop die iemand toevoegt heeft het probleem weer.
//
// Dus: geen enkele regel mag de hoogte van een knop veranderen. Deze proef
// zoekt niet naar één naam maar naar het gedrag.
const knopregels = [...css.matchAll(/([^{}]*\.knop[^{}]*)\{([^}]*)\}/g)];
const hoogtes = new Set();
for (const [, kiezer, blok] of knopregels) {
  const h = /(?:^|[;\s])height\s*:\s*([^;]+)/.exec(blok);
  if (!h) continue;
  // De icoonknop is vierkant en deelt dezelfde regel; die telt mee, niet apart.
  hoogtes.add(h[1].trim());
  eis(`'${kiezer.trim()}' zet geen afwijkende knophoogte`, h[1].trim() === "30px");
}
eis(`er is precies één knophoogte (${[...hoogtes].join(", ") || "geen"})`, hoogtes.size === 1);
eis("de modifier 'klein' bestaat niet meer", !css.includes(".knop.klein"));

for (const bestand of lees("app/src").filter((f) => f.endsWith(".js"))) {
  const t = readFileSync(`app/src/${bestand}`, "utf8");
  eis(`${bestand}: gebruikt geen knop-klein meer`, !/knop[^"']*\bklein\b/.test(t));
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
