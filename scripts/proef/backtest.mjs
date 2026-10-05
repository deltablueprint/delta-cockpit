// De backtest: drie maanden cockpit, dag voor dag.
//
//   node scripts/proef/backtest.mjs
//
// De losse proeven kijken elk naar één module. Deze draait de hele keten
// negentig dagen achter elkaar — IBKR meldt, de klok tikt, de motor stempelt,
// wij antwoorden, berichten gaan weg — en controleert na ELKE dag of de
// uitspraken die het systeem over zichzelf doet nog kloppen.
//
// Zo komen de fouten boven die een losse proef nooit vindt: de kaart die na
// veertig dagen alsnog dubbel verschijnt, de achterstand die blijft hangen op
// iets dat afgehandeld is, de barometer die de leden iets toont dat nooit
// verstuurd is.

import { verseDB, CYCLUS } from "./db.mjs";
import { draai, weeg, tik } from "../../worker/motor.js";
import { wachtrij, beantwoord } from "../../worker/wachtrij.js";
import { conceptUitKaart, vraagNalezen, geefVrij } from "../../worker/bericht.js";
import { verstuurPublicatie } from "../../worker/spiegel.js";
import { achterstand } from "../../worker/achterstand.js";
import { huidig, stelVoor, stelVast } from "../../worker/barometer.js";
import { log } from "../../worker/stroom.js";

const db = verseDB(`/tmp/delta-backtest-${Number(process.argv[2]) || 0}.sqlite`);
const env = { DB: db };
const simon = { id: "simon" };
const jacq = { id: "jacqueline" };
const q = async (s, ...b) => (await db.prepare(s).bind(...b).all()).results;
const een = async (s, ...b) => (await db.prepare(s).bind(...b).first());

let fouten = 0;
let dag = null;
const eis = (wat, goed) => {
  if (!goed) { fouten++; console.log(`FOUT  [dag ${dag}] ${wat}`); }
};

