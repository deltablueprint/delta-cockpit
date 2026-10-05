// De meting: waar staat een positie, en wat vragen we daarmee van een lid.
//
// Dit is de ene plek die van een positie een stand maakt. Hij rekent en zegt
// het; hij schrijft niets en hij stelt niets vast. Dat laatste doet een mens,
// op het scherm, met de knop publiceren.
//
// De rekensom is kort en met opzet kort: hoe ver staat de spot boven de strike,
// in procent. Niet de delta — die is zuiverder omdat hij de looptijd meeneemt,
// maar hij komt van de broker en is er dus niet altijd. Een maat die de helft
// van de tijd ontbreekt is geen maat. Zodra de delta betrouwbaar binnenkomt kan
// hij hier als verfijning bij.
//
// De grenzen staan in beheer (0128). Ze gaan bijgesteld worden, en dat hoort
// geen deploy te zijn.

import { leesMoment } from "./tijd.js";

// De vijf treden, van rustig naar druk. De labels staan in db_choice, niet hier
// — ze gaan naar de leden en gaan dus veranderen.
export const STANDEN = [1, 2, 3, 4, 5];

const STANDAARD = {
  barometer_krap_pct: 2,
  barometer_letop_pct: 4,
  barometer_comfortabel_pct: 6,
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
  if (!(uit.barometer_krap_pct < uit.barometer_letop_pct
        && uit.barometer_letop_pct < uit.barometer_comfortabel_pct)) {
    uit.barometer_krap_pct = STANDAARD.barometer_krap_pct;
    uit.barometer_letop_pct = STANDAARD.barometer_letop_pct;
    uit.barometer_comfortabel_pct = STANDAARD.barometer_comfortabel_pct;
    uit.grenzen_rechtgezet = true;
  }
  return uit;
}

// Van afstand naar stand. Buiten dit bestand wordt deze som niet nog eens
// gemaakt: twee plekken die hetzelfde rekenen gaan een keer uit elkaar lopen.
export function standVan(afstandPct, d) {
  if (afstandPct === null || afstandPct === undefined || !Number.isFinite(afstandPct)) return null;
  if (afstandPct < 0) return 5;
  if (afstandPct < d.barometer_krap_pct) return 4;
  if (afstandPct < d.barometer_letop_pct) return 3;
  if (afstandPct < d.barometer_comfortabel_pct) return 2;
  return 1;
}

// De koers van de onderliggende, als hij vers genoeg is. Een stand op een koers
// van gisteren is erger dan geen stand: hij ziet er even stellig uit.
export async function koers(env, onderliggend, { nu = null } = {}) {
  if (!onderliggend) return null;
  const r = await env.DB.prepare(
    "select stand, moment, bron from marktstand where onderliggend = ?"
  ).bind(onderliggend).first();
  if (!r) return null;
  const d = await drempels(env);

  // Zelf lezen en niet via urenSinds: die geeft met opzet 0 terug voor iets
  // onleesbaars of iets uit de toekomst, en dan zou precies zo'n tijdstip hier
  // als 'net binnen' gelden. Een stand op een onbekende koers is stelliger dan
  // geen stand, en daarmee gevaarlijker.
  const toen = leesMoment(r.moment);
  const nu2 = nu ? new Date(nu) : new Date();
  const minuten = toen && !Number.isNaN(nu2.getTime()) ? (nu2 - toen) / 60000 : null;

  const stand = Number(r.stand);
  const bruikbaar = Number.isFinite(stand) && stand > 0;

  return {
    stand: bruikbaar ? stand : null,
    moment: r.moment, bron: r.bron,
    // Vers is: leesbaar, niet uit de toekomst (meer dan een minuut speling voor
    // klokverschil), niet te oud, en een getal waar je mee kunt rekenen.
    vers: bruikbaar && minuten !== null && minuten >= -1 && minuten <= d.koers_vers_minuten,
    minuten_oud: minuten === null ? null : Math.round(minuten),
    onleesbaar: minuten === null,
  };
}

