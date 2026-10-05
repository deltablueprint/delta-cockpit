// De motor maakt kaarten van gebeurtenissen — en maakt er nooit twee.
//
//   node scripts/proef/motor.mjs
//
// De vraag die deze proef stelt is niet "werkt het een keer" maar "overleeft
// het een cron die dubbel vuurt". Dat is de enige manier waarop dit in
// productie stuk gaat: twee ronden tegelijk, of een ronde die overnieuw moet.
import { verseDB, CYCLUS, POSITIE, MOMENT } from "./db.mjs";
import { draai, weeg, tik, voorwaardeDeugt, sleutelVoor, SLEUTELVORMEN } from "../../worker/motor.js";
import { log } from "../../worker/stroom.js";

const db = verseDB("/tmp/delta-motor-proef.sqlite");
const env = { DB: db };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;

let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } };

// ---------------------------------------------------- het slot op de voorwaarde
eis("een gewone voorwaarde mag", voorwaardeDeugt("soort = 'positie_geopend'"));
eis("een lege voorwaarde mag niet", !voorwaardeDeugt(""));
for (const stuk of ["soort = 'x'; drop table gebeurtenis",
                    "1=1 -- en de rest",
                    "soort in (select 1) union select 1",
                    "soort = 'x' /* weg */",
                    "delete from gebeurtenis",
                    "pragma foreign_keys = off"]) {
  eis(`geweigerd: ${stuk.slice(0, 30)}`, !voorwaardeDeugt(stuk));
}
eis("ongebalanceerde haakjes mogen niet", !voorwaardeDeugt("(soort = 'x'"));
eis("een hele lange voorwaarde mag niet", !voorwaardeDeugt("a=1 and ".repeat(80) + "b=2"));

// ------------------------------------------------------------ de sleutel
const definities = await q("select * from processtap where kaartsoort is not null");
for (const d of definities) {
  eis(`${d.kaartsoort}: de sleutelvorm bestaat in de motor`, SLEUTELVORMEN.includes(d.sleutel_bron));
}

// ------------------------------------------------- van gebeurtenis naar kaart
await log(env, { id: "simon" }, {
  bron: "ibkr", soort: "positie_geopend", titel: "Nieuwe tranche herkend",
  cyclus: CYCLUS, positie: POSITIE, feiten: { premie_pt: 18 },
});

let verslag = await weeg(env);
eis("er is een kaart gemaakt", verslag.kaarten === 1);
eis("er is niets overgeslagen", verslag.overgeslagen.length === 0);

let kaarten = await q("select * from gebeurtenis where vraagt_antwoord = 1");
eis("de kaart staat in de wachtrij", kaarten.length === 1);
eis("de kaart heeft een sleutel", !!kaarten[0].sleutel);
eis("de kaart weet van welke definitie hij komt", !!kaarten[0].processtap);
const definitie = (await q("select * from processtap where id = ?", kaarten[0].processtap))[0];
eis("en dat is de juiste definitie", definitie.kaartsoort === "positie_geopend");

// Geen prioriteit, geen kaarttekst: die worden afgeleid bij het lezen.
eis("de prioriteit staat niet op de gebeurtenis", !("prioriteit" in kaarten[0]));

// ------------------------------------------------------- twee keer draaien
verslag = await weeg(env);
eis("een tweede ronde maakt geen tweede kaart", verslag.kaarten === 0);
kaarten = await q("select * from gebeurtenis where vraagt_antwoord = 1");
eis("er staat er nog steeds één", kaarten.length === 1);

// ----------------------------------- dezelfde aanleiding, twee keer gemeld
// IBKR meldt de opening nog eens. Dat is echt gebeurd, dus de gebeurtenis
// blijft staan — maar het is dezelfde vraag, dus geen tweede kaart.
await log(env, { id: "simon" }, {
  bron: "ibkr", soort: "positie_geopend", titel: "Nieuwe tranche herkend",
  cyclus: CYCLUS, positie: POSITIE,
});
verslag = await weeg(env);
eis("de dubbele melding wordt geen kaart", verslag.kaarten === 0);
eis("en wordt als dubbel geteld", verslag.dubbel === 1);
eis("de gebeurtenis zelf blijft bestaan",
    (await q("select count(*) n from gebeurtenis where soort = 'positie_geopend'"))[0].n === 2);
eis("maar de wachtrij houdt er één",
    (await q("select count(*) n from gebeurtenis where vraagt_antwoord = 1"))[0].n === 1);

// ------------------------------------------------- een beantwoorde kaart
await db.prepare("update gebeurtenis set beantwoord_op = '2026-10-05 10:00:00', antwoord = 'verstuurd' where id = ?")
  .bind(kaarten[0].id).run();
const open = await q("select * from gebeurtenis where vraagt_antwoord = 1 and beantwoord_op is null");
eis("een beantwoorde kaart is uit de rij", open.length === 0);
verslag = await weeg(env);
eis("en komt niet terug", verslag.kaarten === 0);

// ---------------------------------------------------------------- de klok
// Dag 7 na de opening: één week-slag, en daarna niet nog een keer.
let slag = await tik(env, { nu: "2026-09-08T06:00:00Z" });
const weekslagen = await q("select * from gebeurtenis where soort = 'week_verstreken'");
eis("de klok schrijft hoogstens één slag per dag per cyclus", weekslagen.length <= 1);
const nogeens = await tik(env, { nu: "2026-09-08T09:00:00Z" });
eis("dezelfde dag nog eens tikken schrijft niets", nogeens.slagen === 0);
eis("en er staat er nog steeds maar één",
    (await q("select count(*) n from gebeurtenis where soort = 'week_verstreken'"))[0].n === weekslagen.length);

// ------------------------------------------------- een kapotte definitie
// Eén definitie met onzin erin mag de hele rij niet omleggen.
await db.prepare("update processtap set voorwaarde = 'soort = ; drop' where kaartsoort = 'doorrol'").run();
verslag = await draai(env, { nu: "2026-09-20T06:00:00Z" });
eis("de kapotte definitie wordt overgeslagen",
    verslag.overgeslagen.some((o) => o.kaart === "doorrol"));
eis("en de ronde loopt verder", typeof verslag.bekeken === "number");

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
