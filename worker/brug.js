// Wat de brug aflevert, en wat de cockpit ervan weet.
//
// De brug (brug/brug.mjs) luistert naast IB Gateway en duwt elke verandering
// meteen hierheen. Dit bestand neemt dat aan, bewaart het, en vertelt de
// schermen hoe vers het is. Eén kant op: er gaat niets terug naar de broker.

const getal = (w) => (Number.isFinite(Number(w)) ? Number(w) : null);
const kort = (w, n = 200) => (w === null || w === undefined ? null : String(w).slice(0, n));

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
  // Het antwoord draagt de instellingen: zo haalt de brug ze op zonder dat er
  // ooit iets naar hem toe gestuurd hoeft te worden.
  return {
    ok: true,
    posities: posities.length,
    gebeurtenissen: gebeurtenissen.length,
    instellingen: alsKaart(await instellingen(env)),
  };
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
