// De werkbank: de positie bewaken, de stand zetten, en de leden bijhouden.
//
// Wat hier NIET staat is het belangrijkste: er is geen taakwachtrij meer. Werk
// aan een cyclus — een analyse invullen, een voorwaarde meten, een besluit
// afronden — gebeurt op het cyclusrecord en in zijn related lists, waar het
// veld staat. Een kaart die daarnaar verwijst is een omweg, en twee plekken die
// hetzelfde beweren lopen een keer uit elkaar. Zie BOUWSPEC §13b.
//
// Een kaart bestaat nog, maar alleen voor een positie die opent, sluit of
// doorrolt. En hij wordt afgeleid, niet weggeschreven: de vraag is één query
// over de stroom. Niets stempelt hier iets tot taak, er draait geen motor, en
// een kaart kan dus ook niet blijven staan nadat het werk gedaan is — hij
// verdwijnt doordat het bericht weg is.

import { huidig as barometerstand, stelVast, VENSTERS } from "./barometer.js";
import { metingen, drempels } from "./meting.js";
import { stroom } from "./stroom.js";
import { conceptUitKaart, conceptVoorStand } from "./bericht.js";
import { leesMoment } from "./tijd.js";

// De vensterstand waarin de barometer iets te zeggen heeft. Daarvoor zitten wij
// er niet in en vragen we de leden niets; daarna is de cyclus uit.
export const IN_POSITIE = "in_positie";

// Hoe ruim het doorrolvenster is voor déze sluiting. Staat er alleen een datum
// op — wat spiegel.js schrijft bij een waardeloze expiratie — dan is het
// tijdstip 00:00 en zou een doorrol later op de dag nooit binnen een uur
// vallen. Dan geldt de hele dag.
const vensterVoor = (r, d) =>
  String(r.moment || "").trim().length <= 10 ? Math.max(d.doorrol_minuten, 24 * 60) : d.doorrol_minuten;

const minutenTussen = (a, b) => {
  const x = leesMoment(a), y = leesMoment(b);
  if (!x || !y) return null;
  return Math.abs(y - x) / 60000;
};