function dagenTot(datum, nu) {
  const a = new Date(`${String(datum || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((a - nu) / 86400000);
}

// Alle open posities van een cyclus, gemeten. Eén query, daarna rekenen — dit
// wordt bij elke peiling gesteld.
export async function metingen(env, cyclusId, { nu = null } = {}) {
  const moment = nu ? new Date(nu) : new Date();
  const d = await drempels(env);

  const posities = (await env.DB.prepare(
    `select p.*, b.laatprijs, b.biedprijs, b.marktprijs, b.multiplier,
            b.onderliggend as broker_onderliggend
       from positie p
       left join brokerpositie b on b.conid = p.conid
      where p.cyclus = ? and p.archief = 0
      order by p.tranche, p.id`
  ).bind(cyclusId).all()).results;

  // Eén koers per onderliggende, niet per positie: anders staat dezelfde index
  // op twee regels met twee verschillende standen.
  const koersen = {};
  for (const p of posities) {
    const o = p.broker_onderliggend || "OESX";
    if (!(o in koersen)) koersen[o] = await koers(env, o, { nu });
  }

  // Welke posities in de markt staan. Niet 'alles wat niet gesloten is': een
  // tranche die nog op uitvoering wacht draagt de strike van het bésluit, en er
  // staat geen contract tegenover. Die zou de barometer naar 5 kunnen duwen
  // zonder dat er iets te vrezen valt.
  const IN_DE_MARKT = new Set(["bewaken", "publiceren naar leden", "uitvoering vastgelegd"]);

  const uit = posities.map((p) => {
    const open = IN_DE_MARKT.has(String(p.status || "")) && !p.uitkomst
      && Number(p.aantal) > 0;
    const o = p.broker_onderliggend || "OESX";
    const k = koersen[o];
    const spot = k && k.vers ? k.stand : null;
    const strike = Number(p.strike) || null;

    const afstand = spot && strike ? ((spot - strike) / spot) * 100 : null;
    // Number(null) is 0, en dat is hier geen onschuldig verschil: een premie van
    // 0 maakt break-even gelijk aan de strike, geeft een buffer die positief
    // lijkt en een open resultaat van min de hele ask. Vier verzonnen getallen
    // op een scherm waar iemand een bericht op baseert.
    const premie = p.ontvangen_premie_pt === null || p.ontvangen_premie_pt === undefined
      || String(p.ontvangen_premie_pt).trim() === "" ? null : Number(p.ontvangen_premie_pt);
    // Terugkopen doe je tegen de laatprijs. Is die er niet, dan de marktprijs,
    // en dan zeggen we erbij dat het de marktprijs is.
    const ask = p.laatprijs !== null && p.laatprijs !== undefined ? Number(p.laatprijs)
              : p.marktprijs !== null && p.marktprijs !== undefined ? Number(p.marktprijs) : null;
    const bod = p.biedprijs !== null && p.biedprijs !== undefined ? Number(p.biedprijs) : null;
    const resultaat = premie !== null && Number.isFinite(premie) && ask !== null ? premie - ask
      // Een positie die dicht is heeft haar resultaat al vastgelegd; die staat in
      // de database en hoeft niet uit een ask gerekend te worden die er niet meer is.
      : (Number.isFinite(Number(p.resultaat_pt)) && p.resultaat_pt !== null ? Number(p.resultaat_pt) : null);
    const breakeven = strike && premie !== null && Number.isFinite(premie) ? strike - premie : null;
    const buffer = spot && breakeven ? ((spot - breakeven) / spot) * 100 : null;
    const dagen = dagenTot(p.expiratiedatum, moment);

    return {
      id: p.id, contract: p.contract, tranche: p.tranche, status: p.status,
      strike, aantal: p.aantal, expiratiedatum: p.expiratiedatum, dagen,
      premie: premie !== null && Number.isFinite(premie) ? premie : null,
      ask, bod, ask_is_marktprijs: p.laatprijs === null || p.laatprijs === undefined,
      resultaat,
      // In euro, met de multiplier van het contract en het werkelijke aantal.
      // Het scherm rekende dit zelf met een vaste 10 en `aantal || 1`: bij een
      // aantal van 0 of null stond er het bedrag van één contract, en bij een
      // negatief ingevoerd aantal klapte het teken om.
      resultaat_eur: resultaat !== null && Number(p.aantal) > 0
        ? resultaat * (Number(p.multiplier) > 0 ? Number(p.multiplier) : 10) * Number(p.aantal)
        : null,
      breakeven, buffer, spot, afstand,
      stoploss: Number(p.stoploss_ask) || null,
      tot_stoploss: ask !== null && p.stoploss_ask ? Number(p.stoploss_ask) - ask : null,
      wie_volgt: p.wie_volgt, beoordelingsmoment: p.beoordelingsmoment,
      doorgerold_naar: p.doorgerold_naar,
      afwijking: p.afwijking ? 1 : 0, afwijking_soort: p.afwijking_soort,
      gepubliceerd_op: p.gepubliceerd_op,
      open, uitkomst: p.uitkomst,
      stand: open ? standVan(afstand, d) : null,
    };
  });

  // De zwakste open positie bepaalt de barometer. Niet het gemiddelde: één
  // positie die onder de strike staat vraagt iets van een lid, ook als de twee
  // andere ruim staan.
  const gemeten = uit.filter((p) => p.open && p.stand !== null);
  const zwakste = gemeten.length
    ? gemeten.reduce((a, b) => (b.stand > a.stand ? b : a))
    : null;

  // Posities die in de markt staan maar niet gemeten konden worden. Die horen
  // genoemd te worden: een voorstel dat op de halve portefeuille gebaseerd is
  // ziet er precies hetzelfde uit als een voorstel dat alles meeweegt.
  const ongemeten = uit.filter((p) => p.open && p.stand === null);

  const geenKoers = Object.values(koersen).every((k) => !k || k.stand === null);
  const teOud = Object.values(koersen).some((k) => k && k.stand !== null && !k.vers);

  return {
    posities: uit,
    zwakste: zwakste ? { id: zwakste.id, contract: zwakste.contract, stand: zwakste.stand, afstand: zwakste.afstand } : null,
    voorstel: zwakste ? zwakste.stand : null,
    koersen,
    // Waarom er níéts voorgesteld wordt, is net zo belangrijk als het voorstel.
    // Zonder deze regel staat er een leeg scherm zonder uitleg.
    waarom_niet: zwakste ? null
      : !uit.some((p) => p.open) ? "geen open positie"
      : geenKoers ? "geen koers van de onderliggende"
      : teOud ? "de koers is te oud"
      : "de posities konden niet gemeten worden",
    // En als er wél gemeten is, maar niet alles: dan is het voorstel waar maar
    // niet volledig, en dat hoort op het scherm te staan.
    ongemeten: ongemeten.map((p) => ({ id: p.id, contract: p.contract })),
    drempels: d,
  };
}
