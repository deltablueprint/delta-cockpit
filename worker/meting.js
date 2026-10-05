// De meting: waar staat een positie, en wat vragen we daarmee van een lid.
//
// Dit is de ene plek die van een positie een stand maakt. Hij rekent en zegt
// het; hij schrijft niets en hij stelt niets vast. Dat laatste doet een mens,
// op het scherm, met de knop publiceren.
//
// De maat is de ask: wat het kost om de positie terug te kopen, en dus precies
// wat er nog op het spel staat. De schaal loopt van het ene uiterste naar het
// andere:
//
//   ask = 0            de optie is waardeloos, de hele premie is binnen
//   ask = de stoploss  eruit volgens het exitplan
//
// Dat is met opzet níét de afstand van de spot tot de strike. Die maat klopt
// ook, maar hij vraagt de stand van de onderliggende index — een abonnement op
// Eurex-data en een brug die draait — terwijl het getal dat ertoe doet al
// binnenkomt bij elke hartslag. Een maat die de helft van de tijd ontbreekt is
// geen maat.
//
// De grenzen staan in beheer (0128, 0130). Ze gaan bijgesteld worden, en dat
// hoort geen deploy te zijn.

import { leesMoment } from "./tijd.js";

// De vijf treden, van rustig naar druk. De labels staan in db_choice, niet hier
// — ze gaan naar de leden en gaan dus veranderen.
export const STANDEN = [1, 2, 3, 4, 5];

const STANDAARD = {
  koers_vers_minuten: 20,
  doorrol_minuten: 60,
};

// De grenzen van de vijf standen, als terugval wanneer de tabel leeg of stuk is.
// De grens is de bovenkant van het vak: de ask zakt van verlies naar winst, dus
// je komt een stand binnen zodra de ask onder zijn grens zakt.
const STANDAARD_GRENZEN = {
  1: { waarde: 60,  eenheid: "punten" },
  2: { waarde: 50,  eenheid: "punten" },
  3: { waarde: 100, eenheid: "pct_premie" },   // break-even: ligt vast
  4: { waarde: 50,  eenheid: "pct_premie" },
  5: { waarde: 30,  eenheid: "pct_premie" },
};

export async function drempels(env) {
  const uit = { ...STANDAARD };
  try {
    const r = await env.DB.prepare(
      "select sleutel, waarde from instelling where archief = 0 and sleutel in " +
      "('koers_vers_minuten','doorrol_minuten')"
    ).all();
    for (const rij of r.results) {
      const n = Number(rij.waarde);
      if (Number.isFinite(n) && n > 0) uit[rij.sleutel] = n;
    }
  } catch { /* dan de standaard */ }

  // De grenzen uit hun eigen tabel (0148). Onzin in een drempel mag de meter
  // niet omleggen: dan liever de standaard dan een stand die nergens op slaat.
  const grenzen = JSON.parse(JSON.stringify(STANDAARD_GRENZEN));
  try {
    const r = await env.DB.prepare(
      "select stand, grens_waarde, grens_eenheid from barometerdrempel where archief = 0"
    ).all();
    for (const rij of r.results) {
      const stand = Number(rij.stand);
      const w = Number(rij.grens_waarde);
      if (!grenzen[stand]) continue;
      if (!Number.isFinite(w) || w <= 0) { uit.grenzen_rechtgezet = true; continue; }
      if (rij.grens_eenheid !== "punten" && rij.grens_eenheid !== "pct_premie") {
        uit.grenzen_rechtgezet = true; continue;
      }
      grenzen[stand] = { waarde: w, eenheid: rij.grens_eenheid };
    }
  } catch { /* dan de standaard */ }

  // Break-even is geen instelling: het is de ask gelijk aan de ontvangen premie.
  grenzen[3] = { ...STANDAARD_GRENZEN[3] };
  uit.grenzen = grenzen;
  return uit;
}

// Een grens omrekenen naar een ask-niveau. Punten zijn al een ask; een
// percentage is een deel van wat je ontving.
export function grensNaarAsk(grens, premie) {
  if (!grens) return null;
  return grens.eenheid === "punten" ? grens.waarde : premie * (grens.waarde / 100);
}

