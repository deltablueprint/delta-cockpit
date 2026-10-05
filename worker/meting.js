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
  barometer_comfortabel_pct: 35,
  barometer_letop_pct: 60,
  barometer_krap_pct: 80,
  koers_vers_minuten: 20,
  doorrol_minuten: 60,
};

export async function drempels(env) {
  const uit = { ...STANDAARD };
  try {
    const r = await env.DB.prepare(
      "select sleutel, waarde from instelling where archief = 0 and sleutel in " +
      "('barometer_krap_pct','barometer_letop_pct','barometer_comfortabel_pct','koers_vers_minuten','doorrol_minuten')"
    ).all();
    for (const rij of r.results) {
      const n = Number(rij.waarde);
      // Onzin in een instelling mag de meter niet omleggen. Dan liever de
      // standaard dan een stand die nergens op slaat.
      if (Number.isFinite(n) && n > 0) uit[rij.sleutel] = n;
    }
  } catch { /* dan de standaard */ }

  // Lopen de grenzen door elkaar, dan is de inrichting fout. Ook dan hoort er
  // een bruikbare meter uit te komen, en niet een stand die van de volgorde van
  // drie ifs afhangt.
  if (!(uit.barometer_comfortabel_pct < uit.barometer_letop_pct
        && uit.barometer_letop_pct < uit.barometer_krap_pct)) {
    uit.barometer_comfortabel_pct = STANDAARD.barometer_comfortabel_pct;
    uit.barometer_letop_pct = STANDAARD.barometer_letop_pct;
    uit.barometer_krap_pct = STANDAARD.barometer_krap_pct;
    uit.grenzen_rechtgezet = true;
  }
  return uit;
}

// Waar de ask staat op de weg van 0 naar de stoploss, in procent. 0 % is
// waardeloos geëxpireerd, 100 % is eruit volgens het exitplan.
export function opWeg(ask, stoploss) {
  // Number(null) is 0 en Number("") ook. Een ask die er niet is zou daarmee
  // 'waardeloos geëxpireerd' worden, en dat is de rustigste stand die er is.
  if (ask === null || ask === undefined || String(ask).trim() === "") return null;
  if (stoploss === null || stoploss === undefined || String(stoploss).trim() === "") return null;
  const a = Number(ask), s = Number(stoploss);
  if (!Number.isFinite(a) || a < 0) return null;
  if (!Number.isFinite(s) || s <= 0) return null;
  return (a / s) * 100;
}

// Van die plek naar een stand. Buiten dit bestand wordt deze som niet nog eens
// gemaakt: twee plekken die hetzelfde rekenen gaan een keer uit elkaar lopen.
export function standVan(wegPct, d) {
  if (wegPct === null || wegPct === undefined || !Number.isFinite(wegPct)) return null;
  if (wegPct >= 100) return 5;                        // op of over de stoploss
  if (wegPct >= d.barometer_krap_pct) return 4;
  if (wegPct >= d.barometer_letop_pct) return 3;
  if (wegPct >= d.barometer_comfortabel_pct) return 2;
  return 1;
}

// De grenzen als vijf stukken van de weg, voor de balk en de legende. Eén plek,
// zodat de balk niet iets anders kan tonen dan de meter rekent.
export function zones(d) {
  return [
    { stand: 1, van: 0, tot: d.barometer_comfortabel_pct },
    { stand: 2, van: d.barometer_comfortabel_pct, tot: d.barometer_letop_pct },
    { stand: 3, van: d.barometer_letop_pct, tot: d.barometer_krap_pct },
    { stand: 4, van: d.barometer_krap_pct, tot: 100 },
    { stand: 5, van: 100, tot: 120 },                 // over de stoploss
  ];
}

