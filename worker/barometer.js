// De barometer: hoeveel aandacht deze cyclus van een lid vraagt.
//
// Eén vraag, één schaal van 1 tot 5, waarbij 1 rustig is. Daarnaast, apart, het
// venster: stappen we in. Die twee lopen uit elkaar — het kapitaal kan vastzitten
// terwijl er niets aan de hand is — en één meter voor allebei zou dan moeten
// liegen.
//
// De labels van de standen staan in db_choice, niet hier. Ze gaan naar de leden,
// dus ze gaan nog veranderen, en dat hoort geen deploy te zijn.

import { log } from "./stroom.js";

// Het verloop van het venster, in volgorde. Het gaat niet over of wíj kunnen
// instappen maar over de voorbereidingstijd van een lid: elke maand ligt het
// instapmoment anders, en wie pas hoort dat we erin zitten als we erin zitten,
// is mentaal te laat.
//
// 'opent_binnenkort' en 'open' worden nooit door het systeem voorgesteld. Dat is
// een oordeel over de markt, en juist die twee zijn voor een lid het meeste
// waard — een systeem dat ze zelf zet, zet ze een keer verkeerd.
//
// 'Gemist' staat er bewust niet bij. Dat zegt iets over één lid — hij heeft niet
// aangegeven de positie gevolgd te hebben toen de stand naar 'in positie' ging —
// en niet over het venster, dat tegen iedereen hetzelfde zegt. Het hoort op de
// ledenkant, en die bestaat nog niet.
export const VENSTERS = [
  "pre_analyse", "besluit", "opent_binnenkort", "open", "in_positie", "afgerond",
];

async function labels(env, kolom) {
  try {
    const r = await env.DB.prepare(
      "select waarde, label, kleur from db_choice where tabel = 'barometerstand' and kolom = ? and actief = 1 order by volgorde"
    ).bind(kolom).all();
    return r.results;
  } catch {
    return [];
  }
}

// De stand nu: wat wij vastgesteld hebben, en wat de leden ervan weten. Die twee
// zijn met opzet twee velden. Zolang ze verschillen loopt er een achterstand, en
// dat hoort niet weggerekend te worden tot één getal.
export async function huidig(env, cyclusId) {
  const wij = await env.DB.prepare(
    `select * from barometerstand where cyclus = ? and archief = 0
      order by vastgesteld_op desc, id desc limit 1`
  ).bind(cyclusId).first();

  const zij = await env.DB.prepare(
    `select * from barometerstand where cyclus = ? and archief = 0 and gepubliceerd_op is not null
      order by gepubliceerd_op desc, id desc limit 1`
  ).bind(cyclusId).first();

  const standen = await labels(env, "stand");
  const vensters = await labels(env, "venster");
  const noem = (lijst, w) => {
    const k = lijst.find((x) => String(x.waarde) === String(w));
    return k ? { waarde: w, label: k.label, kleur: k.kleur } : { waarde: w, label: String(w), kleur: "grijs" };
  };

  return {
    wij: wij ? { ...wij, stand: noem(standen, wij.stand), venster: noem(vensters, wij.venster) } : null,
    leden: zij ? { ...zij, stand: noem(standen, zij.stand), venster: noem(vensters, zij.venster) } : null,
    // Weten de leden wat wij weten? Dit is dezelfde vraag als de achterstand,
    // maar dan voor dit ene ding.
    gelijk: !!wij && !!zij && wij.id === zij.id,
    schaal: standen,
    vensters,
  };
}

// Het systeem stelt voor. Dat wordt een gebeurtenis, de motor maakt er een kaart
// van, en pas het antwoord op die kaart stelt de stand vast. Hier gebeurt dus
// niets definitiefs.
export async function stelVoor(env, { cyclus, naar, venster = null, reden = null }) {
  const nu = await huidig(env, cyclus);
  const van = nu.wij ? nu.wij.stand.waarde : null;
  if (String(van) === String(naar) && (!venster || (nu.wij && nu.wij.venster.waarde === venster))) {
    return { ok: true, overgeslagen: "staat al zo" };
  }

  const id = await log(env, null, {
    bron: "meting", soort: "barometer_voorstel", cyclus,
    titel: van ? `Barometer ${van} → ${naar}` : `Barometer op ${naar}`,
    detail: reden,
    feiten: { van, naar, venster, reden },
  });

  return { ok: true, gebeurtenis: id };
}

