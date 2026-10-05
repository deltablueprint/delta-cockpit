// De wachtrij: wat er nu van ons gevraagd wordt.
//
// Eén vraag over één tabel:
//
//   select * from gebeurtenis where vraagt_antwoord = 1 and beantwoord_op is null
//
// Alles daarnaast is afleiding. De prioriteit, de titel, de feiten en de
// knoppen worden hier gebouwd uit de kaartdefinitie (§3.2b) en de gebeurtenis,
// bij elke aanroep opnieuw. Niets daarvan wordt opgeslagen, want het verandert
// mee: een kaart van vanmorgen is vanavond dringender geworden zonder dat er
// iets aan hem is gebeurd.

import { urenSinds, alsTekst } from "./tijd.js";

const RANG = { hoog: 0, medium: 1, laag: 2 };
export const PRIORITEITEN = Object.keys(RANG);

// ---------------------------------------------------------- de prioriteit
//
// De definitie zegt waar een kaart begint. De tijd doet de rest: staat hij
// langer open dan 'opschalen_na_uur', dan schuift hij op naar 'opschalen_naar'.
//
// Rood, amber, grijs — nooit groen. Groen betekent in dit systeem overal 'in
// orde', en een kaart die openstaat is dat juist niet.
export function prioriteitVan(definitie, urenOpen) {
  // Een prioriteit die we niet kennen is geen 'laag'. Dat zou een kaart die
  // verkeerd is ingericht grijs onderaan zetten, precies waar je hem niet ziet.
  // Medium: zichtbaar genoeg om op te vallen, niet zo luid dat een vergissing
  // in beheer de hele rij rood kleurt.
  const bekend = RANG[String(definitie.prioriteit || "").toLowerCase()];
  const begin = bekend === undefined ? 1 : bekend;
  const naar = RANG[String(definitie.opschalen_naar || "").toLowerCase()];
  const na = Number(definitie.opschalen_na_uur);
  const uren = Number.isFinite(Number(urenOpen)) ? Number(urenOpen) : 0;

  let rang = begin;
  if (naar !== undefined && na > 0 && uren >= na) rang = Math.min(rang, naar);

  const naam = Object.keys(RANG).find((k) => RANG[k] === rang) || "medium";
  return {
    prioriteit: naam,
    kleur: naam === "hoog" ? "rood" : naam === "medium" ? "amber" : "grijs",
    // Alleen opgeschaald als hij ook echt omhoog ging. 'kritiek' met opschalen
    // naar 'hoog' meldde eerder een opschaling die nooit had plaatsgevonden.
    opgeschaald: rang < begin,
    onbekend: bekend === undefined,
  };
}

// ------------------------------------------------------------- de tekst
//
// De titel van een kaart staat als sjabloon in de definitie: "Positie gesloten:
// {{positie.naam}}". Wat er niet ingevuld kan worden valt weg in plaats van als
// {{...}} op het scherm te blijven staan — een kaart met een gat erin leest nog;
// een kaart met accolades leest als een storing.
const PLAATSHOUDER = /\{\{\s*([a-z0-9_]+)\.([a-z0-9_]+)\s*\}\}/gi;

export function vulIn(sjabloon, gegevens) {
  if (!sjabloon) return null;
  const uit = String(sjabloon).replace(PLAATSHOUDER, (heel, groep, naam) => {
    const bron = gegevens[groep];
    if (!bron) return "";
    const w = bron[naam];
    return w === null || w === undefined ? "" : String(w);
  });
  return uit.replace(/\s{2,}/g, " ").trim() || null;
}

