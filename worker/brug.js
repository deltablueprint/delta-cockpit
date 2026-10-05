// Wat de brug aflevert, en wat de cockpit ervan weet.
//
// De brug (brug/brug.mjs) luistert naast IB Gateway en duwt elke verandering
// meteen hierheen. Dit bestand neemt dat aan, bewaart het, en vertelt de
// schermen hoe vers het is. Eén kant op: er gaat niets terug naar de broker.

import { spiegel } from "./spiegel.js";

const getal = (w) => (Number.isFinite(Number(w)) ? Number(w) : null);
const kort = (w, n = 200) => (w === null || w === undefined ? null : String(w).slice(0, n));

// Een tijdstip van de brug, in de vorm waarin de database het schrijft. Wat we
// niet kunnen lezen wordt null, en dan valt de aanroeper terug op nu: een
// onleesbaar tijdstip mag nooit als een geldig tijdstip de database in.
import { leesMoment, alsTekst } from "./tijd.js";
const alsMoment = (w) => {
  const d = leesMoment(w);
  if (!d) return null;
  // Iets uit de toekomst is een klok die verkeerd staat. Dan liever niets, dan
  // beslist de ontvanger wat hij ermee doet.
  if (d.getTime() > Date.now() + 60000) return null;
  return alsTekst(d);
};

// Wat je aan de koppeling mag veranderen zonder op de machine in te loggen.
// De brug krijgt ze terug in het antwoord op zijn eigen zending: zo komt een
// wijziging binnen tien seconden aan, zonder dat de cockpit ooit iets naar de
// brug hoeft te sturen. Het verkeer blijft één kant op.
export async function instellingen(env) {
  try {
    const r = await env.DB.prepare(
      "select sleutel, waarde, label, uitleg, soort, volgorde, gewijzigd from brokerinstelling order by volgorde"
    ).all();
    return r.results;
  } catch {
    return [];   // de tabel bestaat nog niet in deze omgeving
  }
}

function alsKaart(lijst) {
  const uit = {};
  for (const r of lijst) uit[r.sleutel] = r.soort === "getal" ? Number(r.waarde) : r.waarde;
  return uit;
}

export async function zetInstellingen(env, ik, waarden = {}) {
  const bestaand = await instellingen(env);
  const werk = [];
  for (const r of bestaand) {
    if (!(r.sleutel in waarden)) continue;
    let w = String(waarden[r.sleutel]);
    if (r.soort === "getal") {
      const n = Number(w);
      if (!Number.isFinite(n) || n <= 0) return { fout: `${r.label} moet een getal boven nul zijn.`, status: 422 };
      w = String(Math.round(n));
    }
    if (r.soort === "ja_nee") w = (w === "1" || w === "true" || w === "ja") ? "1" : "0";
    werk.push(env.DB.prepare(
      "update brokerinstelling set waarde = ?, gewijzigd = datetime('now'), gewijzigd_door = ? where sleutel = ?"
    ).bind(w, ik ? ik.id : null, r.sleutel));
  }

  // De stiltegrens onder de hartslag zetten betekent dat de koppeling altijd
  // op 'weg' staat. Dat is geen instelling maar een vergissing.
  const na = { ...alsKaart(bestaand), ...waarden };
  if (Number(na.stilte_grens_seconden) <= Number(na.hartslag_seconden)) {
    return { fout: "De stiltegrens moet ruim boven de hartslag liggen, anders staat de koppeling altijd op weg.", status: 422 };
  }

  if (werk.length) await env.DB.batch(werk);
  return { ok: true };
}