function dagenTot(datum, nu) {
  const a = new Date(`${String(datum || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((a - nu) / 86400000);
}

// Alle posities van een cyclus, gemeten. Eén query, daarna rekenen — dit wordt
// bij elke peiling gesteld.
export async function metingen(env, cyclusId, { nu = null } = {}) {
  const moment = nu ? new Date(nu) : new Date();
  const d = await drempels(env);

  const posities = (await env.DB.prepare(
    `select p.*, b.laatprijs, b.biedprijs, b.marktprijs, b.multiplier, b.gewijzigd_op as prijs_moment
       from positie p
       left join brokerpositie b on b.conid = p.conid
      where p.cyclus = ? and p.archief = 0
      order by p.tranche, p.id`
  ).bind(cyclusId).all()).results;

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

    const resultaat = premie !== null && Number.isFinite(premie) && ask !== null ? premie - ask
      // Een positie die dicht is heeft haar resultaat al vastgelegd; dat staat
      // in de database en hoeft niet uit een ask gerekend te worden die er niet
      // meer is.
      : (p.resultaat_pt !== null && Number.isFinite(Number(p.resultaat_pt)) ? Number(p.resultaat_pt) : null);

    const weg = versePrijs ? opWeg(ask, stoploss) : null;
    const dagen = dagenTot(p.expiratiedatum, moment);

    return {
      id: p.id, contract: p.contract, tranche: p.tranche, status: p.status,
      strike: Number(p.strike) || null, aantal: p.aantal,
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
      // Break-even op de optie: tot hier koop je terug met winst.
      breakeven: premie !== null && Number.isFinite(premie) ? premie : null,
      stoploss,
      tot_stoploss: ask !== null && stoploss !== null ? stoploss - ask : null,
      // Hoeveel van de premie al verdiend is. Dit is wat de balk toont.
      weg,
      binnen: premie !== null && ask !== null && premie > 0
        ? Math.max(0, ((premie - ask) / premie) * 100) : null,
      wie_volgt: p.wie_volgt, beoordelingsmoment: p.beoordelingsmoment,
      doorgerold_naar: p.doorgerold_naar,
      afwijking: p.afwijking ? 1 : 0, afwijking_soort: p.afwijking_soort,
      gepubliceerd_op: p.gepubliceerd_op,
      open, uitkomst: p.uitkomst,
      stand: open ? standVan(weg, d) : null,
    };
  });

  // De zwakste open positie bepaalt de barometer. Niet het gemiddelde: één
  // positie die tegen haar stoploss aanligt vraagt iets van een lid, ook als de
  // twee andere waardeloos staan te worden.
  const gemeten = uit.filter((p) => p.open && p.stand !== null);
  const zwakste = gemeten.length ? gemeten.reduce((a, b) => (b.stand > a.stand ? b : a)) : null;

  // Posities die in de markt staan maar niet gemeten konden worden. Die horen
  // genoemd te worden: een voorstel op de halve portefeuille ziet er precies
  // hetzelfde uit als een voorstel dat alles meeweegt.
  const ongemeten = uit.filter((p) => p.open && p.stand === null);
  const inDeMarkt = uit.filter((p) => p.open);

  return {
    posities: uit,
    zwakste: zwakste
      ? { id: zwakste.id, contract: zwakste.contract, stand: zwakste.stand,
          ask: zwakste.ask, stoploss: zwakste.stoploss, weg: zwakste.weg }
      : null,
    voorstel: zwakste ? zwakste.stand : null,
    // Waarom er níéts voorgesteld wordt, is net zo belangrijk als het voorstel.
    waarom_niet: zwakste ? null
      : !inDeMarkt.length ? "geen open positie"
      : inDeMarkt.every((p) => p.ask === null) ? "geen prijs van de broker"
      : inDeMarkt.every((p) => !p.verse_prijs) ? "de prijs is te oud"
      : inDeMarkt.every((p) => !p.stoploss) ? "er staat geen stoploss op de positie"
      : "de posities konden niet gemeten worden",
    ongemeten: ongemeten.map((p) => ({ id: p.id, contract: p.contract })),
    zones: zones(d),
    drempels: d,
  };
}