// De feiten staan als lijst van verwijzingen in de definitie:
//   ["positie.naam", "positie.resultaat_pt"]
// Wat leeg is komt er niet in. Een feitenvak met 'onbekend' erin is erger dan
// een feitenvak met drie regels.
export function feitenVan(definitie, gegevens) {
  let paden;
  try {
    paden = JSON.parse(definitie.feiten || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(paden)) return [];

  return paden.map((pad) => {
    const [groep, naam] = String(pad).split(".");
    const bron = gegevens[groep] || {};
    const w = bron[naam];
    return { pad, label: label(naam), waarde: w === undefined || w === "" ? null : w };
  }).filter((f) => f.waarde !== null && f.waarde !== undefined);
}

function label(naam) {
  const s = String(naam).replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ------------------------------------------------------------- de kaarten
//
// Eén query haalt de kaarten en hun definitie op. De rest — positie, cyclus,
// publicatie — komt er in één slag bij, niet per kaart: twintig kaarten mogen
// geen zestig losse vragen aan de database worden.
export async function wachtrij(env, ik, { cyclus = null, nu = null, van = "alles" } = {}) {
  const moment = nu ? new Date(nu) : new Date();

  // Het bericht dat uit deze kaart is voortgekomen, als het er is. Zonder dat
  // ziet een kaart waarvan het concept al bij een nalezer ligt er precies zo uit
  // als een verse kaart, en biedt het scherm 'Bericht opstellen' nog een keer
  // aan — een knop die dan niets doet.
  const rijen = (await env.DB.prepare(
    `select g.*,
            b.id as bericht, b.status as bericht_status, b.titel as bericht_titel,
            b.nalezer as bericht_nalezer,
            d.kaartsoort, d.prioriteit as def_prioriteit, d.opschalen_na_uur, d.opschalen_naar,
            d.reden, d.kaarttitel, d.feiten as def_feiten, d.naam as def_naam,
            d.knop1_label, d.knop1_doel, d.knop1_sjabloon,
            d.knop2_label, d.knop2_doel, d.knop2_reden_verplicht,
            d.prullenbak, d.prullenbak_doel, d.tweede_lezer, d.eigenaar_bron,
            d.knop1_doel as doel1
       from gebeurtenis g
       join processtap d on d.id = g.processtap
       left join publicatie b on b.gebeurtenis = g.id and b.archief = 0
      where g.vraagt_antwoord = 1 and g.beantwoord_op is null and g.archief = 0
        and d.archief = 0
        and (g.wachten_tot is null or g.wachten_tot <= ?)
        and (? is null or g.cyclus = ?)
        -- 'Van mij' betekent: van mij, plus alles wat van ons samen is. Een
        -- kaart zonder eigenaar wegfilteren zou het meeste werk onzichtbaar
        -- maken, want het meeste werk is niet van één iemand.
        and (? = 0 or g.eigenaar is null or g.eigenaar = ?)
      -- Een bovengrens, want dit gaat in één respons naar het scherm en wordt
      -- daar per kaart opgebouwd. Vijfhonderd openstaande kaarten is al lang
      -- geen wachtrij meer, maar het scherm hoort dan te traag te worden en niet
      -- om te vallen.
      order by g.moment
      limit 500`
  ).bind(alsTekst(moment), cyclus, cyclus, van === "mij" ? 1 : 0, ik && ik.id ? ik.id : "").all()).results;

  if (rijen.length === 0) return { kaarten: [], telling: { hoog: 0, medium: 0, laag: 0 } };

  const bij = await haalErbij(env, rijen);
  const telling = { hoog: 0, medium: 0, laag: 0 };

  const kaarten = rijen.map((r) => {
    const urenOpen = urenSinds(r.moment, moment);
    const prio = prioriteitVan(
      { prioriteit: r.def_prioriteit, opschalen_naar: r.opschalen_naar, opschalen_na_uur: r.opschalen_na_uur },
      urenOpen
    );
    telling[prio.prioriteit]++;

    const gegevens = {
      positie: bij.positie[r.positie] || {},
      cyclus: bij.cyclus[r.cyclus] || {},
      publicatie: bij.publicatie[r.publicatie] || {},
      beoordelingsmoment: bij.moment[r.beoordelingsmoment] || {},
      feiten: leesFeiten(r.feiten),
    };

    return {
      id: r.id,
      kaartsoort: r.kaartsoort,
      bron: r.bron,
      // Waar deze kaart thuishoort op het scherm. Eén regel, en het is dezelfde
      // regel waarmee de achterstand rekent: een kaart waarvan het antwoord een
      // bericht aan de leden is, gaat over de leden. Al het andere is ons werk.
      hoek: r.doel1 === "publicatie" ? "leden" : "werk",
      // De titel uit de definitie als hij invulbaar is, anders die van de
      // gebeurtenis zelf. Er staat altijd iets leesbaars boven een kaart.
      titel: vulIn(r.kaarttitel, gegevens) || r.titel,
      reden: r.reden,
      detail: r.detail,
      moment: r.moment,
      uren_open: Math.round(urenOpen),
      ...prio,
      cyclus: r.cyclus,
      positie: r.positie,
      publicatie: r.publicatie,
      beoordelingsmoment: r.beoordelingsmoment,
      eigenaar: r.eigenaar || null,
      // Waar deze kaart over gaat, als los gegeven. Het hoort als label naast de
      // titel te staan en niet erin: 'Technische analyse Test Cyclus' leest als
      // één zin, en dan is niet meer te zien wat de vraag is en wat het onderwerp.
      waarover: (bij.cyclus[r.cyclus] && bij.cyclus[r.cyclus].naam) || null,
      // Of jij deze kaart mag beantwoorden. Een kaart van een ander staat er
      // wel — je mag zien wat er bij je collega ligt — maar hij is niet van jou
      // om weg te klikken.
      van_mij: !r.eigenaar || (ik && ik.id === r.eigenaar),
      // Wat er al ligt. Het scherm toont hiermee 'ligt bij Jacqueline' in plaats
      // van opnieuw de knop om iets op te stellen dat al bestaat.
      bericht: r.bericht
        ? { id: r.bericht, status: r.bericht_status, titel: r.bericht_titel, nalezer: r.bericht_nalezer }
        : null,
      feiten: feitenVan({ feiten: r.def_feiten }, gegevens),
      knoppen: knoppenVan(r),
      prullenbak: r.prullenbak ? { doel: r.prullenbak_doel || "afsluiten" } : null,
      tweede_lezer: r.tweede_lezer || null,
    };
  });

  // Dringend bovenaan, en binnen dezelfde dringendheid het oudste eerst. Een
  // kaart die al drie dagen wacht hoort niet onder een kaart van vanmorgen.
  kaarten.sort((a, b) =>
    RANG[a.prioriteit] - RANG[b.prioriteit] || String(a.moment).localeCompare(String(b.moment))
  );

  return { kaarten, telling };
}

function knoppenVan(r) {
  const uit = [];
  if (r.knop1_label) {
    // Ligt er al een bericht, dan heet de knop niet meer 'Bericht opstellen'
    // maar brengt hij je naar wat er ligt. Een knop hoort te zeggen wat hij doet.
    const al = r.knop1_doel === "publicatie" && r.bericht;
    uit.push({
      nummer: 1,
      label: al
        ? (r.bericht_status === "nalezen" ? "Ligt bij de nalezer" : "Bericht afmaken")
        : r.knop1_label,
      doel: r.knop1_doel,
      sjabloon: r.knop1_sjabloon,
      reden_verplicht: false,
      // Een bericht dat bij een ander ligt, is niet van jou om af te maken.
      wacht_op_ander: !!(al && r.bericht_status === "nalezen"),
    });
  }
  if (r.knop2_label) {
    uit.push({ nummer: 2, label: r.knop2_label, doel: r.knop2_doel, sjabloon: null, reden_verplicht: !!r.knop2_reden_verplicht });
  }
  return uit;
}

function leesFeiten(ruw) {
  if (!ruw) return {};
  try {
    const f = typeof ruw === "string" ? JSON.parse(ruw) : ruw;
    return f && typeof f === "object" ? f : {};
  } catch {
    return {};
  }
}

// Alles wat de kaarten nodig hebben, per tabel in één vraag.
async function haalErbij(env, rijen) {
  const uit = { positie: {}, cyclus: {}, publicatie: {}, moment: {} };
  const bronnen = [
    ["positie", "positie", "select id, naam, strike, premie, looptijd, resultaat, resultaat_pt, gesloten_op, onderliggend from positie where id in"],
    ["cyclus", "cyclus", "select id, label as naam, status from cyclus where id in"],
    ["publicatie", "publicatie", "select id, titel, kanaal from publicatie where id in"],
    ["beoordelingsmoment", "moment", "select id, datum, status from beoordelingsmoment where id in"],
  ];

  for (const [kolom, sleutel, begin] of bronnen) {
    const ids = [...new Set(rijen.map((r) => r[kolom]).filter(Boolean))];
    if (ids.length === 0) continue;
    try {
      const r = await env.DB.prepare(`${begin} (${ids.map(() => "?").join(",")})`).bind(...ids).all();
      for (const rij of r.results) uit[sleutel][rij.id] = rij;
    } catch {
      // Een kolom die nog niet bestaat mag de wachtrij niet omleggen. De kaart
      // valt dan terug op zijn eigen titel en toont minder feiten.
    }
  }
  return uit;
}

// ------------------------------------------------------------ het antwoord
//
// Een kaart verlaat de rij op één manier: door beantwoord te worden. Wegklikken
// is ook een antwoord — het zegt "gezien, en we doen niets" — en dat blijft
// staan. Er is hier geen route die een kaart wist.
//
// Wat de knop daarna in gang zet is niet aan deze functie. 'publicatie' betekent
// dat het scherm de berichtenopsteller opent; dat het bericht ook echt weggaat
// is een tweede handeling, met een tweede knop, door een mens. Deze functie
// legt alleen vast dat de vraag beantwoord is.
export const DOELEN = ["publicatie", "scherm", "afsluiten", "uitstellen", "splitsen", "terug"];

export async function beantwoord(env, ik, kaartId, { knop = null, doel = null, reden = null, tot = null } = {}) {
  const g = await env.DB.prepare(
    "select * from gebeurtenis where id = ? and vraagt_antwoord = 1"
  ).bind(kaartId).first();
  if (!g) return { fout: "Die kaart bestaat niet.", status: 404 };
  if (g.beantwoord_op) return { fout: "Die kaart is al beantwoord.", status: 409 };

  const d = await env.DB.prepare("select * from processtap where id = ?").bind(g.processtap).first();
  if (!d) return { fout: "De kaartdefinitie is weg.", status: 409 };

  // Een kaart met een eigenaar is van die ene persoon. Zonder dit kon iemand de
  // kaart 'jouw stem ontbreekt' van een collega wegklikken; de sleutel was dan
  // bezet en die collega werd nooit meer gevraagd.
  if (g.eigenaar && ik && ik.id !== g.eigenaar) {
    return { fout: "Deze kaart ligt bij iemand anders.", status: 403 };
  }

  // Welke knop, en klopt die bij deze kaart? Een doel dat niet op de definitie
  // staat is geen keuze maar een vergissing of iets ergers.
  const gekozen = knop === 2
    ? { label: d.knop2_label, doel: d.knop2_doel, redenVerplicht: !!d.knop2_reden_verplicht }
    : knop === 1
      ? { label: d.knop1_label, doel: d.knop1_doel, redenVerplicht: false }
      : doel === (d.prullenbak_doel || "afsluiten") && d.prullenbak
        ? { label: "Prullenbak", doel: d.prullenbak_doel || "afsluiten", redenVerplicht: false }
        : null;

  if (!gekozen || !gekozen.doel) return { fout: "Die knop staat niet op deze kaart.", status: 400 };
  if (!DOELEN.includes(gekozen.doel)) return { fout: `Onbekend doel: ${gekozen.doel}`, status: 400 };

  const redenTekst = String(reden || "").trim();
  if (gekozen.redenVerplicht && !redenTekst) {
    return { fout: "Deze knop vraagt om een reden.", status: 400 };
  }

  // Uitstellen is het enige doel dat de kaart niet beantwoordt. Hij blijft open
  // en blijft in de stroom staan; hij is alleen even niet zichtbaar.
  if (gekozen.doel === "uitstellen") {
    // Het filter in de wachtrij is een tekstvergelijking. 'nooit' is nooit
    // kleiner dan een datum, dus een kaart met zo'n waarde kwam nooit meer
    // terug: niet beantwoord, niet te openen, en hij telde wel mee in de
    // achterstand. Daarom geen vrije tekst maar een echt tijdstip.
    const wachtTot = tijdstip(tot) || morgenvroeg();
    await env.DB.prepare("update gebeurtenis set wachten_tot = ? where id = ?")
      .bind(wachtTot, kaartId).run();
    return { ok: true, uitgesteld_tot: wachtTot };
  }

  await env.DB.prepare(
    `update gebeurtenis
        set beantwoord_op = ?, antwoord = ?, beantwoord_door = ?, wachten_tot = null
      where id = ? and beantwoord_op is null`
  ).bind(
    new Date().toISOString().slice(0, 19).replace("T", " "),
    redenTekst ? `${gekozen.doel}: ${redenTekst}`.slice(0, 500) : gekozen.doel,
    ik && ik.id ? ik.id : null,
    kaartId
  ).run();

  return { ok: true, doel: gekozen.doel, sjabloon: d.knop1_sjabloon && knop === 1 ? d.knop1_sjabloon : null };
}

// 'jjjj-mm-dd' of 'jjjj-mm-dd uu:mm:ss', en het moet een bestaande datum zijn.
// Alles anders levert null, en dan geldt morgenvroeg.
function tijdstip(w) {
  const s = String(w || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(s)) return null;
  const d = new Date(`${s.replace(" ", "T").slice(0, 19)}${s.length <= 10 ? "T06:00:00" : ""}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function morgenvroeg() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(6, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ---------------------------------------------------------------- de stand
//
// Eén kleine vraag die zegt óf er iets veranderd is, zonder de hele rij op te
// bouwen. Het scherm stelt hem elke tien seconden; de volle wachtrij haalt hij
// alleen op als dit antwoord anders is dan de vorige keer.
//
// Zonder dit zou live bijwerken betekenen dat elke tien seconden alle kaarten
// opgebouwd worden — met hun feiten, hun sjablonen en hun verwijzingen erbij —
// en dat is honderd keer zoveel werk voor een antwoord dat meestal 'nee' is.
export async function stand(env, ik, { cyclus = null } = {}) {
  const nu = alsTekst(new Date());

  const r = await env.DB.prepare(
    `select count(*) as open,
            coalesce(max(g.id), 0) as laatste,
            coalesce(max(g.moment), '') as nieuwste
       from gebeurtenis g
       join processtap d on d.id = g.processtap
      where g.vraagt_antwoord = 1 and g.beantwoord_op is null and g.archief = 0
        and d.archief = 0
        and (g.wachten_tot is null or g.wachten_tot <= ?)
        and (? is null or g.cyclus = ?)`
  ).bind(nu, cyclus, cyclus).first();

  // Ook het laatste antwoord telt mee: zonder dat merkt een tweede scherm niet
  // dat iemand anders net een kaart heeft afgehandeld, en blijft die daar staan.
  const laatstBeantwoord = await env.DB.prepare(
    `select coalesce(max(beantwoord_op), '') as w from gebeurtenis
      where vraagt_antwoord = 1 and (? is null or cyclus = ?)`
  ).bind(cyclus, cyclus).first();

  const vanMij = await env.DB.prepare(
    `select count(*) as n from gebeurtenis g
       join processtap d on d.id = g.processtap
      where g.vraagt_antwoord = 1 and g.beantwoord_op is null and g.archief = 0
        and d.archief = 0
        and (g.wachten_tot is null or g.wachten_tot <= ?)
        and (? is null or g.cyclus = ?)
        and (g.eigenaar is null or g.eigenaar = ?)`
  ).bind(nu, cyclus, cyclus, ik && ik.id ? ik.id : "").first();

  return {
    open: r.open,
    van_mij: vanMij.n,
    // Eén tekst die verandert zodra er iets te zien is. Het scherm hoeft niet te
    // weten wat er veranderde, alleen dát er iets veranderde.
    merk: `${r.open}:${r.laatste}:${r.nieuwste}:${laatstBeantwoord.w}`,
  };
}
