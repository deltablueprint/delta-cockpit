// De motor: van gebeurtenis naar kaart.
//
// De wachtrij is een vraag over één tabel:
//
//   select * from gebeurtenis where vraagt_antwoord = 1 and beantwoord_op is null
//
// Deze module is het enige dat die 1 erin zet. Hij kijkt naar de
// kaartdefinities op processtap (migratie 0102) en stempelt gebeurtenissen die
// aan een definitie voldoen tot kaart: vraagt_antwoord = 1, een sleutel, en een
// verwijzing naar de definitie waar hij vandaan komt.
//
// Wat hier NIET in staat is even belangrijk:
//   - geen prioriteit. Die wordt afgeleid bij het lezen, uit de definitie en de
//     leeftijd van de kaart. Een opgeslagen prioriteit veroudert niet mee en
//     staat binnen een dag te liegen.
//   - geen kaarttekst. De titel staat al op de gebeurtenis; wat de kaart toont
//     bouwt het scherm uit de definitie. Twee keer dezelfde tekst opslaan
//     betekent dat je hem twee keer moet bijwerken en dat de ene het wint.
//   - geen volgorde. Dat is een sorteerregel, geen gegeven.
//
// De motor mag twee keer draaien zonder schade. Dat is geen nette eigenschap
// maar een harde eis: een cron die een keer dubbel vuurt hoort geen tweede
// kaart op te leveren. De unieke index op gebeurtenis.sleutel bewaakt dat, en
// het stempelen slaat over wat al gestempeld is.

import { log } from "./stroom.js";

// ----------------------------------------------------------- de voorwaarde
//
// De voorwaarde van een kaartdefinitie is een stuk SQL uit de definitielaag.
// Dat is geen invoer van buiten — het staat in beheer en wij zetten het erin —
// maar het gaat wel ongelezen een query in, en dan hoort er een slot op.
//
// Toegestaan: een expressie over de kolommen van gebeurtenis. Verder niets.
const VERBODEN = /;|--|\/\*|\bdrop\b|\bdelete\b|\binsert\b|\bupdate\b|\bpragma\b|\battach\b|\bunion\b/i;

// Wat een ingerichte zoekopdracht nooit mag aanraken. Een aanleiding mag alleen
// lezen, maar lezen is hier al genoeg: wat hij teruggeeft wordt als kaarttitel
// opgeslagen en daarna aan iedereen getoond.
//
// De gebruikerstabel zelf is níét verboden — de go/no-go heeft de lijst
// deelnemers echt nodig. Wat verboden is zijn de geheimen erin, en 'select *',
// want dat sleept ze alsnog mee zonder dat iemand ze opschreef.
const GESLOTEN = /\bwachtwoord\w*\b|\bsleutel_hash\b|\bbrokerverbinding\b|\bbrokerinstelling\b|\blynx_rapport\b|select\s+\*/i;

export function voorwaardeDeugt(uitdrukking) {
  const s = String(uitdrukking || "").trim();
  if (!s) return false;
  if (s.length > 500) return false;
  if (VERBODEN.test(s)) return false;
  if (GESLOTEN.test(s)) return false;
  // Een voorwaarde selecteert gebeurtenissen op hun soort. Zonder die eis is
  // '1=1' geldig, en dan stempelt één ronde vijfhonderd willekeurige
  // gebeurtenissen tot kaart — onomkeerbaar, want er wordt niets gewist.
  if (!/\bsoort\b/.test(s)) return false;
  // Haakjes moeten sluiten, anders breekt de hele query en valt de wachtrij om
  // voor álle kaarten in plaats van alleen voor deze definitie.
  let diep = 0;
  for (const teken of s) {
    if (teken === "(") diep++;
    if (teken === ")") diep--;
    if (diep < 0) return false;
  }
  return diep === 0;
}