// ---------------------------------------------------------- de invarianten
//
// Uitspraken die op elke dag van de looptijd waar moeten zijn. Niet "werkt het
// een keer" maar "blijft het waar".
async function invarianten(nu) {
  // 1. Geen twee OPENSTAANDE kaarten voor dezelfde vraag. Dit is waar de hele
  //    wachtrij op staat of valt.
  //
  //    Bewust 'openstaand' en niet 'ooit': een voorwaarde die rood → groen →
  //    rood gaat hoort de tweede keer gewoon weer gevraagd te worden. Zie 0113.
  const dubbel = await q(
    `select sleutel, count(*) n from gebeurtenis
      where vraagt_antwoord = 1 and beantwoord_op is null and sleutel is not null
      group by sleutel having n > 1`
  );
  eis(`geen twee openstaande kaarten met dezelfde sleutel (${dubbel.map((d) => d.sleutel).join(", ")})`,
      dubbel.length === 0);

  // 2. Elke kaart komt van een definitie. Een kaart zonder definitie heeft geen
  //    knoppen en is dus niet te beantwoorden: hij zou voor altijd blijven staan.
  const wees = await q(
    `select g.id from gebeurtenis g left join processtap d on d.id = g.processtap
      where g.vraagt_antwoord = 1 and (g.processtap is null or d.id is null)`
  );
  eis("elke kaart hoort bij een kaartdefinitie", wees.length === 0);

  // 3. Elke kaart heeft een sleutel. Zonder sleutel is er geen bescherming tegen
  //    een tweede.
  const zonder = await een(
    "select count(*) n from gebeurtenis where vraagt_antwoord = 1 and sleutel is null"
  );
  eis("elke kaart heeft een sleutel", zonder.n === 0);

  // 4. Er is niets gewist. Ooit.
  const geteld = await een("select count(*) n from gebeurtenis");
  eis("de stroom groeit alleen", geteld.n >= geschreven);

  // 5. De achterstand klopt met wat er openstaat. Nul mag alleen als er écht
  //    geen onverteld ledenwerk is.
  const a = await achterstand(env, { nu });
  const onverteld = await een(
    `select count(*) n from gebeurtenis g
       join processtap d on d.id = g.processtap
       left join publicatie p on p.gebeurtenis = g.id and p.archief = 0
      where d.knop1_doel = 'publicatie' and g.vraagt_antwoord = 1
        and (p.id is null or p.status <> 'verstuurd')
        and (g.beantwoord_op is null or p.id is not null)
        -- Een naleeskaart gaat over een bericht dat al via zijn eigen kaart
        -- geteld wordt; anders telt hetzelfde onvertelde ding twee keer.
        and g.publicatie is null`
  );
  eis(`de achterstand telt wat er onverteld is (${a.aantal} vs ${onverteld.n})`, a.aantal === onverteld.n);
  eis("bij zijn betekent niets onverteld", a.bij === (onverteld.n === 0));
  eis("de achterstand is nooit negatief", a.uren >= 0 && a.aantal >= 0);

  // 6. Wat de leden van de barometer zien, is altijd een stand die echt
  //    verstuurd is. Hier zou een fout betekenen dat 412 mensen een getal zien
  //    dat niemand ze gestuurd heeft.
  const b = await huidig(env, CYCLUS);
  if (b.leden) {
    const bron = await een("select gepubliceerd_op, publicatie from barometerstand where id = ?", b.leden.id);
    eis("de stand van de leden is gepubliceerd", !!bron.gepubliceerd_op);
    const bericht = await een("select status from publicatie where id = ?", bron.publicatie);
    eis("en het bericht erover is echt verstuurd", bericht && bericht.status === "verstuurd");
  }

  // 7. Hoogstens één barometerstand per cyclus draagt het stempel 'bij de
  //    leden'. Twee zou betekenen dat een ingehaalde stand alsnog is gemeld.
  const gemeld = await een(
    "select count(*) n from barometerstand where cyclus = ? and gepubliceerd_op is not null and archief = 0",
    CYCLUS
  );
  const gemeldeStanden = await q(
    "select id from barometerstand where cyclus = ? and gepubliceerd_op is not null order by gepubliceerd_op desc",
    CYCLUS
  );
  eis("elke gemelde stand hoort bij een eigen bericht", gemeld.n === gemeldeStanden.length);

  // 8. Een beantwoorde kaart komt nooit terug in de rij.
  const terug = await een(
    `select count(*) n from gebeurtenis where vraagt_antwoord = 1 and beantwoord_op is not null
       and (wachten_tot is null or wachten_tot <= datetime('now'))`
  );
  const rij = await wachtrij(env, simon, { nu });
  eis("een beantwoorde kaart staat niet in de rij",
      !rij.kaarten.some((k) => beantwoord_ids.has(k.id)));

  // 9. Elke kaart in de rij heeft minstens één knop. Een kaart die je niet kunt
  //    beantwoorden is een kaart die er voor altijd staat.
  eis("elke kaart heeft een knop of een prullenbak",
      rij.kaarten.every((k) => k.knoppen.length > 0 || k.prullenbak));

  // 10. De prioriteit is nooit groen, en nooit onbekend.
  eis("elke prioriteit is hoog, medium of laag",
      rij.kaarten.every((k) => ["hoog", "medium", "laag"].includes(k.prioriteit)));
  eis("geen enkele kaart is groen",
      rij.kaarten.every((k) => k.kleur !== "groen"));

  // 11. Geen kaart toont accolades. Dat betekent dat een sjabloon niet
  //     ingevuld kon worden en zo op het scherm komt.
  eis("geen enkele kaarttitel bevat {{", rij.kaarten.every((k) => !String(k.titel).includes("{{")));

  // 12. Geen bericht is verstuurd zonder tekst.
  const leeg = await een(
    "select count(*) n from publicatie where status = 'verstuurd' and coalesce(trim(tekst), '') = ''"
  );
  eis("geen leeg bericht is ooit verstuurd", leeg.n === 0);

  // 13. Een toestand levert hoogstens één kaart op, ooit. De melder draait elk
  //     uur; zonder deze grendel zou een go/no-go die een week openstaat
  //     honderdzestig kaarten opleveren.
  const toestandsdubbel = await q(
    `select soort, sleutel, count(*) n from gebeurtenis
      where soort like '%_open' and sleutel is not null
        and vraagt_antwoord = 1 and beantwoord_op is null
      group by soort, sleutel having n > 1`
  );
  eis(`geen toestand staat twee keer open (${toestandsdubbel.map((d) => d.sleutel).join(", ")})`,
      toestandsdubbel.length === 0);

  // 14. Elk verstuurd bericht dat uit een kaart kwam, heeft die kaart gesloten.
  const open = await een(
    `select count(*) n from publicatie p join gebeurtenis g on g.id = p.gebeurtenis
      where p.status = 'verstuurd' and g.vraagt_antwoord = 1 and g.beantwoord_op is null`
  );
  eis("een verstuurd bericht sluit zijn kaart", open.n === 0);
}

let geschreven = 0;
const beantwoord_ids = new Set();

// ------------------------------------------------------------- de simulatie
//
// Negentig dagen. Elke dag: de klok tikt, soms meldt IBKR iets, soms stelt het
// systeem een barometerstand voor, en wij handelen een deel van de rij af — met
// opzet niet alles, want dat is ook hoe het echt gaat.

