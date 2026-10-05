// De kaartdefinities staan in de database, niet in de code.
//
//   node scripts/proef/kaartdefinitie.mjs
//
// Deze proef kijkt niet of de kaarten mooi zijn — dat kan een proef niet. Hij
// kijkt of elke definitie compleet genoeg is dat de motor er straks blind op
// kan draaien: een titel, een voorwaarde, een sleutel, een prioriteit die
// bestaat, en minstens één knop. Een halve definitie levert later een kaart
// op die niemand kan beantwoorden, en dat merk je dan pas in productie.
import { verseDB } from "./db.mjs";

const db = verseDB("/tmp/delta-kaart-proef.sqlite");
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

const kaarten = await q("select * from processtap where kaartsoort is not null order by volgorde");
eis("er zijn kaartdefinities", kaarten.length >= 12);

// Op volgorde, want de proef rekent met de stand in de rij: hoog, medium, laag.
const prios = (await q("select waarde from db_choice where tabel='processtap' and kolom='prioriteit' order by volgorde")).map((r) => r.waarde);
const bronnen = (await q("select waarde from db_choice where tabel='processtap' and kolom='bron'")).map((r) => r.waarde);
const sleutels = (await q("select waarde from db_choice where tabel='processtap' and kolom='sleutel_bron'")).map((r) => r.waarde);
const soorten = (await q("select waarde from db_choice where tabel='processtap' and kolom='kaartsoort'")).map((r) => r.waarde);
const bakdoelen = (await q("select waarde from db_choice where tabel='processtap' and kolom='prullenbak_doel'")).map((r) => r.waarde);

for (const k of kaarten) {
  const n = k.naam;
  eis(`${n}: kaartsoort bestaat als keuze`, soorten.includes(k.kaartsoort));
  eis(`${n}: bron bestaat als keuze`, bronnen.includes(k.bron));
  eis(`${n}: heeft een voorwaarde`, !!(k.voorwaarde || "").trim());
  eis(`${n}: sleutel bestaat als keuze`, sleutels.includes(k.sleutel_bron));
  eis(`${n}: prioriteit bestaat als keuze`, prios.includes(k.prioriteit));
  eis(`${n}: heeft een kaarttitel`, !!(k.kaarttitel || "").trim());
  eis(`${n}: heeft een reden`, !!(k.reden || "").trim());
  eis(`${n}: heeft minstens één knop`, !!(k.knop1_label || "").trim());
  eis(`${n}: knop 2 heeft een doel als hij een label heeft`, !k.knop2_label || !!k.knop2_doel);
  eis(`${n}: prullenbak heeft een doel als hij getoond wordt`,
      !k.prullenbak || bakdoelen.includes(k.prullenbak_doel));
  // Groen betekent in dit systeem 'in orde'. Een kaart die openstaat is dat niet.
  const kleur = (await q("select kleur from db_choice where tabel='processtap' and kolom='prioriteit' and waarde=?", k.prioriteit))[0];
  eis(`${n}: prioriteit is niet groen`, kleur && kleur.kleur !== "groen");
  // Opschalen mag nooit naar beneden gaan.
  if (k.opschalen_naar) {
    eis(`${n}: opschalen gaat omhoog`,
        prios.indexOf(k.opschalen_naar) <= prios.indexOf(k.prioriteit));
    eis(`${n}: opschalen heeft een termijn`, Number(k.opschalen_na_uur) > 0);
  }
  if (k.feiten) {
    let lijst = null;
    try { lijst = JSON.parse(k.feiten); } catch { /* blijft null */ }
    eis(`${n}: feiten is een json-lijst`, Array.isArray(lijst) && lijst.length > 0);
  }
}

// Twee kaarten met dezelfde soort zouden om dezelfde gebeurtenis vechten.
const soortenInGebruik = kaarten.map((k) => k.kaartsoort);
eis("elke kaartsoort komt één keer voor", new Set(soortenInGebruik).size === soortenInGebruik.length);

// Het proces 'Wachtrij' mag door geen enkel recordscherm opgepikt worden: de
// stappenlijst van een record zoekt op toepassing = <tabelnaam>.
const wachtrij = (await q("select * from proces where naam = 'Wachtrij'"))[0];
eis("het proces Wachtrij bestaat", !!wachtrij);
eis("de toepassing is geen tabelnaam", wachtrij && wachtrij.toepassing === "wachtrij");
const tabellen = (await q("select naam from db_table")).map((t) => t.naam);
eis("geen tabel heet zo", !tabellen.includes("wachtrij"));
eis("alle kaarten hangen onder dat proces", kaarten.every((k) => k.proces === wachtrij.id));

// Een gewone processtap is niet aangeraakt.
const gewoon = await q("select count(*) n from processtap where kaartsoort is null");
eis("de bestaande processtappen staan er nog", gewoon[0].n > 0);

// Elke nieuwe kolom is ook een veld in de definitielaag, anders is hij
// onzichtbaar in beheer en dus niet in te richten.
const velden = (await q("select kolom from db_field where tabel='processtap' and actief=1")).map((v) => v.kolom);
for (const kolom of ["kaartsoort","bron","voorwaarde","sleutel_bron","prioriteit","opschalen_na_uur",
                     "opschalen_naar","reden","kaarttitel","feiten","knop1_label","knop1_doel",
                     "knop1_sjabloon","knop2_label","knop2_doel","knop2_reden_verplicht",
                     "prullenbak","prullenbak_doel","tweede_lezer"]) {
  eis(`${kolom} staat in de definitielaag`, velden.includes(kolom));
}

// Elk keuzeveld heeft ook keuzes, anders is de lijst leeg bij het inrichten.
const keuzevelden = await q("select kolom from db_field where tabel='processtap' and type='keuze' and actief=1");
for (const v of keuzevelden) {
  const n = (await q("select count(*) n from db_choice where tabel='processtap' and kolom=?", v.kolom))[0].n;
  eis(`${v.kolom} heeft keuzes`, n > 0);
}

for (const k of kaarten.filter((k) => k.tweede_lezer)) {
  const n = (await q("select count(*) n from gebruiker where id = ?", k.tweede_lezer))[0].n;
  eis(`${k.naam}: de tweede lezer bestaat`, n === 1);
}

const uitzicht = (await q("select * from db_view where tabel='processtap' and naam='kaarten'"))[0];
eis("de lijstweergave 'kaarten' bestaat", !!uitzicht);
if (uitzicht) {
  const kolommen = JSON.parse(uitzicht.kolommen);
  eis("die weergave toont alleen bestaande kolommen",
      kolommen.every((k) => velden.includes(k) || ["naam"].includes(k)));
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