// ------------------------------------------------------------ de aanleiding
//
// Een aanleiding is een SELECT uit de definitielaag. Hij mag alleen lezen. Dat
// is geen formaliteit: dit is het enige stuk ingerichte tekst dat zelf bepaalt
// welke rijen de motor te zien krijgt, en als het ooit meer dan lezen kan, kan
// een vergissing in beheer gegevens kwijtmaken.
export function aanleidingDeugt(uitdrukking) {
  const s = String(uitdrukking || "").trim();
  if (!s) return false;
  // Ruim genoeg voor een echte zoekopdracht met een CASE erin; krap genoeg dat
  // niemand er een programma in schrijft.
  if (s.length > 4000) return false;
  if (!/^select\s/i.test(s)) return false;
  if (VERBODEN.test(s)) return false;
  if (GESLOTEN.test(s)) return false;
  let diep = 0;
  for (const teken of s) {
    if (teken === "(") diep++;
    if (teken === ")") diep--;
    if (diep < 0) return false;
  }
  return diep === 0;
}

// Wat een aanleiding mag teruggeven. Wat er niet in staat wordt genegeerd in
// plaats van blind in een insert geduwd.
const AANLEIDINGSKOLOMMEN = [
  "cyclus", "positie", "publicatie", "beoordelingsmoment",
  "titel", "detail", "sleuteldeel", "feiten_json", "eigenaar",
];

// -------------------------------------------------------------- de sleutel
//
// De sleutel zegt wanneer twee aanleidingen dezelfde kaart zijn. Dit is het
// enige stuk van de wachtrij dat echt goed moet zitten: zit hij te ruim, dan
// verdwijnt een kaart die had moeten openstaan; zit hij te krap, dan staat
// dezelfde vraag drie keer in de rij.
//
// De vorm staat in de definitie (sleutel_bron, een keuzelijst). De paar manieren
// om hem te bouwen staan hier, want het zijn er een handvol en ze veranderen
// niet mee met de inrichting.
const SLEUTELS = {
  // Een toestandskaart wijst zelf aan wat hem uniek maakt: de SELECT levert
  // 'sleuteldeel' mee. Een deelnemer, een moment, een voorwaarde — wat het ook
  // is, de aanleiding weet het en de motor hoeft het niet te raden.
  aanleiding:         (g, d) => `${d.kaartsoort}:${veld(g, "sleuteldeel") || "?"}`,
  positie:            (g, d) => g.positie && `${d.kaartsoort}:p${g.positie}`,
  cyclus_stand:       (g, d) => g.cyclus && `${d.kaartsoort}:c${g.cyclus}:${veld(g, "naar") || "?"}`,
  cyclus_week:        (g, d) => g.cyclus && `${d.kaartsoort}:c${g.cyclus}:w${veld(g, "week") || week(g.moment)}`,
  cyclus_moment:      (g, d) => g.cyclus && g.beoordelingsmoment && `${d.kaartsoort}:c${g.cyclus}:m${g.beoordelingsmoment}`,
  cyclus_voorwaarde:  (g, d) => g.cyclus && `${d.kaartsoort}:c${g.cyclus}:v${veld(g, "voorwaarde") || "?"}`,
  moment_deelnemer:   (g, d) => g.beoordelingsmoment && `${d.kaartsoort}:m${g.beoordelingsmoment}:${veld(g, "deelnemer") || g.aangemaakt_door || "?"}`,
  publicatie_lezer:   (g, d) => g.publicatie && `${d.kaartsoort}:b${g.publicatie}:${veld(g, "lezer") || "?"}`,
  // Met de cyclus erbij: twee cycli die in dezelfde maand lopen hebben ieder
  // hun eigen maandverslag, en zonder de cyclus viel dat samen tot één kaart.
  maand:              (g, d) => g.cyclus && `${d.kaartsoort}:c${g.cyclus}:${maandVan(g.moment)}`,
};