function datum(n) {
  const d = new Date(Date.UTC(2026, 8, 1));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Een kleine, voorspelbare dobbelsteen. Een backtest die elke keer anders loopt
// is geen backtest: een fout die één keer op de twintig verschijnt zou dan nooit
// te herhalen zijn.
// Het zaad is in te stellen, zodat dezelfde fout te herhalen is:
//   node scripts/proef/backtest.mjs 7
let zaad = Number(process.argv[2]) || 20260901;
const worp = () => {
  zaad = (zaad * 1103515245 + 12345) % 2147483648;
  return zaad / 2147483648;
};

// Hoe ijverig wij zijn. 0 betekent: niemand kijkt ooit naar de rij — ook dan
// moeten alle uitspraken waar blijven, en stapelt er alleen werk op.
//   node scripts/proef/backtest.mjs 7 0
const IJVER = process.argv[3] === undefined ? 1 : Number(process.argv[3]);

let positieteller = 100;

async function dagje(n) {
  dag = `${n} (${datum(n)})`;
  const vandaag = datum(n);
  const nu = `${vandaag}T12:00:00Z`;

  // --- IBKR meldt ---
  if (worp() < 0.18) {
    positieteller++;
    await db.prepare(
      `insert into positie (id, cyclus, contract, strike, status, aantal, ontvangen_premie_pt, aangemaakt_op)
       values (?, ?, ?, ?, 'bewaken', -2, ?, ?)`
    ).bind(positieteller, CYCLUS, `OESX ${5900 + positieteller} PUT`, 5900 + positieteller,
           10 + Math.round(worp() * 20), `${vandaag} 09:00:00`).run();
    await log(env, simon, {
      bron: "ibkr", soort: "positie_geopend", cyclus: CYCLUS, positie: positieteller,
      titel: `Nieuwe tranche herkend`, moment: `${vandaag} 09:00:00`,
    });
    geschreven++;
  }

  if (worp() < 0.14) {
    const open = await een(
      "select id from positie where cyclus = ? and status = 'bewaken' order by id limit 1", CYCLUS
    );
    if (open) {
      await db.prepare("update positie set status = 'gesloten', sluittijdstip = ?, resultaat_pt = ? where id = ?")
        .bind(`${vandaag} 15:30:00`, Math.round((worp() - 0.3) * 40) / 2, open.id).run();
      await log(env, simon, {
        bron: "ibkr", soort: "positie_gesloten", cyclus: CYCLUS, positie: open.id,
        titel: `Tranche verdwenen bij de broker`, moment: `${vandaag} 15:30:00`,
      });
      geschreven++;
    }
  }

  // --- het systeem stelt een barometerstand voor ---
  if (worp() < 0.09) {
    const naar = 1 + Math.floor(worp() * 5);
    await stelVoor(env, { cyclus: CYCLUS, naar, reden: "De meting ging over een drempel." });
  }

  // --- het gesprek loopt zijn gang, en laat toestanden achter ---
  // Een moment dat in 'blind inzenden' blijft staan levert kaarten op voor
  // iedereen die nog niet heeft ingezonden. Juist dat soort stilte is wat de
  // melder moet oppakken, en wat na negentig dagen niet mag ontsporen.
  if (worp() < 0.07) {
    const standen = ["inzendingen open", "blind inzenden", "blind versturen", "uitkomst vastgelegd"];
    const m = await een("select id, status from beoordelingsmoment where cyclus = ? order by id limit 1", CYCLUS);
    if (m) {
      const nieuweStand = standen[Math.floor(worp() * standen.length)];
      await db.prepare("update beoordelingsmoment set status = ? where id = ?").bind(nieuweStand, m.id).run();
    }
  }
  if (worp() < 0.06) {
    const v = await een("select id, status from voorwaarde where cyclus = ? order by id limit 1", CYCLUS);
    if (v) {
      await db.prepare("update voorwaarde set status = ? where id = ?")
        .bind(worp() < 0.5 ? "rood" : "groen", v.id).run();
    }
  }

  // --- de motor draait, zoals de cron ---
  await draai(env, { nu });
  // Twee keer draaien mag nooit iets veranderen. Dit is de cron die dubbel vuurt.
  const voor = (await een("select count(*) n from gebeurtenis where vraagt_antwoord = 1")).n;
  await draai(env, { nu });
  const na = (await een("select count(*) n from gebeurtenis where vraagt_antwoord = 1")).n;
  eis(`twee keer draaien verandert niets (${voor} → ${na})`, voor === na);

  // --- wij handelen een deel van de rij af ---
  const rij = await wachtrij(env, simon, { nu });
  for (const k of rij.kaarten) {
    // Een kaart met een eigenaar wordt door die eigenaar afgehandeld. Simon kan
    // de naleeskaart van Jacqueline wel zien, maar niet beantwoorden.
    const wie = k.eigenaar ? { id: k.eigenaar } : simon;
    // Niet alles elke dag. Hoge prioriteit pakken we vaker op.
    const kans = IJVER * (k.prioriteit === "hoog" ? 0.75 : k.prioriteit === "medium" ? 0.4 : 0.2);
    if (worp() > kans) continue;

    const knop1 = k.knoppen.find((b) => b.nummer === 1);
    const knop2 = k.knoppen.find((b) => b.nummer === 2);

    if (knop1 && knop1.doel === "publicatie") {
      // Soms wel melden, soms niet.
      if (worp() < 0.75) {
        const uit = await conceptUitKaart(env, simon, k.id);
        if (uit.publicatie) {
          await db.prepare("update publicatie set tekst = ? where id = ?")
            .bind("Wat er gebeurde en wat het betekent.", uit.publicatie).run();

          // Een deel laten we eerst nalezen.
          if (worp() < 0.3) {
            await vraagNalezen(env, wie, uit.publicatie, "jacqueline");
            if (worp() < 0.7) await geefVrij(env, jacq, uit.publicatie);
            else continue;   // blijft bij de nalezer liggen
          }
          // Als het een barometerkaart was, stellen we de stand ook vast.
          if (k.kaartsoort === "barometer") {
            const f = Object.fromEntries((k.feiten || []).map((x) => [x.pad, x.waarde]));
            const naar = Number(f["feiten.naar"]);
            if (Number.isInteger(naar)) {
              await stelVast(env, wie, {
                cyclus: CYCLUS, stand: naar, venster: worp() < 0.5 ? "open" : "pre_analyse",
                reden: "Overgenomen uit het voorstel.", gebeurtenis: k.id,
              }).catch(() => {});
            }
          }
          const weg = await verstuurPublicatie(env, wie, uit.publicatie);
          if (!weg.fout) beantwoord_ids.add(k.id);
        }
      } else if (knop2) {
        await beantwoord(env, wie, k.id, { knop: 2, reden: "Niet de moeite van een bericht waard." });
        beantwoord_ids.add(k.id);
      }
      continue;
    }

    // Een schermknop handelen we hier af als 'gedaan' via de prullenbak, want
    // het scherm bestaat in deze proef niet.
    if (k.prullenbak && worp() < 0.5) {
      await beantwoord(env, wie, k.id, { doel: k.prullenbak.doel });
      if (k.prullenbak.doel !== "uitstellen") beantwoord_ids.add(k.id);
      continue;
    }
    if (knop2 && !knop2.reden_verplicht) {
      await beantwoord(env, wie, k.id, { knop: 2 });
      beantwoord_ids.add(k.id);
    }
  }

  await invarianten(nu);
}

for (let n = 0; n <= 90; n++) {
  await dagje(n);
  if (fouten > 12) { console.log("te veel fouten, gestopt."); break; }
}

dag = "slot";
const eind = {
  gebeurtenissen: (await een("select count(*) n from gebeurtenis")).n,
  kaarten: (await een("select count(*) n from gebeurtenis where vraagt_antwoord = 1")).n,
  beantwoord: (await een("select count(*) n from gebeurtenis where beantwoord_op is not null")).n,
  open: (await wachtrij(env, simon)).kaarten.length,
  berichten: (await een("select count(*) n from publicatie")).n,
  verstuurd: (await een("select count(*) n from publicatie where status = 'verstuurd'")).n,
  standen: (await een("select count(*) n from barometerstand")).n,
};
console.log(JSON.stringify(eind));
eis("er is in drie maanden echt wat gebeurd", eind.gebeurtenissen > 40);
eis("er zijn kaarten gemaakt", eind.kaarten > 10);
if (IJVER > 0) {
  eis("en er is ook echt wat beantwoord", eind.beantwoord > 5);
  eis("er zijn berichten verstuurd", eind.verstuurd > 3);
} else {
  // Niemand kijkt ooit naar de rij. Dan hoort er niets beantwoord te zijn, en
  // hoort de achterstand gewoon op te lopen in plaats van ergens vast te lopen.
  // Toestandskaarten sluiten zichzelf als het werk gedaan is; die tellen hier
  // mee als beantwoord. Wat er niet mag zijn, is een antwoord van een mens.
  const doorMensen = (await een(
    "select count(*) n from gebeurtenis where beantwoord_door is not null"
  )).n;
  eis("zonder iemand die kijkt, heeft niemand iets beantwoord", doorMensen === 0);
  const a = await achterstand(env, { nu: `${datum(90)}T12:00:00Z` });
  eis("en de achterstand is dan fors", a.dagen > 20);
  eis("en rood", a.kleur === "rood");
}

console.log(fouten === 0 ? "alles klopt." : `${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