// De vijf ijkpunten van een tranche, als ask-niveaus, van verlies naar winst.
// Alles is een ask, want dat is de prijs waartegen je er werkelijk uit komt en
// het getal waar de regels tegen toetsen.
//
//   stoploss      hier hoort de tranche gesloten te zijn
//   waarschuwing  aandacht, vóór de harde grens in zicht komt
//   breakeven     de ask gelijk aan wat je ontving
//   helft         de helft van de premie binnen
//   winstanker    het afgesproken deel binnen (70 % → ask op 30 % van de premie)
export function ijkpunten(premie, stoploss, d) {
  const p = Number(premie);
  if (!Number.isFinite(p) || p <= 0) return null;
  const g = (d && d.grenzen) || STANDAARD_GRENZEN;

  // De stoploss van de tranche gaat voor: aanscherpen mag altijd, en dan telt
  // wat er bij de positie staat.
  const sl = Number.isFinite(Number(stoploss)) && Number(stoploss) > 0
    ? Number(stoploss) : grensNaarAsk(g[1], p);

  // De stoploss moet boven break-even liggen, anders is het geen stoploss maar
  // een winstdoel: je zou eruit stappen terwijl je nog op winst staat. Dat kan
  // een bewuste keuze zijn, maar deze balk kan hem niet tonen — en een balk die
  // iets anders tekent dan er staat is erger dan geen balk.
  if (!(sl > p)) return null;

  // De waarschuwing ligt tussen de stoploss en break-even. Een vast puntniveau
  // doet dat bij een premie daaronder; ligt de premie hoger, dan valt hij
  // erbuiten en nemen we het midden. Zo houdt de balk zijn volgorde, wat er ook
  // ingesteld staat. Hetzelfde geldt voor de twee grenzen in de winstkant.
  const w = grensNaarAsk(g[2], p);
  const waarschuwing = w > p && w < sl ? w : (sl + p) / 2;

  const h0 = grensNaarAsk(g[4], p);
  const helft = h0 > 0 && h0 < p ? h0 : p * 0.5;

  const a0 = grensNaarAsk(g[5], p);
  const winstanker = a0 > 0 && a0 < helft ? a0 : helft * 0.6;

  return { stoploss: sl, waarschuwing, breakeven: p, helft, winstanker };
}

// De zes vakken van de balk, van links (verlies) naar rechts (winst), met hun
// vaste plek op het scherm. Vast, zodat twee tranches met verschillende premies
// dezelfde zonebreedtes tonen en je ze naast elkaar kunt lezen zonder eerst de
// schaal te ijken. Break-even staat in het midden.
//
// stand 0 is geen stand maar het smalle stuk voorbij de grens: daar hoort de
// tranche gesloten te zijn.
export const VAKKEN = [
  { stand: 0, van: 0,  tot: 8,   naam: "voorbij de grens" },
  { stand: 1, van: 8,  tot: 26,  naam: "onder druk" },
  { stand: 2, van: 26, tot: 50,  naam: "krap" },
  { stand: 3, van: 50, tot: 68,  naam: "aandacht" },
  { stand: 4, van: 68, tot: 84,  naam: "comfortabel" },
  { stand: 5, van: 84, tot: 100, naam: "veilig" },
];

// Waar een ask op die balk staat, in procent van links naar rechts. Binnen elk
// vak lineair, zodat de markering vloeiend meebeweegt met de prijs.
export function plekVan(ask, ijk) {
  // Number(null) is 0, en 0 is hier 'waardeloos geëxpireerd' — de beste plek op
  // de balk. Een ask die er niet is mag daar nooit terechtkomen.
  if (ask === null || ask === undefined || String(ask).trim() === "") return null;
  const a = Number(ask);
  if (!ijk || !Number.isFinite(a) || a < 0) return null;

  // Voorbij de stoploss is één smal stuk zonder schaal: hoe ver eroverheen doet
  // er niet toe, want de tranche hoort daar gesloten te zijn. De markering
  // staat in het midden ervan.
  if (a > ijk.stoploss) return VAKKEN[0].van + (VAKKEN[0].tot - VAKKEN[0].van) * 0.5;

  // Daarna: van links naar rechts daalt de ask. Elk vak heeft een hoge en een
  // lage grens, en binnen het vak wordt lineair geïnterpoleerd zodat de
  // markering vloeiend meebeweegt met de prijs.
  const grenzen = [
    [ijk.stoploss,      ijk.waarschuwing],
    [ijk.waarschuwing,  ijk.breakeven],
    [ijk.breakeven,     ijk.helft],
    [ijk.helft,         ijk.winstanker],
    [ijk.winstanker,    0],
  ];

  for (let i = 0; i < grenzen.length; i++) {
    const [hoog, laag] = grenzen[i];
    const vak = VAKKEN[i + 1];
    if (a < laag && i < grenzen.length - 1) continue;
    const breedte = hoog - laag;
    const deel = breedte > 0 ? (hoog - a) / breedte : 0;
    return vak.van + (vak.tot - vak.van) * Math.max(0, Math.min(1, deel));
  }
  return 100;
}