// De maand waarin iets viel. Leeg of onleesbaar levert null, want een sleutel
// 'maandverslag:c7:' zou één verzamelbak zijn waar alles in verdwijnt.
function maandVan(moment) {
  const m = String(moment || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}

function veld(gebeurtenis, naam) {
  if (!gebeurtenis.feiten) return null;
  try {
    const f = typeof gebeurtenis.feiten === "string" ? JSON.parse(gebeurtenis.feiten) : gebeurtenis.feiten;
    const w = f[naam];
    return w === null || w === undefined || w === "" ? null : String(w);
  } catch {
    return null;
  }
}

// Het ISO-weeknummer uit een datum, zodat 'één keer per week' ook over een
// jaargrens heen één keer per week blijft.
//
// De donderdag van een week bepaalt in welk jaar die week valt. Daarom schuiven
// we eerst naar die donderdag en rekenen we pas daarna: zo krijgt 29 december
// 2025 netjes week 2026-01 in plaats van een week 00 die niet bestaat.
function week(moment) {
  const d = new Date(`${String(moment || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "?";
  const dag = (d.getUTCDay() + 6) % 7;             // maandag = 0
  d.setUTCDate(d.getUTCDate() - dag + 3);          // de donderdag van deze week
  const jaar = d.getUTCFullYear();
  // De donderdag van week 1 van dat jaar: 4 januari valt per definitie in week 1.
  const vier = new Date(Date.UTC(jaar, 0, 4));
  vier.setUTCDate(vier.getUTCDate() - ((vier.getUTCDay() + 6) % 7) + 3);
  const nr = 1 + Math.round((d - vier) / 604800000);
  return `${jaar}-${String(nr).padStart(2, "0")}`;
}

export function sleutelVoor(gebeurtenis, definitie) {
  const maak = SLEUTELS[definitie.sleutel_bron];
  if (!maak) return null;
  const s = maak(gebeurtenis, definitie);
  return s ? String(s).slice(0, 120) : null;
}

export const SLEUTELVORMEN = Object.keys(SLEUTELS);

// ------------------------------------------------------------- de weger
//
// Per kaartdefinitie: welke gebeurtenissen voldoen, en zijn ze al kaart?
//
// Een gebeurtenis wordt hoogstens één keer gestempeld. Daarom kijkt de query
// naar processtap is null: dat is het stempel. Een gebeurtenis die al bij een
// definitie hoort wordt niet nog eens door een tweede opgepakt, ook niet als
// twee voorwaarden elkaar overlappen. De volgorde van de definities beslist
// dan, en die staat in beheer.
export async function weeg(env, { nu = null, limiet = 500 } = {}) {
  const verslag = { bekeken: 0, kaarten: 0, dubbel: 0, overgeslagen: [] };

  const definities = (await env.DB.prepare(
    `select * from processtap
      where kaartsoort is not null and archief = 0
      order by volgorde`
  ).all()).results;

  for (const d of definities) {
    if (!voorwaardeDeugt(d.voorwaarde)) {
      verslag.overgeslagen.push({ kaart: d.kaartsoort, reden: "voorwaarde deugt niet" });
      continue;
    }
    if (!SLEUTELS[d.sleutel_bron]) {
      verslag.overgeslagen.push({ kaart: d.kaartsoort, reden: `onbekende sleutelvorm ${d.sleutel_bron}` });
      continue;
    }

    let kandidaten;
    try {
      kandidaten = (await env.DB.prepare(
        `select * from gebeurtenis
          where archief = 0 and processtap is null and vraagt_antwoord = 0
            and (${d.voorwaarde})
          order by id limit ?`
      ).bind(limiet).all()).results;
    } catch (fout) {
      // Een kapotte voorwaarde mag alleen zijn eigen kaart kosten, niet de rij.
      verslag.overgeslagen.push({ kaart: d.kaartsoort, reden: `query mislukt: ${fout.message}` });
      continue;
    }

    for (const g of kandidaten) {
      verslag.bekeken++;
      const sleutel = sleutelVoor(g, d);
      if (!sleutel) {
        verslag.overgeslagen.push({ kaart: d.kaartsoort, gebeurtenis: g.id, reden: "geen sleutel te maken" });
        continue;
      }

      // Staat deze vraag al OPEN? Dan is dit dezelfde vraag. De gebeurtenis
      // blijft staan — hij is echt gebeurd — maar wordt geen tweede kaart. Het
      // stempel 'processtap' gaat er wel op, zodat de volgende ronde hem niet
      // opnieuw bekijkt.
      //
      // Bewust 'staat open' en niet 'heeft ooit bestaan': een barometer die van
      // 4 naar 5 en weer terug naar 4 gaat, hoort de tweede keer gewoon weer een
      // kaart op te leveren. Zie migratie 0113.
      const bestaat = await env.DB.prepare(
        `select id from gebeurtenis
          where sleutel = ? and vraagt_antwoord = 1 and beantwoord_op is null limit 1`
      ).bind(sleutel).first();

      if (bestaat) {
        await env.DB.prepare(
          "update gebeurtenis set processtap = ? where id = ?"
        ).bind(d.id, g.id).run();
        verslag.dubbel++;
        continue;
      }

      try {
        await env.DB.prepare(
          `update gebeurtenis
              set vraagt_antwoord = 1, sleutel = ?, processtap = ?, eigenaar = ?
            where id = ? and vraagt_antwoord = 0`
        ).bind(sleutel, d.id, await eigenaarVoor(env, g, d), g.id).run();
        verslag.kaarten++;
      } catch (fout) {
        // De unieke index won: twee ronden tegelijk. Dat is precies wat hij
        // hoort te doen, en het is geen fout.
        verslag.dubbel++;
      }
    }
  }

  return verslag;
}

// --------------------------------------------------------------- de klok
//
// Niet elke kaart begint bij iets dat gebeurde. 'Er is een week voorbij' is
// geen melding van IBKR en geen handeling van ons — er gebeurde juist niets.
//
// De klok schrijft die stilte als gebeurtenis, zodat de weger er daarna
// hetzelfde mee kan doen als met al het andere. Het zijn er met opzet weinig:
// kalenderslagen, geen toestandscontroles. Een kaart die moet kijken of iets
// nog openstaat hoort te wachten tot het scherm bestaat waar je hem beantwoordt.
// 'Elke 7 dagen' klopt voor een week. Voor een maand klopt het niet: elke 30
// dagen schuift op, en dan krijgt februari geen maandverslag en mei twee. De
// maandslag kijkt daarom naar de kalender en niet naar een aantal dagen.
const SLAGEN = [
  { soort: "week_verstreken", elke: 7, titel: (c) => `Een week zonder bericht — ${c.label}` },
];

// --------------------------------------------------------- de toestanden
//
// Niet elke kaart begint bij iets dat gebeurde. Een go/no-go waarin jouw stem
// ontbreekt, een besluit dat niet is vastgelegd, charts die niet gelezen zijn —
// daar is geen gebeurtenis van, er is alleen een toestand die blijft hangen.
//
// De melder zoekt die toestanden op met de SELECT die in de definitie staat, en
// schrijft er een gebeurtenis van. Daarna doet de weger er hetzelfde mee als met
// al het andere: één pad, geen tweede soort kaart.
export async function meld(env, { nu = null } = {}) {
  const verslag = { gemeld: 0, gesloten: 0, overgeslagen: [] };

  const definities = (await env.DB.prepare(
    `select * from processtap
      where kaartsoort is not null and archief = 0 and aanleiding is not null
      order by volgorde`
  ).all()).results;

  for (const d of definities) {
    if (!aanleidingDeugt(d.aanleiding)) {
      verslag.overgeslagen.push({ kaart: d.kaartsoort, reden: "de aanleiding deugt niet" });
      continue;
    }

    let rijen;
    try {
      rijen = (await env.DB.prepare(d.aanleiding).all()).results;
    } catch (fout) {
      // Een kapotte aanleiding kost alleen zijn eigen kaart, niet de ronde.
      verslag.overgeslagen.push({ kaart: d.kaartsoort, reden: `aanleiding mislukt: ${fout.message}` });
      continue;
    }

    // De aanleiding is de waarheid, in twee richtingen.
    //
    // Een toestandskaart is geen vraag maar een constatering: 'de charts zijn
    // nog niet gelezen'. Lees je ze, dan is de constatering niet meer waar en
    // hoort de kaart weg — niet omdat iemand hem beantwoordde, maar omdat het
    // werk gedaan is. Hem laten staan tot iemand hem wegklikt betekent dat de
    // werkbank iets beweert dat niet klopt, en dat is precies wat een werkbank
    // niet mag doen.
    //
    // Dit geldt alleen voor kaarten mét een aanleiding. Een kaart die vraagt
    // 'zullen we dit de leden vertellen?' lost nooit vanzelf op: daar is het
    // antwoord het punt, ook als het antwoord 'nee' is.
    const nogWaar = new Set(
      rijen.map((r) => {
        const deel = r.sleuteldeel === null || r.sleuteldeel === undefined ? null : String(r.sleuteldeel);
        return deel ? `${d.kaartsoort}:${deel}`.slice(0, 120) : null;
      }).filter(Boolean)
    );

    const openKaarten = (await env.DB.prepare(
      `select id, sleutel from gebeurtenis
        where processtap = ? and vraagt_antwoord = 1 and beantwoord_op is null and archief = 0`
    ).bind(d.id).all()).results;

    for (const k of openKaarten) {
      if (nogWaar.has(k.sleutel)) continue;
      await env.DB.prepare(
        `update gebeurtenis
            set beantwoord_op = ?, antwoord = 'vanzelf opgelost', wachten_tot = null
          where id = ? and beantwoord_op is null`
      ).bind(
        nu ? new Date(nu).toISOString().slice(0, 19).replace("T", " ")
           : new Date().toISOString().slice(0, 19).replace("T", " "),
        k.id
      ).run();
      verslag.gesloten++;
    }

    for (const r of rijen.slice(0, 200)) {
      // De sleutel wordt hier al gebouwd, want zonder hem weten we niet of deze
      // toestand al een kaart heeft — en dan schrijven we elke ronde opnieuw
      // dezelfde gebeurtenis, ook als de weger er daarna niets mee doet.
      const deel = r.sleuteldeel === null || r.sleuteldeel === undefined ? null : String(r.sleuteldeel);
      if (!deel) {
        verslag.overgeslagen.push({ kaart: d.kaartsoort, reden: "de aanleiding wijst niets aan als sleutel" });
        continue;
      }
      const sleutel = `${d.kaartsoort}:${deel}`.slice(0, 120);

      const al = await env.DB.prepare(
        `select id from gebeurtenis
          where sleutel = ? and vraagt_antwoord = 1 and beantwoord_op is null limit 1`
      ).bind(sleutel).first();
      if (al) continue;

      // feiten_json is tekst uit de definitielaag. Komt er onzin uit, dan gaat
      // de kaart gewoon door zonder feiten.
      let feiten = { sleuteldeel: deel };
      if (r.feiten_json) {
        try { feiten = { ...JSON.parse(r.feiten_json), sleuteldeel: deel }; } catch { /* dan alleen het deel */ }
      }

      // In één insert, met sleutel en stempel er meteen op. Eerst schrijven en
      // dan stempelen gaf twee manieren om het mis te laten gaan: de unieke
      // index kon op de losse update stuk gaan (en dan bleef er een gebeurtenis
      // zonder sleutel achter, die de volgende ronde opnieuw geschreven werd),
      // en de ronde brak dan af voordat de weger had gedraaid.
      const id = await log(env, null, {
        bron: "klok", soort: `${d.kaartsoort}_open`,
        cyclus: kies(r, "cyclus"), positie: kies(r, "positie"),
        publicatie: kies(r, "publicatie"), beoordelingsmoment: kies(r, "beoordelingsmoment"),
        titel: r.titel || d.naam,
        detail: r.detail || null,
        feiten,
        moment: nu ? new Date(nu).toISOString().slice(0, 19).replace("T", " ") : null,
        sleutel, vraagt_antwoord: 1, processtap: d.id,
        eigenaar: d.eigenaar_bron === "aanleiding" ? kies(r, "eigenaar") : null,
      });
      // log() vangt zijn eigen fouten op en geeft null terug. Dat is hier geen
      // zwijgen maar precies goed: botst de sleutel met een ronde die tegelijk
      // liep, dan is de kaart er al en hoeft er niets te gebeuren.
      if (!id) continue;
      verslag.gemeld++;
    }
  }

  return verslag;
}

// Van wie is deze kaart? De definitie zegt waar het antwoord vandaan komt; de
// paar manieren om het op te zoeken staan hier, want het zijn er drie en ze
// veranderen niet mee met de inrichting.
//
// Niemand is een geldig antwoord: het meeste werk is van ons samen, en een
// kaart die van niemand is, is van ons allemaal.
async function eigenaarVoor(env, gebeurtenis, definitie) {
  switch (definitie.eigenaar_bron) {
    case "aanleiding":
      return veld(gebeurtenis, "eigenaar") || veld(gebeurtenis, "deelnemer") || null;
    case "nalezer": {
      // De lezer staat in de feiten van de gebeurtenis die om nalezen vroeg, en
      // anders op het bericht zelf.
      const uitFeiten = veld(gebeurtenis, "lezer");
      if (uitFeiten) return uitFeiten;
      if (!gebeurtenis.publicatie) return null;
      const p = await env.DB.prepare("select nalezer from publicatie where id = ?")
        .bind(gebeurtenis.publicatie).first().catch(() => null);
      return p ? p.nalezer : null;
    }
    default:
      return null;
  }
}

function kies(rij, naam) {
  if (!AANLEIDINGSKOLOMMEN.includes(naam)) return null;
  const w = rij[naam];
  return w === null || w === undefined || w === "" ? null : w;
}

export async function tik(env, { nu = null } = {}) {
  const vandaag = (nu ? new Date(nu) : new Date()).toISOString().slice(0, 10);
  const verslag = { slagen: 0 };

  const cycli = (await env.DB.prepare(
    `select id, label, geopend_op from cyclus
      where archief = 0 and status not in ('afgesloten', 'geannuleerd')`
  ).all()).results;

  for (const c of cycli) {
    const sinds = dagenTussen(c.geopend_op, vandaag);
    if (sinds === null) continue;

    for (const slag of SLAGEN) {
      if (sinds < slag.elke) continue;

      // Niet 'sinds % 7 === 0' maar 'het is zeven dagen geleden dat we dit
      // laatst sloegen'. Dat eerste kost een hele week zodra de cron één dag
      // mist, en een cron die een dag mist is geen uitzondering maar iets
      // waar je op moet rekenen.
      const laatste = await env.DB.prepare(
        `select max(substr(moment, 1, 10)) as dag from gebeurtenis
          where cyclus = ? and soort = ?`
      ).bind(c.id, slag.soort).first();

      const geleden = laatste && laatste.dag
        ? dagenTussen(laatste.dag, vandaag)
        : sinds;
      if (geleden === null || geleden < slag.elke) continue;

      const id = await schrijfSlag(env, c, slag, vandaag, sinds);
      if (id) verslag.slagen++;
    }

    // De maandslag kijkt naar de kalender en niet naar een aantal dagen. Elke 30
    // dagen schuift op: dan krijgt februari geen maandverslag en mei twee, en
    // allebei botsen ze met een sleutel die over kalendermaanden gaat.
    if (vandaag.slice(8, 10) === "01" && sinds >= 1) {
      const slag = { soort: "maand_verstreken", titel: (x) => `De maand is om — ${x.label}` };
      const id = await schrijfSlag(env, c, slag, vandaag, sinds);
      if (id) verslag.slagen++;
    }
  }

  return verslag;
}

async function schrijfSlag(env, c, slag, vandaag, sinds) {
  // Een cron die twee keer op een dag vuurt mag niet twee keer dezelfde stilte
  // opschrijven. De weger zou er één kaart van maken en de ander als dubbel
  // wegzetten — dat klopt, maar dan staat de stroom vol ruis.
  const al = await env.DB.prepare(
    `select id from gebeurtenis
      where cyclus = ? and soort = ? and substr(moment, 1, 10) = ? limit 1`
  ).bind(c.id, slag.soort, vandaag).first();
  if (al) return null;

  return log(env, null, {
    bron: "klok", soort: slag.soort, cyclus: c.id,
    titel: slag.titel(c),
    detail: `${sinds} dagen sinds de opening.`,
    feiten: { week: week(vandaag), maand: vandaag.slice(0, 7), dagen: sinds },
    moment: `${vandaag} 06:00:00`,
  });
}

function dagenTussen(van, tot) {
  const a = new Date(`${String(van || "").slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${String(tot || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.floor((b - a) / 86400000);
}

// Eén ronde: eerst de klok, dan de weging. In die volgorde, zodat wat de klok
// vandaag schrijft dezelfde ronde nog een kaart wordt.
// Een ronde. Wat hij doet hangt af van waaróm hij draait:
//
//   cron  — alles: de klok, de toestanden, de weging. Eén keer per uur.
//   brug  — alleen wegen. Er kwam net iets binnen van IBKR; dat moet nu een
//           kaart worden. De klok heeft daar niets te zoeken, en de brug duwt
//           bij elke tik van de TWS-verbinding — dat kunnen er veel per minuut
//           zijn, en dan hoort er niet elke keer een rondgang over alle cycli
//           en alle toestandsvragen overheen te gaan.
export async function draai(env, opties = {}) {
  const begin = Date.now();
  const aanleiding = opties.aanleiding || "cron";
  // Wat deze ronde doet, hangt af van waarom hij draait.
  //
  //   mens   — een handeling van iemand kan een toestand gemaakt hebben: de
  //            toestanden en de weging, meteen. De kalender heeft er niets mee
  //            te maken.
  //   brug   — de hartslag. Wegen is goedkoop en gebeurt bij elke tik. De
  //            rondgang langs de kalender en alle toestandsvragen is duurder,
  //            en gaat daarom hoogstens elke 'motor_rondgang_seconden'.
  //   cron   — alles, altijd. Bestaat nog voor het geval de brug ooit geen
  //            betrouwbare klok blijkt; er staat geen trigger meer op.
  const metDeHand = opties.klok === false || aanleiding === "mens";
  const volledig = metDeHand ? false
    : aanleiding === "cron" ? true
    : await rondgangNodig(env);
  const toestanden_ook = aanleiding !== "brug" || volledig;

  let uit = { slagen: 0, gemeld: 0, bekeken: 0, kaarten: 0, dubbel: 0, overgeslagen: [] };
  let fout = null;

  try {
    const klok = volledig ? await tik(env, opties) : { slagen: 0 };
    const toestanden = toestanden_ook ? await meld(env, opties) : { gemeld: 0, overgeslagen: [] };
    const weging = await weeg(env, opties);
    uit = {
      ...weging, ...klok,
      gemeld: toestanden.gemeld,
      gesloten: toestanden.gesloten || 0,
      overgeslagen: (weging.overgeslagen || []).concat(toestanden.overgeslagen || []),
    };
  } catch (f) {
    fout = f && f.message ? f.message : String(f);
  }

  // Elke ronde laat een spoor na, ook een mislukte. Een wachtrij die te leeg is
  // ziet eruit als rust; dit is het enige waaraan je ziet dat het dat niet was.
  //
  // Niet élke ronde: de brug duwt veel vaker dan er iets gebeurt, en een tabel
  // vol lege rondes maakt juist onzichtbaar wat je zoekt. Een ronde die niets
  // deed en op niets stuitte, laat alleen een spoor na als de klok hem begon —
  // want juist dán is 'er gebeurde niets' het bericht.
  // Een volledige rondgang laat altijd een spoor na — anders weet de volgende
  // niet wanneer de vorige was, en draait hij elke tien seconden opnieuw alles.
  // Een kale weegronde alleen als hij iets vond.
  const demoeite = volledig || fout
    || uit.kaarten > 0 || uit.gemeld > 0 || uit.gesloten > 0
    || (uit.overgeslagen || []).length > 0;

  // Het schrijven mag de ronde zelf nooit laten mislukken.
  try {
    if (!demoeite) throw new Error("niets te melden");
    await env.DB.prepare(
      `insert into motorronde
         (begonnen_op, geeindigd_op, aanleiding, gelukt, slagen, gemeld, bekeken,
          kaarten, dubbel, overgeslagen, fout, duur_ms)
       values (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      new Date(begin).toISOString().slice(0, 19).replace("T", " "),
      aanleiding, fout ? 0 : 1,
      uit.slagen || 0, uit.gemeld || 0, uit.bekeken || 0,
      uit.kaarten || 0, uit.dubbel || 0,
      (uit.overgeslagen || []).length ? JSON.stringify(uit.overgeslagen).slice(0, 2000) : null,
      fout, Date.now() - begin
    ).run();
  } catch { /* het verslag is geen voorwaarde voor het werk */ }

  if (fout) return { ...uit, fout };
  return uit;
}

// Is de volledige rondgang weer aan de beurt? De hartslag komt elke tien
// seconden langs; de kalender en de toestandsvragen hoeven niet elke keer.
//
// Staat de instelling gelijk aan de hartslag, dan gebeurt alles meteen — en dat
// is de stand waarop hij geleverd wordt. Hoger zetten is de knop om aan te
// draaien als de database het te druk krijgt, niet eerder.
async function rondgangNodig(env) {
  try {
    const r = await env.DB.prepare(
      "select waarde from instelling where sleutel = 'motor_rondgang_seconden' and archief = 0"
    ).first();
    const elke = Number(r && r.waarde);
    if (!Number.isFinite(elke) || elke <= 0) return true;

    const laatste = await env.DB.prepare(
      `select begonnen_op from motorronde
        where aanleiding in ('brug', 'cron') and gelukt = 1
        order by id desc limit 1`
    ).first();
    if (!laatste || !laatste.begonnen_op) return true;

    const toen = new Date(`${String(laatste.begonnen_op).replace(" ", "T")}Z`);
    if (Number.isNaN(toen.getTime())) return true;
    return (Date.now() - toen.getTime()) / 1000 >= elke;
  } catch {
    // Weten we het niet, dan liever een rondgang te veel dan een kaart te laat.
    return true;
  }
}

// Wanneer de motor voor het laatst gedraaid heeft, en of dat goed ging. Eén
// regel, bedoeld om boven aan een scherm te staan.
export async function motorstand(env) {
  try {
    const laatste = await env.DB.prepare(
      "select begonnen_op, gelukt, fout, kaarten, gemeld from motorronde order by id desc limit 1"
    ).first();
    if (!laatste) return { ooit: false };
    return {
      ooit: true,
      wanneer: laatste.begonnen_op,
      gelukt: !!laatste.gelukt,
      fout: laatste.fout || null,
      kaarten: laatste.kaarten,
      gemeld: laatste.gemeld,
    };
  } catch {
    return { ooit: false };
  }
}

// --------------------------------------------------- na een wijziging
//
// De klokronde draait elk uur. Voor het meeste is dat ruim op tijd, maar niet
// voor een toestand die een mens zojuist heeft gemaakt: je zet een
// beoordelingsmoment op 'blind inzenden' omdat het gesprek nú begint, en dan
// hoort de kaart 'jouw stem ontbreekt' er binnen een seconde te staan — niet
// over negenenvijftig minuten.
//
// Welke tabellen ertoe doen staat niet in deze code. Het staat in de
// aanleidingen zelf: noemt er een de tabel die net gewijzigd is, dan kan er iets
// veranderd zijn dat een kaart oplevert. Richt iemand morgen een nieuwe
// aanleiding in over een andere tabel, dan werkt dit vanzelf mee.
let tabellenInAanleidingen = null;

export async function raaktEenAanleiding(env, tabel) {
  const naam = String(tabel || "").trim();
  if (!naam) return false;
  try {
    if (!tabellenInAanleidingen) {
      const r = await env.DB.prepare(
        "select aanleiding from processtap where aanleiding is not null and archief = 0"
      ).all();
      tabellenInAanleidingen = r.results.map((x) => String(x.aanleiding).toLowerCase());
    }
    const woord = new RegExp(`\\b${naam.toLowerCase().replace(/[^a-z0-9_]/g, "")}\\b`);
    return tabellenInAanleidingen.some((a) => woord.test(a));
  } catch {
    // Weten we het niet, dan draaien we liever een ronde te veel dan een kaart
    // te laat. Een ronde is goedkoop; een gemiste go/no-go niet.
    return true;
  }
}

// Een korte ronde na een handeling van een mens: de toestanden opnieuw bekijken
// en wegen, zonder de klok. Bedoeld om in ctx.waitUntil te hangen, zodat het
// antwoord op het scherm er niet op hoeft te wachten.
export async function naWijziging(env, tabel) {
  if (!(await raaktEenAanleiding(env, tabel))) return null;
  try {
    return await draai(env, { aanleiding: "mens", klok: false });
  } catch {
    return null;
  }
}