export async function neemStand(env, pakket = {}) {
  const posities = Array.isArray(pakket.posities) ? pakket.posities : [];
  const gebeurtenissen = Array.isArray(pakket.gebeurtenissen) ? pakket.gebeurtenissen : [];
  // De stand van de onderliggende. Daar meet de barometer mee: hoe ver staat de
  // spot boven de strike. Zonder deze meet hij niets en stelt het systeem niets
  // voor — dat is beter dan een stand op een koers van gisteren.
  const koersen = Array.isArray(pakket.marktstanden) ? pakket.marktstanden : [];
  if (posities.length > 500 || gebeurtenissen.length > 500 || koersen.length > 50) {
    return { fout: "Te veel in één zending.", status: 413 };
  }

  const werk = [
    env.DB.prepare(
      `update brokerverbinding
          set verbonden = ?, laatste_bericht = datetime('now'),
              rekening = ?, kapitaal = ?, reden = ?
        where id = 1`
    ).bind(pakket.verbonden ? 1 : 0, kort(pakket.rekening, 40), getal(pakket.kapitaal), kort(pakket.reden, 60)),
  ];

  // Het hele beeld wordt overschreven: de brug stuurt wat er nú open staat, en
  // wat er niet bij zit, staat niet meer open. Bijhouden met losse wijzigingen
  // zou betekenen dat één gemiste zending het beeld voorgoed laat afwijken.
  // Eén rij per onderliggende, overschreven bij elke hartslag. Dit is een
  // momentopname, geen vastlegging: wat bewaard moet blijven staat in de stroom.
  for (const k of koersen) {
    const naam = kort(k.onderliggend, 40);
    const stand = getal(k.stand);
    // Een stand van 0 of lager is geen koers maar een leeg veld dat door
    // Number() heen is gekomen.
    if (!naam || stand === null || !(stand > 0)) continue;

    // Het moment komt van de brug: dat is wanneer de koers getikt heeft. Het
    // moment van ontvangst zou elke koers altijd vers maken, ook als de beurs
    // dicht is — en dan meet de barometer op de hartslag in plaats van op de
    // markt. Is het onleesbaar, dan valt hij terug op nu en is hij hoogstens
    // te optimistisch over één zending.
    const moment = alsMoment(k.moment);
    werk.push(env.DB.prepare(
      `insert into marktstand (onderliggend, stand, moment, bron)
       values (?, ?, coalesce(?, datetime('now')), 'brug')
       on conflict (onderliggend) do update set
         stand = excluded.stand, moment = excluded.moment, bron = 'brug'`
    ).bind(naam, stand, moment));
  }

  const conids = posities.map((p) => String(p.conid || "")).filter(Boolean);
  if (conids.length) {
    const plek = conids.map(() => "?").join(",");
    werk.push(env.DB.prepare(`delete from brokerpositie where conid not in (${plek})`).bind(...conids));
  } else {
    werk.push(env.DB.prepare("delete from brokerpositie"));
  }

  for (const p of posities) {
    if (!p.conid) continue;
    werk.push(env.DB.prepare(
      `insert into brokerpositie (conid, contract, onderliggend, soort, strike, expiratiedatum,
                                  putcall, multiplier, aantal, gem_kostprijs, marktprijs, waarde,
                                  ongerealiseerd, gerealiseerd, biedprijs, laatprijs, gewijzigd_op)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
       on conflict (conid) do update set
         contract = excluded.contract, onderliggend = excluded.onderliggend,
         soort = excluded.soort, strike = excluded.strike,
         expiratiedatum = excluded.expiratiedatum, putcall = excluded.putcall,
         multiplier = excluded.multiplier, aantal = excluded.aantal,
         gem_kostprijs = excluded.gem_kostprijs, marktprijs = excluded.marktprijs,
         waarde = excluded.waarde, ongerealiseerd = excluded.ongerealiseerd,
         gerealiseerd = excluded.gerealiseerd, biedprijs = excluded.biedprijs,
         laatprijs = excluded.laatprijs, gewijzigd_op = datetime('now')`
    ).bind(
      String(p.conid), kort(p.contract), kort(p.onderliggend, 40), kort(p.soort, 20),
      getal(p.strike), kort(p.expiratiedatum, 10), kort(p.putcall, 4), getal(p.multiplier),
      getal(p.aantal) ?? 0, getal(p.gem_kostprijs), getal(p.marktprijs), getal(p.waarde),
      getal(p.ongerealiseerd), getal(p.gerealiseerd), getal(p.biedprijs), getal(p.laatprijs)
    ));
  }

  // Een uitvoering draagt haar eigen nummer; dezelfde fill mag niet twee keer
  // in het spoor belanden als een zending opnieuw verstuurd wordt.
  for (const g of gebeurtenissen) {
    werk.push(env.DB.prepare(
      `insert or ignore into brokergebeurtenis
         (soort, conid, contract, richting, aantal, van, naar, prijs, uitvoering_id, moment)
       values (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      kort(g.soort, 20) || "positie", kort(g.conid, 20), kort(g.contract),
      kort(g.richting, 10), getal(g.aantal), getal(g.van), getal(g.naar),
      getal(g.prijs), kort(g.uitvoering_id, 60), kort(g.moment, 40)
    ));
  }

  await env.DB.batch(werk);

  // Elke stand die binnenkomt wordt meteen naast de aangekondigde voornemens
  // gelegd. Dáár zit het verschil met wachten tot iemand een scherm opent: je
  // rolt bij Lynx, en een seconde later staat de nieuwe tranche in de cockpit
  // klaar om te publiceren. Mislukt het, dan mag dat de zending niet laten
  // falen — de brug moet door, en de volgende push probeert het opnieuw.
  // De cockpit spiegelt wat er binnenkomt: wat opent bestaat, wat verdwijnt
  // gaat dicht, met de prijzen uit de uitvoeringen. Er valt niets te duiden en
  // niemand hoeft iets te bevestigen. Mislukt het, dan mag dat de zending niet
  // laten falen — de volgende push haalt het in.
  let gespiegeld = null;
  try {
    gespiegeld = await spiegel(env, { id: null },
      await brugPosities(env), await brugUitvoeringen(env));
  } catch { /* de stand is binnen; spiegelen kan bij de volgende push */ }

  // Het antwoord draagt de instellingen: zo haalt de brug ze op zonder dat er
  // ooit iets naar hem toe gestuurd hoeft te worden.
  return {
    ok: true,
    posities: posities.length,
    gebeurtenissen: gebeurtenissen.length,
    gespiegeld,
    instellingen: alsKaart(await instellingen(env)),
  };
}

// ---------------------------------------------------------------------------
// De stroom in dezelfde vorm als het rapport.
//
// De herkenning en het voornemen hoeven niet te weten of ze naar de brug of
// naar een Flex-rapport kijken: ze krijgen posities en uitvoeringen. Wat de
// brug stuurt wordt hier in die vorm gegoten. Strike en expiratie staan niet op
// een uitvoering maar wél op de positie die eruit ontstond; die worden er dus
// bij gezocht op contractnummer.

export async function brugPosities(env) {
  const r = await env.DB.prepare(
    `select conid, contract, onderliggend, strike, expiratiedatum, aantal
       from brokerpositie where aantal <> 0`
  ).all();
  return r.results.map((p) => ({
    conid: p.conid, contract: p.contract, onderliggend: p.onderliggend,
    strike: p.strike, expiratiedatum: p.expiratiedatum,
    aantal: Math.abs(Number(p.aantal) || 0) || null,
  }));
}

export async function brugUitvoeringen(env) {
  const r = await env.DB.prepare(
    `select g.conid, g.contract, g.richting, g.aantal, g.prijs, g.moment,
            p.strike, p.expiratiedatum, p.onderliggend
       from brokergebeurtenis g
       left join brokerpositie p on p.conid = g.conid
      where g.richting in ('koop', 'verkoop')
      order by g.moment, g.id`
  ).all();
  return r.results.map((g) => ({
    conid: g.conid, contract: g.contract, onderliggend: g.onderliggend,
    richting: g.richting, soort: null,
    aantal: Math.abs(Number(g.aantal) || 0) || null,
    prijs_pt: g.prijs, strike: g.strike, expiratiedatum: g.expiratiedatum,
    moment: g.moment, datum: String(g.moment || "").slice(0, 10) || null,
  }));
}

// Wat de schermen lezen: de stand én hoe vers hij is. Die twee horen bij
// elkaar — een getal zonder zijn ouderdom is een bewering.
export async function stand(env) {
  const [verbinding, posities, laatste] = await Promise.all([
    env.DB.prepare("select * from brokerverbinding where id = 1").first(),
    env.DB.prepare("select * from brokerpositie where aantal <> 0 order by expiratiedatum, strike").all(),
    env.DB.prepare(
      "select * from brokergebeurtenis order by id desc limit 25"
    ).all(),
  ]);

  const kaart = alsKaart(await instellingen(env));
  const grens = Number(kaart.stilte_grens_seconden) || 35;

  const stil = await env.DB.prepare(
    "select cast((julianday('now') - julianday(coalesce(laatste_bericht, '2000-01-01'))) * 86400 as integer) as s from brokerverbinding where id = 1"
  ).first();
  const seconden = stil ? Number(stil.s) : null;

  return {
    live: Boolean(verbinding && verbinding.verbonden) && seconden !== null && seconden <= grens,
    stil_seconden: seconden,
    stilte_grens: grens,
    instellingen: await instellingen(env),
    verbonden: Boolean(verbinding && verbinding.verbonden),
    laatste_bericht: verbinding ? verbinding.laatste_bericht : null,
    rekening: verbinding ? verbinding.rekening : null,
    kapitaal: verbinding ? verbinding.kapitaal : null,
    posities: posities.results,
    gebeurtenissen: laatste.results,
  };
}