// Van een ask naar een stand. Dit is dezelfde som als de balk tekent: de stand
// ís de zone waarin de markering staat, en daarom is er geen apart rekenwerk.
export function standVan(ask, ijk) {
  const plek = plekVan(ask, ijk);
  if (plek === null) return null;
  const vak = VAKKEN.find((v) => plek >= v.van && (plek < v.tot || v.tot === 100));
  if (!vak) return null;
  // Voorbij de grens is geen barometerstand maar een positie die gesloten hoort
  // te zijn. Voor de barometer telt hij als de zwaarste stand die er is.
  return vak.stand === 0 ? 1 : vak.stand;
}

// Staat de tranche voorbij haar stoploss? Dat is geen stand maar een afspraak
// die geraakt is, en het hoort apart op het scherm te staan.
export function voorbijDeGrens(ask, ijk) {
  if (!ijk || !Number.isFinite(Number(ask))) return false;
  return Number(ask) > ijk.stoploss;
}

function dagenTot(datum, nu) {
  const a = new Date(`${String(datum || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((a - nu) / 86400000);
}

// Alle posities van een cyclus, gemeten. Eén query, daarna rekenen — dit wordt
// bij elke peiling gesteld.
export async function metingen(env, cyclusId, { nu = null, positie = null } = {}) {
  const moment = nu ? new Date(nu) : new Date();
  const d = await drempels(env);

  // Eén cyclus, of één positie. Hetzelfde rekenwerk: het positierecord toont
  // dezelfde balk als Dispatch, en twee rekensommen voor één balk is hoe ze uit
  // elkaar gaan lopen.
  const waar = positie ? "p.id = ?" : "p.cyclus = ?";
  const posities = (await env.DB.prepare(
    `select p.*, b.laatprijs, b.biedprijs, b.marktprijs, b.multiplier, b.gewijzigd_op as prijs_moment,
            coalesce(g.korte_naam, g.naam, p.wie_volgt) as volger
       from positie p
       left join brokerpositie b on b.conid = p.conid
       left join gebruiker g on g.id = p.wie_volgt
      where ${waar} and p.archief = 0
      order by p.tranche, p.id`
  ).bind(positie || cyclusId).all()).results;

  // Welke posities in de markt staan. Niet 'alles wat niet gesloten is': een
  // tranche die nog op uitvoering wacht draagt de strike van het bésluit, en er
  // staat geen contract tegenover.
  const IN_DE_MARKT = new Set(["bewaken", "publiceren naar leden", "uitvoering vastgelegd"]);

  const uit = posities.map((p) => {
    const open = IN_DE_MARKT.has(String(p.status || "")) && !p.uitkomst && Number(p.aantal) > 0;

    // Terugkopen doe je tegen de laatprijs. Is die er niet, dan de marktprijs,
    // en dan zeggen we erbij dat het de marktprijs is.
    const ask = p.laatprijs !== null && p.laatprijs !== undefined ? Number(p.laatprijs)
              : p.marktprijs !== null && p.marktprijs !== undefined ? Number(p.marktprijs) : null;
    const bod = p.biedprijs !== null && p.biedprijs !== undefined ? Number(p.biedprijs) : null;

    // Een prijs van gisteren is erger dan geen prijs: hij ziet er even stellig
    // uit. Het tijdstip komt van de brokerregel, die de brug bij elke hartslag
    // bijwerkt.
    const toen = leesMoment(p.prijs_moment);
    const minuten = toen && !Number.isNaN(moment.getTime()) ? (moment - toen) / 60000 : null;
    const versePrijs = ask !== null && minuten !== null && minuten >= -1 && minuten <= d.koers_vers_minuten;

    // Number(null) is 0, en dat is hier geen onschuldig verschil: een premie van
    // 0 geeft een open resultaat van min de hele ask en een stoploss die nergens
    // op slaat. Verzonnen getallen op een scherm waar iemand een bericht op
    // baseert.
    const premie = p.ontvangen_premie_pt === null || p.ontvangen_premie_pt === undefined
      || String(p.ontvangen_premie_pt).trim() === "" ? null : Number(p.ontvangen_premie_pt);
    const stoploss = Number(p.stoploss_ask) > 0 ? Number(p.stoploss_ask) : null;
    const ijk = ijkpunten(premie, stoploss, d);

    const resultaat = premie !== null && Number.isFinite(premie) && ask !== null ? premie - ask
      // Een positie die dicht is heeft haar resultaat al vastgelegd; dat staat
      // in de database en hoeft niet uit een ask gerekend te worden die er niet
      // meer is.
      : (p.resultaat_pt !== null && Number.isFinite(Number(p.resultaat_pt)) ? Number(p.resultaat_pt) : null);

    const dagen = dagenTot(p.expiratiedatum, moment);

    return {
      id: p.id, contract: p.contract, tranche: p.tranche, status: p.status,
      strike: Number(p.strike) || null, aantal: p.aantal,
      // Het aantal contracten zegt niets zonder de omvang van de portefeuille;
      // de inzet in procent van het kapitaal is wat een lid wil weten.
      inzet_pct: p.inzet_pct === null || p.inzet_pct === undefined ? null : Number(p.inzet_pct),
      expiratiedatum: p.expiratiedatum, dagen,
      premie: premie !== null && Number.isFinite(premie) ? premie : null,
      ask, bod, ask_is_marktprijs: p.laatprijs === null || p.laatprijs === undefined,
      prijs_moment: p.prijs_moment, prijs_minuten_oud: minuten === null ? null : Math.round(minuten),
      verse_prijs: versePrijs,
      resultaat,
      // In euro, met de multiplier van het contract en het werkelijke aantal.
      resultaat_eur: resultaat !== null && Number(p.aantal) > 0
        ? resultaat * (Number(p.multiplier) > 0 ? Number(p.multiplier) : 10) * Number(p.aantal)
        : null,
      // De ijkpunten van deze tranche, als ask-niveaus. De balk tekent ze op
      // vaste plekken, zodat twee tranches met verschillende premies naast
      // elkaar te lezen zijn.
      ijk,
      stoploss: ijk ? ijk.stoploss : stoploss,
      breakeven: ijk ? ijk.breakeven : null,
      tot_stoploss: ask !== null && ijk ? ijk.stoploss - ask : null,
      // Waar de markering staat, in procent van links (verlies) naar rechts
      // (winst). De ask daalt naar rechts: een geschreven optie die goedkoper
      // wordt is winst.
      plek: versePrijs ? plekVan(ask, ijk) : null,
      voorbij_de_grens: versePrijs ? voorbijDeGrens(ask, ijk) : false,
      // Hoeveel van de premie binnen is, met teken: staat de ask boven de
      // premie, dan is het verlies. Dit is het getal dat boven de markering op
      // de balk staat, en afkappen op nul zou daar 0,0 % van maken terwijl de
      // positie 35 % in het rood staat.
      binnen: premie !== null && ask !== null && premie > 0
        ? ((premie - ask) / premie) * 100 : null,
      // De naam, niet het gebruikersnummer: "Volgt: simon" leest als een
      // technisch veld dat per ongeluk op het scherm staat.
      wie_volgt: p.volger || p.wie_volgt, beoordelingsmoment: p.beoordelingsmoment,
      doorgerold_naar: p.doorgerold_naar,
      afwijking: p.afwijking ? 1 : 0, afwijking_soort: p.afwijking_soort,
      gepubliceerd_op: p.gepubliceerd_op,
      open, uitkomst: p.uitkomst,
      stand: open && versePrijs ? standVan(ask, ijk) : null,
    };
  });

  // De zwakste open positie bepaalt de barometer. Niet het gemiddelde: één
  // positie die tegen haar stoploss aanligt vraagt iets van een lid, ook als de
  // twee andere vrijwel afgerond zijn. Zwakste is nu de láágste stand: 1 is
  // onder druk.
  const gemeten = uit.filter((p) => p.open && p.stand !== null);
  const zwakste = gemeten.length ? gemeten.reduce((a, b) => (b.stand < a.stand ? b : a)) : null;

  // Posities die in de markt staan maar niet gemeten konden worden. Die horen
  // genoemd te worden: een voorstel op de halve portefeuille ziet er precies
  // hetzelfde uit als een voorstel dat alles meeweegt.
  const ongemeten = uit.filter((p) => p.open && p.stand === null);
  const inDeMarkt = uit.filter((p) => p.open);

  return {
    posities: uit,
    zwakste: zwakste
      ? { id: zwakste.id, contract: zwakste.contract, stand: zwakste.stand,
          ask: zwakste.ask, stoploss: zwakste.stoploss, plek: zwakste.plek,
          breakeven: zwakste.breakeven, voorbij_de_grens: zwakste.voorbij_de_grens }
      : null,
    voorstel: zwakste ? zwakste.stand : null,
    // Waarom er níéts voorgesteld wordt, is net zo belangrijk als het voorstel.
    waarom_niet: zwakste ? null
      : !inDeMarkt.length ? "geen open positie"
      : inDeMarkt.every((p) => p.ask === null) ? "geen prijs van de broker"
      : inDeMarkt.every((p) => !p.verse_prijs) ? "de prijs is te oud"
      : inDeMarkt.every((p) => !p.ijk) ? "het exitplan is niet te lezen: geen premie, of een stoploss onder break-even"
      : "de posities konden niet gemeten worden",
    ongemeten: ongemeten.map((p) => ({ id: p.id, contract: p.contract })),
    // De vakken gaan mee naar het scherm, zodat de balk niet iets anders kan
    // tonen dan de meter rekent.
    vakken: VAKKEN,
    drempels: d,
  };
}
