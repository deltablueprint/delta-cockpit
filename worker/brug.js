// Wat de brug aflevert, en wat de cockpit ervan weet.
//
// De brug (brug/brug.mjs) luistert naast IB Gateway en duwt elke verandering
// meteen hierheen. Dit bestand neemt dat aan, bewaart het, en vertelt de
// schermen hoe vers het is. Eén kant op: er gaat niets terug naar de broker.

const getal = (w) => (Number.isFinite(Number(w)) ? Number(w) : null);
const kort = (w, n = 200) => (w === null || w === undefined ? null : String(w).slice(0, n));

// Hoe lang stilte nog normaal is. De brug stuurt elke tien seconden een
// hartslag; drie keer niets is geen toeval meer.
const STILTE_SECONDEN = 35;

export async function neemStand(env, pakket = {}) {
  const posities = Array.isArray(pakket.posities) ? pakket.posities : [];
  const gebeurtenissen = Array.isArray(pakket.gebeurtenissen) ? pakket.gebeurtenissen : [];
  if (posities.length > 500 || gebeurtenissen.length > 500) {
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
                                  ongerealiseerd, gerealiseerd, gewijzigd_op)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
       on conflict (conid) do update set
         contract = excluded.contract, onderliggend = excluded.onderliggend,
         soort = excluded.soort, strike = excluded.strike,
         expiratiedatum = excluded.expiratiedatum, putcall = excluded.putcall,
         multiplier = excluded.multiplier, aantal = excluded.aantal,
         gem_kostprijs = excluded.gem_kostprijs, marktprijs = excluded.marktprijs,
         waarde = excluded.waarde, ongerealiseerd = excluded.ongerealiseerd,
         gerealiseerd = excluded.gerealiseerd, gewijzigd_op = datetime('now')`
    ).bind(
      String(p.conid), kort(p.contract), kort(p.onderliggend, 40), kort(p.soort, 20),
      getal(p.strike), kort(p.expiratiedatum, 10), kort(p.putcall, 4), getal(p.multiplier),
      getal(p.aantal) ?? 0, getal(p.gem_kostprijs), getal(p.marktprijs), getal(p.waarde),
      getal(p.ongerealiseerd), getal(p.gerealiseerd)
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
  return { ok: true, posities: posities.length, gebeurtenissen: gebeurtenissen.length };
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

  const stil = await env.DB.prepare(
    "select cast((julianday('now') - julianday(coalesce(laatste_bericht, '2000-01-01'))) * 86400 as integer) as s from brokerverbinding where id = 1"
  ).first();
  const seconden = stil ? Number(stil.s) : null;

  return {
    live: Boolean(verbinding && verbinding.verbonden) && seconden !== null && seconden <= STILTE_SECONDEN,
    stil_seconden: seconden,
    stilte_grens: STILTE_SECONDEN,
    verbonden: Boolean(verbinding && verbinding.verbonden),
    laatste_bericht: verbinding ? verbinding.laatste_bericht : null,
    rekening: verbinding ? verbinding.rekening : null,
    kapitaal: verbinding ? verbinding.kapitaal : null,
    posities: posities.results,
    gebeurtenissen: laatste.results,
  };
}
