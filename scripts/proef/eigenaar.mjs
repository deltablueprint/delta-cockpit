// Een kaart met een eigenaar is van die ene persoon.
//
//   node scripts/proef/eigenaar.mjs
//
// Het gevaar dat dit moet wegnemen: Pieter klikt de kaart 'jouw stem ontbreekt'
// van Jacqueline weg. De sleutel is dan bezet, en zij wordt nooit meer gevraagd.
// Haar stem ontbreekt in een besluit dat wél doorgaat.
import { verseDB, CYCLUS, MOMENT, POSITIE } from "./db.mjs";
import { meld, weeg } from "../../worker/motor.js";
import { wachtrij, beantwoord, stand } from "../../worker/wachtrij.js";
import { conceptUitKaart, vraagNalezen } from "../../worker/bericht.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-eigenaar-proef.sqlite");
const env = { DB: db };
const simon = { id: "simon" };
const jacq = { id: "jacqueline" };
const pieter = { id: "pieter" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// -------------------------------------------------- de go/no-go per persoon
await db.prepare("update beoordelingsmoment set status = 'blind inzenden' where id = ?").bind(MOMENT).run();
await meld(env);

const kaarten = await q("select id, eigenaar, sleutel from gebeurtenis where soort = 'gonogo_open'");
eis("elke deelnemer heeft een eigen kaart", kaarten.length === 3);
eis("en elke kaart heeft een eigenaar", kaarten.every((k) => !!k.eigenaar));
eis("en dat zijn drie verschillende mensen",
    new Set(kaarten.map((k) => k.eigenaar)).size === 3);

const vanJacq = kaarten.find((k) => k.eigenaar === "jacqueline");

// Dit is de kern: Pieter mag hem zien, maar niet beantwoorden.
const rijVanPieter = await wachtrij(env, pieter);
const bijPieter = rijVanPieter.kaarten.find((k) => k.id === vanJacq.id);
eis("Pieter ziet de kaart van Jacqueline wel", !!bijPieter);
eis("maar hij is niet van hem", bijPieter && bijPieter.van_mij === false);
eis("en het scherm weet van wie wel", bijPieter && bijPieter.eigenaar === "jacqueline");

const poging = await beantwoord(env, pieter, vanJacq.id, { knop: 1 });
eis("Pieter kan hem niet beantwoorden", !!poging.fout);
eis("en de kaart staat er nog",
    (await wachtrij(env, jacq)).kaarten.some((k) => k.id === vanJacq.id));

const echt = await beantwoord(env, jacq, vanJacq.id, { knop: 1 });
eis("Jacqueline kan het wel", !echt.fout);

// --------------------------------------------------------- van mij en alles
const alles = await wachtrij(env, pieter, { van: "alles" });
const mij = await wachtrij(env, pieter, { van: "mij" });
eis("'alles' toont meer dan 'van mij'", alles.kaarten.length > mij.kaarten.length);
eis("'van mij' toont niets van een ander",
    mij.kaarten.every((k) => !k.eigenaar || k.eigenaar === "pieter"));

// Werk dat van ons samen is, staat in ieders rij. Dat is het meeste werk, en
// het wegfilteren zou de wachtrij leeg laten lijken.
await log(env, simon, {
  bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS, positie: POSITIE,
  titel: "Tranche verdwenen bij de broker",
});
await weeg(env);
const gedeeld = (await wachtrij(env, pieter, { van: "mij" })).kaarten
  .find((k) => k.kaartsoort === "positie_gesloten");
eis("werk van ons samen staat ook onder 'van mij'", !!gedeeld);
eis("en is door iedereen te beantwoorden", gedeeld && gedeeld.van_mij === true);

// ------------------------------------------------------ de naleeskaart
const concept = await conceptUitKaart(env, simon, gedeeld.id);
await db.prepare("update publicatie set tekst = 'Iets.' where id = ?").bind(concept.publicatie).run();
await vraagNalezen(env, simon, concept.publicatie, "jacqueline");
await weeg(env);

const naleeskaart = (await wachtrij(env, jacq, { van: "alles" })).kaarten
  .find((k) => k.kaartsoort === "nalezen");
eis("er is een naleeskaart", !!naleeskaart);
eis("en die ligt bij de nalezer", naleeskaart && naleeskaart.eigenaar === "jacqueline");
eis("de opsteller kan hem niet beantwoorden",
    !!(await beantwoord(env, simon, naleeskaart.id, { knop: 1 })).fout);
eis("de nalezer wel ziet dat hij van haar is",
    (await wachtrij(env, jacq, { van: "mij" })).kaarten.some((k) => k.id === naleeskaart.id));

// -------------------------------------------------------------- de stand
const standPieter = await stand(env, pieter, {});
const standJacq = await stand(env, jacq, {});
eis("de stand telt open kaarten", standPieter.open > 0);
eis("en apart wat van jou is", typeof standPieter.van_mij === "number");
eis("Jacqueline heeft meer van zichzelf dan Pieter", standJacq.van_mij >= standPieter.van_mij);
eis("het merk verandert als er iets gebeurt", typeof standPieter.merk === "string");
const voor = (await stand(env, simon, {})).merk;
await beantwoord(env, simon, gedeeld.id, { doel: "afsluiten" });
eis("en echt ook", (await stand(env, simon, {})).merk !== voor);

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