// Number(null) is 0, en op een kaart betekent 0,0 "gesloten op break-even".
// Dat is iets heel anders dan "we weten het nog niet", en het gaat zo het
// bericht aan de leden in.
const leeg = (n) => n === null || n === undefined || String(n).trim() === "";
const getal = (n) => (!leeg(n) && Number.isFinite(Number(n)) ? Number(n).toFixed(1).replace(".", ",") : "—");
const getalMet = (n) => {
  if (leeg(n)) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1).replace(".", ",")}`;
};

// ---------------------------------------------------------------- de kaarten
//
// Drie soorten, en alle drie uit een positie. Een kaart staat open zolang er
// geen bericht over verstuurd is en niemand gezegd heeft dat het niet gemeld
// wordt. Er is dus geen vlag die bijgewerkt moet worden.
export async function kaarten(env, cyclusId, { nu = null } = {}) {
  const d = await drempels(env);

  const rijen = (await env.DB.prepare(
    `select g.id, g.soort, g.titel, g.moment, g.positie, g.feiten,
            g.beantwoord_op, g.antwoord,
            p.contract, p.strike, p.aantal, p.inzet_pct, p.ontvangen_premie_pt, p.resultaat_pt,
            p.uitkomst, p.doorgerold_naar,
            (select count(*) from publicatie u
              where u.gebeurtenis = g.id and u.archief = 0 and u.status = 'verstuurd') as gemeld,
            (select id from publicatie u
              where u.gebeurtenis = g.id and u.archief = 0 order by u.id desc limit 1) as concept,
            (select u.soort from publicatie u
              where u.gebeurtenis = g.id and u.archief = 0 order by u.id desc limit 1) as concept_soort
       from gebeurtenis g
       left join positie p on p.id = g.positie
      where g.cyclus = ? and g.archief = 0
        and g.soort in ('positie_geopend', 'positie_gesloten')
      order by g.moment, g.id`
  ).bind(cyclusId).all()).results;

  const open = rijen.filter((r) => !r.gemeld && !r.beantwoord_op);

  // De doorrol. Sluit er een positie en gaat er kort daarna een nieuwe open in
  // dezelfde cyclus, dan is dat één handeling en geen twee. De kaart van de
  // sluiting verandert van vorm; er komt er geen bij.
  // Eerst de doorrollen, en wel van dichtbij naar ver. Een lus die de lijst op
  // volgorde afgaat koppelt de eerste sluiting aan de eerste opening erna, en
  // dat is met drie gebeurtenissen vlak na elkaar de verkeerde: een sluiting om
  // 13:00 pakte dan de opening van 13:30, terwijl die van 13:20 ernaast lag.
  //
  // Dus alle mogelijke paren, kortste afstand eerst, en wie al vergeven is doet
  // niet meer mee.
  const paren = [];
  for (const r of open.filter((x) => x.soort === "positie_gesloten")) {
    for (const x of open.filter((y) => y.soort === "positie_geopend")) {
      if (x.id === r.id) continue;
      const na = leesMoment(x.moment), van = leesMoment(r.moment);
      if (!na || !van || na < van) continue;
      const afstand = minutenTussen(r.moment, x.moment);
      // Een sluiting met alleen een datum — wat een waardeloze expiratie
      // oplevert — telt als het begin van die dag. Anders wordt precies de
      // doorrol na expiratie, het normale maandelijkse geval, nooit herkend.
      if (afstand === null || afstand > vensterVoor(r, d)) continue;
      paren.push({ uit: r, in: x, afstand });
    }
  }
  paren.sort((a2, b2) => a2.afstand - b2.afstand);

  const gebruikt = new Set();
  const uit = [];
  for (const paar of paren) {
    if (gebruikt.has(paar.uit.id) || gebruikt.has(paar.in.id)) continue;
    gebruikt.add(paar.uit.id); gebruikt.add(paar.in.id);
    const r = paar.uit, erna = paar.in;
    uit.push({
      id: r.id, soort: "doorrol", sjabloon: "doorrol",
      // Beide kanten horen bij deze ene kaart. Zonder dat kwam de opening terug
      // als losse kaart zodra het doorrolbericht verstuurd was, en vroeg de
      // werkbank om een tweede bericht over dezelfde handeling.
      ids: [r.id, erna.id], meegegaan: erna.id,
      titel: "Doorrol herkend",
      was: `Positie gesloten${Number(r.resultaat_pt) < 0 ? " met verlies" : ""}`,
      moment: r.moment, positie: r.positie, tweede_positie: erna.positie,
      // Een doorrol is één beweging: eruit en er weer in. Het scherm tekent dat
      // als twee kanten met een pijl ertussen, dus geeft de worker het ook zo —
      // niet als drie losse regels waarin je zelf moet zien wat bij wat hoort.
      rol: {
        uit: { contract: r.contract || "?", getal: getalMet(r.resultaat_pt),
               op: Number(r.resultaat_pt) < 0 ? "verlies" : "winst" },
        in: { contract: erna.contract || "?", getal: `+${getal(erna.ontvangen_premie_pt)}`,
              inzet: leeg(erna.inzet_pct) ? null : `${getal(erna.inzet_pct)} % van het kapitaal` },
        netto: getalMet((Number(r.resultaat_pt) || 0) + (Number(erna.ontvangen_premie_pt) || 0)),
        netto_op: ((Number(r.resultaat_pt) || 0) + (Number(erna.ontvangen_premie_pt) || 0)) < 0 ? "verlies" : "winst",
      },
      feiten: [],
      // Het concept dat de spiegel bij de sluiting klaarzette gaat over de
      // sluiting, niet over de doorrol. Dat is niet het bericht dat hier hoort,
      // dus bieden we het ook niet aan.
      concept: null,
    });
  }

  // En dan wat er los overblijft, in de volgorde waarin het gebeurde.
  for (const r of open) {
    if (gebruikt.has(r.id)) continue;
    const geopend = r.soort === "positie_geopend";
    uit.push({
      id: r.id, soort: r.soort, sjabloon: geopend ? "nieuwe_positie" : "sluiting",
      ids: [r.id], meegegaan: null,
      titel: geopend ? "Positie geopend" : "Positie gesloten",
      moment: r.moment, positie: r.positie,
      // Het aantal contracten zegt niets zonder de omvang van de portefeuille
      // erbij; de inzet in procent van het kapitaal zegt precies wat een lid
      // wil weten.
      feiten: geopend
        ? [["Contract", r.contract || "?"], ["Premie", getal(r.ontvangen_premie_pt)],
           ["Inzet", leeg(r.inzet_pct) ? "—" : `${getal(r.inzet_pct)} %`]]
        : [["Contract", r.contract || "?"], ["Uitkomst", r.uitkomst || "gesloten"],
           ["Resultaat", getalMet(r.resultaat_pt)]],
      concept: r.concept_soort === (geopend ? "opening" : "sluiting") ? r.concept : null,
    });
  }

  // De kaarten in de volgorde waarin ze gebeurd zijn.
  uit.sort((x, y) => String(x.moment).localeCompare(String(y.moment)) || x.id - y.id);
  return uit;
}



// ------------------------------------------------------------- het hele beeld
export async function werkbank(env, ik, { cyclus = null, nu = null } = {}) {
  const cycli = (await env.DB.prepare(
    `select id, label, status, geopend_op from cyclus
      where archief = 0 and status not in ('afgesloten', 'geannuleerd')
      -- Dispatch gaat over de cyclus die in de markt staat: die hoort bovenaan,
      -- ook als er daarna een nieuwe geopend is die nog in de pre-analyse zit.
      order by case when status = 'in positie' then 0 else 1 end, geopend_op desc`
  ).all()).results;

  const id = cyclus || (cycli[0] && cycli[0].id) || null;
  if (!id) return { cycli, cyclus: null };

  const [baro, meet, kaartlijst, verstuurd, gebeurtenissen] = await Promise.all([
    barometerstand(env, id),
    metingen(env, id, { nu }),
    kaarten(env, id, { nu }),
    env.DB.prepare(
      // Alleen wat naar de leden ging. Een interne publicatie onder het kopje
      // 'verstuurd naar de leden' is precies de stilte-fout waar dit scherm
      // voor bestaat: je denkt dat ze het weten, en ze weten het niet.
      `select id, titel, soort, tekst, verstuurd_op
         from publicatie
        where cyclus = ? and archief = 0 and status = 'verstuurd'
          and coalesce(kanaal, 'leden') <> 'intern'
        order by verstuurd_op desc, id desc limit 20`
    ).bind(id).all().then((r) => r.results).catch(() => []),
    stroom(env, id, 8).catch(() => []),
  ]);

  // De events in de looptijd, voor de tijdas. Dezelfde vraag als op het
  // besluitscherm: één bron, zodat een event op beide schermen op dezelfde dag
  // ligt.
  const events = await env.DB.prepare(
    `select ce.id, e.zwaarte, e.notities, e.datum, e.tijdstip, e.tijdzone, e.naam, e.soort
       from cyclus_event ce join event e on e.id = ce.event
      where ce.cyclus = ? order by e.datum, e.tijdstip`
  ).bind(id).all().then((r) => r.results).catch(() => []);

  // De geschiedenis: wat wij achter elkaar besloten, en hoe elke tranche zich
  // ondertussen ontwikkelde. Zonder dat is elk scherm een momentopname — en de
  // vraag die een lid stelt is juist: wordt het beter of slechter?
  const standen = (await env.DB.prepare(
    `select b.stand, b.venster, b.reden, b.herkomst, b.vastgesteld_op, b.gepubliceerd_op,
            coalesce(g.korte_naam, g.naam, b.vastgesteld_door) as wie
       from barometerstand b
       left join gebruiker g on g.id = b.vastgesteld_door
      where b.cyclus = ? and b.archief = 0
      order by b.vastgesteld_op desc, b.id desc limit 40`
  ).bind(id).all().then((r) => r.results).catch(() => []));

  // Per tranche één vakje per dag, met de stand waarop hij die dag sloot. Niet
  // de laagste of het gemiddelde van de dag: waar hij aan het eind van de dag
  // stond, is wat die dag opleverde — en dat is ook wat de leden te horen
  // kregen. Oudste eerst op het scherm, want een geschiedenis leest van links
  // naar rechts.
  const verloop = {};
  for (const p of meet.posities) {
    const gemeten = await env.DB.prepare(
      `select dag, stand, ask, binnen from (
         select date(moment) as dag, stand, ask, binnen,
                row_number() over (partition by date(moment) order by moment desc) as rn
           from positiemeting where positie = ?
       ) where rn = 1
       order by dag`
    ).bind(p.id).all().then((x) => x.results).catch(() => []);

    // De strook loopt over de hele looptijd van de tranche: van de dag dat ze
    // openging tot de expiratie. Wat nog moet komen staat er grijs bij — zo zie
    // je niet alleen hoe het ging, maar ook hoeveel dagen er nog te gaan zijn.
    const start = String(p.geopend_op || (gemeten[0] && gemeten[0].dag) || "").slice(0, 10);
    // Een tranche die dicht is loopt tot haar sluiting, niet tot de expiratie:
    // de dagen daarna bestaan niet voor haar. Een expiratie zonder sluittijdstip
    // telt als de laatste dag.
    const dicht = String(p.sluittijdstip || "").slice(0, 10);
    const eind = !p.open && dicht ? dicht : String(p.expiratiedatum || "").slice(0, 10);
    if (!start || !eind) { if (gemeten.length) verloop[p.id] = gemeten; continue; }

    const bij = new Map(gemeten.map((r) => [String(r.dag), r]));
    const dagen = await handelsdagen(env, start, eind);
    const rijen = dagen.map((d) => {
      const r = bij.get(d.dag);
      return r ? { ...d, stand: Number(r.stand), ask: r.ask, binnen: r.binnen }
               : { ...d, stand: null, ask: null, binnen: null };
    });

    // De laatste dag van een afgeronde tranche draagt haar uitkomst. Zonder dat
    // eindigt een strook die goed afliep in dezelfde grijstint als een strook
    // waar niemand naar keek.
    if (!p.open && rijen.length) {
      const res = p.resultaat === null || p.resultaat === undefined ? null : Number(p.resultaat);
      rijen[rijen.length - 1].slot = res === null ? null : res >= 0 ? "winst" : "verlies";
      rijen[rijen.length - 1].uitkomst = p.uitkomst || "gesloten";
    }
    verloop[p.id] = rijen;
  }

  const cyclusrij = cycli.find((c) => c.id === id) || null;
  const venster = baro.wij ? baro.wij.venster.waarde : "pre_analyse";

  // De barometer slaapt tot wij erin zitten. Daarvoor is er geen positie om een
  // stand over te hebben, en daarna is de cyclus uit.
  const wakker = venster === IN_POSITIE;

  return {
    cycli, cyclus: cyclusrij,
    barometer: {
      ...baro,
      wakker,
      slaapt_waarom: wakker ? null
        : VENSTERS.indexOf(venster) > VENSTERS.indexOf(IN_POSITIE)
          ? "de cyclus is afgerond" : "wij zitten er nog niet in",
      // Het systeem stelt alleen voor als het gemeten heeft. Kan het niet meten,
      // dan zegt het waarom in plaats van een stand te gokken.
      voorstel: wakker ? meet.voorstel : null,
      voorstel_waarom_niet: wakker ? meet.waarom_niet : null,
      // Een voorstel op de halve portefeuille ziet er hetzelfde uit als een
      // voorstel op de hele. Dus zeggen we het.
      ongemeten: meet.ongemeten,
    },
    venster: { nu: venster, verloop: VENSTERS, gepubliceerd: baro.leden ? baro.leden.venster.waarde : null },
    posities: meet.posities,
    zwakste: meet.zwakste,
    vakken: meet.vakken,
    drempels: meet.drempels,
    kaarten: kaartlijst,
    verstuurd,
    stroom: gebeurtenissen,
    events,
    geschiedenis: { standen, verloop, dagen: await dagstanden(env, id, { nu }) },
    // Wacht er iets op de leden? Drie dingen kunnen dat zijn, en ze staan los
    // van elkaar: een kaart, een stand die wij wel kennen en zij niet, of een
    // voorstel dat nog niet overgenomen is.
    wacht: {
      kaarten: kaartlijst.length,
      stand_anders: !!baro.wij && !baro.gelijk,
      voorstel: wakker && meet.voorstel !== null && baro.wij && Number(baro.wij.stand.waarde) !== meet.voorstel,
    },
  };
}

// --------------------------------------------------------------- publiceren
//
// Eén knop voor allebei. Je kunt in dezelfde beweging het venster en de
// barometer verzetten, en dan gaat er één bericht over allebei uit. Dat is
// precies wat we willen: een lid dat twee berichten krijgt over hetzelfde
// moment leest het tweede niet meer.
export async function publiceer(env, ik, { cyclus, stand = null, venster = null, reden }) {
  if (!cyclus) return { fout: "Welke cyclus?", status: 400 };
  if (stand === null && venster === null) return { fout: "Er is niets gekozen.", status: 400 };

  const nu = await barometerstand(env, cyclus);
  const staatStand = nu.wij ? Number(nu.wij.stand.waarde) : 1;
  const staatVenster = nu.wij ? nu.wij.venster.waarde : "pre_analyse";

  const naarVenster = venster === null ? staatVenster : venster;
  const naarStand = stand === null ? staatStand : Number(stand);

  // De barometer kan alleen verzet worden als hij wakker is. Anders zou je een
  // stand kunnen publiceren over een positie die er niet is.
  if (stand !== null && naarVenster !== IN_POSITIE) {
    return { fout: "De barometer zegt pas iets zodra het venster op 'In positie' staat.", status: 409 };
  }

  // Welke tranche deze stand draagt. Een barometerstand komt niet uit de lucht:
  // het is de zwakste positie die hem naar beneden duwt, en dat is ook de
  // positie waarvan de volgers dit bericht horen te krijgen.
  const meet = await metingen(env, cyclus);
  const dragend = meet.zwakste ? meet.zwakste.id : null;

  const vast = await stelVast(env, ik, {
    cyclus, stand: naarStand, venster: naarVenster, reden,
    positie: stand !== null ? dragend : null,
  });
  if (vast.fout) return vast;

  // Vastleggen is nog niet melden. Eén handeling levert één concept op over wat
  // er veranderde — venster, barometer of allebei — en pas het versturen
  // daarvan zet de stand bij de leden. Mislukt het opstellen, dan blijft de
  // vastlegging staan: wat wij vinden is vastgelegd, ook als het bericht nog
  // geschreven moet worden.
  const bericht = await conceptVoorStand(env, ik, {
    cyclus, barometerstand: vast.barometerstand,
    positie: stand !== null ? dragend : null,
    contract: stand !== null && meet.zwakste ? meet.zwakste.contract : null,
    van: nu.wij ? nu.wij.stand.label : null,
    naar: (nu.schaal.find((x) => String(x.waarde) === String(naarStand)) || {}).label || String(naarStand),
    venster_van: nu.wij ? nu.wij.venster.label : null,
    venster_naar: (nu.vensters.find((x) => x.waarde === naarVenster) || {}).label || naarVenster,
    reden,
  });

  return { ...vast, publicatie: bericht.publicatie || null, bericht_fout: bericht.fout || null };
}

// Van kaart naar concept. Dit gaat met opzet via de werkbank en niet
// rechtstreeks naar bericht.js: alleen hier is bekend wélke gebeurtenissen een
// kaart zijn, welk sjabloon erbij hoort, en dat een doorrol twee kanten heeft.
// Zonder die laag kon elke willekeurige gebeurtenis een bericht aan de leden
// worden, met het verkeerde sjabloon erbij.
export async function conceptVoorKaart(env, ik, kaartId, cyclusId = null) {
  const g = await env.DB.prepare(
    "select id, cyclus, soort from gebeurtenis where id = ? and archief = 0"
  ).bind(kaartId).first();
  if (!g) return { fout: "Die kaart bestaat niet.", status: 404 };

  const lijst = await kaarten(env, cyclusId || g.cyclus);
  const kaart = lijst.find((k) => k.ids.includes(Number(kaartId)));
  if (!kaart) {
    return { fout: "Dat is geen openstaande kaart. Er is al over besloten, of het was er nooit een.", status: 409 };
  }

  // Een doorrol krijgt een doorrolbericht. Lag er een concept klaar over alleen
  // de sluiting of alleen de opening, dan gaat dat van tafel — het is nooit
  // verstuurd, en het beschrijft iets anders dan wat er gebeurd is.
  if (kaart.soort === "doorrol") {
    await env.DB.prepare(
      `update publicatie set archief = 1
        where gebeurtenis in (?, ?) and archief = 0 and status <> 'verstuurd'`
    ).bind(kaart.ids[0], kaart.ids[1]).run();

    // Het sjabloon vraagt om 'van' en 'naar'. Die staan niet op één van de twee
    // gebeurtenissen — het is juist het paar dat de doorrol is — dus leggen we
    // ze vast op de gebeurtenis waar het bericht aan hangt. Dat is geen nieuw
    // feit: het is wat er gebeurd is, nu ook opgeschreven.
    const g0 = await env.DB.prepare("select feiten from gebeurtenis where id = ?").bind(kaart.id).first();
    let oud = {};
    try { oud = g0 && g0.feiten ? JSON.parse(g0.feiten) : {}; } catch { oud = {}; }
    await env.DB.prepare("update gebeurtenis set feiten = ? where id = ?")
      .bind(JSON.stringify({
        ...oud,
        van: `${kaart.rol.uit.contract} · ${kaart.rol.uit.getal}`,
        naar: `${kaart.rol.in.contract} · ${kaart.rol.in.getal}`,
        // En de twee contracten los, voor de titel: die wordt te lang als de
        // getallen mee moeten, maar zonder contract weet een lid niet waarover
        // het bericht gaat.
        van_contract: kaart.rol.uit.contract,
        naar_contract: kaart.rol.in.contract,
        netto: kaart.rol.netto,
        // Welke tranche er meeging. Het bericht hangt aan de sluiting, maar het
        // gaat ook over de opening — en die moet na het versturen naar 'bewaken'
        // in plaats van te blijven wachten op een bericht dat al weg is.
        doorrol_in: kaart.tweede_positie || null,
      }), kaart.id)
      .run();
  }

  const uit = await conceptUitKaart(env, ik, kaart.id, kaart.sjabloon);
  if (uit.fout) return uit;

  // De tweede kant van een doorrol is meegegaan in dit ene bericht. Zonder deze
  // regel komt hij terug als losse kaart zodra het bericht verstuurd is.
  if (kaart.meegegaan) {
    await env.DB.prepare(
      `update gebeurtenis
          set beantwoord_op = datetime('now'), antwoord = 'meegegaan in de doorrol',
              beantwoord_door = ?
        where id = ? and beantwoord_op is null`
    ).bind(ik && ik.id ? ik.id : null, kaart.meegegaan).run();
  }
  return uit;
}

// Wat er met een kaart gebeurt als we besluiten hem niet te melden. Dat is een
// echt besluit en geen wegklikken: het zegt dat de leden dit niet hoeven te
// weten, en dat hoort met een reden in de stroom te staan.
export async function nietMelden(env, ik, gebeurtenis, reden) {
  if (!String(reden || "").trim()) {
    return { fout: "Zeg waarom dit niet naar de leden gaat.", status: 400 };
  }
  const g = await env.DB.prepare(
    "select id, cyclus, soort, beantwoord_op from gebeurtenis where id = ? and archief = 0"
  ).bind(gebeurtenis).first();
  if (!g) return { fout: "Die kaart bestaat niet.", status: 404 };
  if (g.beantwoord_op) return { fout: "Daar is al over besloten.", status: 409 };

  // Alleen een echte kaart. Zonder deze controle kon elke gebeurtenis in de
  // stroom stil als afgehandeld gelden — ook een die nooit een kaart was.
  const lijst = await kaarten(env, g.cyclus);
  const kaart = lijst.find((k) => k.ids.includes(Number(gebeurtenis)));
  if (!kaart) return { fout: "Dat is geen openstaande kaart.", status: 409 };

  // Hoort er een tweede gebeurtenis bij deze kaart, dan gaat die mee: anders
  // staat de helft van een doorrol morgen weer open.
  if (kaart.meegegaan && Number(kaart.meegegaan) !== Number(gebeurtenis)) {
    await env.DB.prepare(
      `update gebeurtenis
          set beantwoord_op = datetime('now'), antwoord = 'niet melden', beantwoord_door = ?
        where id = ? and beantwoord_op is null`
    ).bind(ik && ik.id ? ik.id : null, kaart.meegegaan).run();
  }

  await env.DB.prepare(
    `update gebeurtenis
        set beantwoord_op = datetime('now'), antwoord = 'niet melden',
            beantwoord_door = ?, detail = ?
      where id = ? and beantwoord_op is null`
  ).bind(ik && ik.id ? ik.id : null, String(reden).trim().slice(0, 1000), gebeurtenis).run();

  return { ok: true };
}

// --------------------------------------------------- de dagen van een cyclus
//
// Eén regel per handelsdag, met de stand en het venster zoals ze aan het eind
// van die dag golden. Niet elke dag draagt een vastlegging — de meeste dagen
// verandert er niets — dus wordt elke dag teruggerekend naar de laatste stand
// die er op dat moment lag.
//
// Welke dagen tellen komt uit de handelskalender. Staat er voor een datum niets
// in, dan geldt maandag tot en met vrijdag: beter een kalender die ongeveer
// klopt dan een lege strook.
export async function dagstanden(env, cyclusId, { nu = null, maxdagen = 90 } = {}) {
  const standen = (await env.DB.prepare(
    `select stand, venster, vastgesteld_op from barometerstand
      where cyclus = ? and archief = 0 order by vastgesteld_op, id`
  ).bind(cyclusId).all()).results;
  if (!standen.length) return [];

  const cyclusrij = await env.DB.prepare("select geopend_op from cyclus where id = ?").bind(cyclusId).first();
  const eerste = String(cyclusrij && cyclusrij.geopend_op ? cyclusrij.geopend_op : standen[0].vastgesteld_op).slice(0, 10);
  const laatste = (nu ? new Date(nu) : new Date()).toISOString().slice(0, 10);

  const uit = (await handelsdagen(env, eerste, laatste, maxdagen)).map((d) => {
    // De laatste vastlegging van of vóór deze dag. Vóór de eerste vastlegging is
    // er niets te zeggen; dan draagt de dag geen kleur.
    let gold = null;
    for (const s of standen) {
      if (String(s.vastgesteld_op).slice(0, 10) <= d.dag) gold = s; else break;
    }
    return { ...d, stand: gold ? Number(gold.stand) : null, venster: gold ? gold.venster : null };
  });
  // De laatste dagen zijn de interessante; bij een lange cyclus valt het begin af.
  return uit.slice(-maxdagen);
}

// De handelsdagen tussen twee datums, uit de handelskalender. Staat er voor een
// datum niets in, dan geldt maandag tot en met vrijdag: beter een kalender die
// ongeveer klopt dan een lege strook.
export async function handelsdagen(env, van, tot, maxdagen = 120) {
  const kalender = new Map();
  try {
    const r = await env.DB.prepare(
      "select datum, status from handelsdag where datum between ? and ?"
    ).bind(van, tot).all();
    for (const d of r.results) kalender.set(String(d.datum).slice(0, 10), String(d.status));
  } catch { /* dan de weekdagen */ }

  const uit = [];
  const dag = new Date(`${van}T12:00:00Z`);
  const eind = new Date(`${tot}T12:00:00Z`);
  while (dag <= eind && uit.length < maxdagen) {
    const d = dag.toISOString().slice(0, 10);
    const status = kalender.get(d);
    const handel = status ? status !== "dicht" : dag.getUTCDay() >= 1 && dag.getUTCDay() <= 5;
    if (handel) uit.push({ dag: d, week: weeknummer(dag) });
    dag.setUTCDate(dag.getUTCDate() + 1);
  }
  return uit;
}

// Het weeknummer, alleen om de dagen in blokjes te zetten. ISO-week: de week
// begint op maandag en week 1 is die met de eerste donderdag erin.
function weeknummer(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dag = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dag + 3);
  const eerste = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const eersteDag = (eerste.getUTCDay() + 6) % 7;
  eerste.setUTCDate(eerste.getUTCDate() - eersteDag + 3);
  return 1 + Math.round((t - eerste) / (7 * 24 * 3600 * 1000));
}