// Een mens stelt vast. Dit is het enige dat een stand echt zet.
export async function stelVast(env, ik, { cyclus, stand, venster, reden, gebeurtenis = null }) {
  const n = Number(stand);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return { fout: "De stand loopt van 1 tot 5.", status: 400 };
  }
  if (!VENSTERS.includes(venster)) {
    return { fout: `'${venster}' is geen venster. Het loopt van pre-analyse tot afgerond.`, status: 400 };
  }
  // Zonder reden is een stand een getal zonder verhaal, en precies dat verhaal
  // is wat er straks aan de leden verteld wordt.
  if (!String(reden || "").trim()) {
    return { fout: "Zeg waarom de stand verandert. Dat is wat de leden lezen.", status: 400 };
  }

  const c = await env.DB.prepare("select id, label from cyclus where id = ?").bind(cyclus).first();
  if (!c) return { fout: "Die cyclus bestaat niet.", status: 404 };

  const nu = await huidig(env, cyclus);
  if (nu.wij && String(nu.wij.stand.waarde) === String(n) && nu.wij.venster.waarde === venster) {
    return { fout: "De barometer staat al zo.", status: 409 };
  }

  const gemaakt = await env.DB.prepare(
    `insert into barometerstand (cyclus, stand, venster, reden, herkomst, gebeurtenis, vastgesteld_door)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    cyclus, n, venster, String(reden).trim().slice(0, 1000),
    gebeurtenis ? "voorstel" : "mens", gebeurtenis, ik && ik.id ? ik.id : null
  ).run();

  const id = gemaakt.meta ? gemaakt.meta.last_row_id : null;

  await log(env, ik, {
    bron: "mens", soort: "barometer_vastgesteld", cyclus,
    titel: nu.wij ? `Barometer ${nu.wij.stand.waarde} → ${n}` : `Barometer op ${n}`,
    detail: String(reden).trim().slice(0, 400),
    feiten: { van: nu.wij ? nu.wij.stand.waarde : null, naar: n, venster, barometerstand: id },
  });

  return { ok: true, barometerstand: id, bij_de_leden: false };
}

// Een stand is pas bij de leden als het bericht erover verstuurd is. Dit wordt
// aangeroepen vanuit het versturen, niet als eigen handeling: er is geen knop
// 'markeer als gemeld' zonder dat er iets gemeld is.
export async function meldGepubliceerd(env, cyclusId, publicatieId) {
  // Welke stand dit bericht ging vertellen staat vast en hoeft niet geraden te
  // worden: het bericht kwam uit een kaart, en de stand die uit diezelfde kaart
  // is vastgelegd draagt dezelfde gebeurtenis.
  //
  // Raden ging mis en dat was niet academisch. Stand 3 vaststellen, een bericht
  // erover opstellen, dan stand 5 vaststellen, dan het bericht over 3 versturen:
  // dan kreeg stand 5 het stempel 'bij de leden'. De leden hadden 3 gelezen, het
  // systeem beweerde 5, en omdat wij en zij daarmee 'gelijk' stonden werd 5
  // nooit meer gemeld.
  const bericht = await env.DB.prepare(
    "select gebeurtenis from publicatie where id = ?"
  ).bind(publicatieId).first();

  let stand = null;
  if (bericht && bericht.gebeurtenis) {
    stand = await env.DB.prepare(
      `select id, gepubliceerd_op from barometerstand
        where cyclus = ? and archief = 0 and gebeurtenis = ?
        order by vastgesteld_op desc, id desc limit 1`
    ).bind(cyclusId, bericht.gebeurtenis).first();
  }

  // Een bericht dat niet uit een kaart kwam — met de hand opgesteld — hoort bij
  // de stand die gold toen het werd klaargezet. Dat is de nieuwste stand die op
  // dat moment al bestond, niet per se de nieuwste van nu.
  if (!stand) {
    stand = await env.DB.prepare(
      `select b.id, b.gepubliceerd_op from barometerstand b
         join publicatie p on p.id = ?
        where b.cyclus = ? and b.archief = 0 and b.vastgesteld_op <= p.aangemaakt_op
        order by b.vastgesteld_op desc, b.id desc limit 1`
    ).bind(publicatieId, cyclusId).first();
  }

  if (!stand || stand.gepubliceerd_op) return null;

  await env.DB.prepare(
    "update barometerstand set gepubliceerd_op = datetime('now'), publicatie = ?, revisie = revisie + 1 where id = ?"
  ).bind(publicatieId, stand.id).run();
  return stand.id;
}
