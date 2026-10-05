// De drempels van de barometer: lezen en zetten.
//
// Eén rij per stand, met de grens waarop je die stand binnenkomt. De ask zakt
// van verlies naar winst, dus de grens is de bovenkant van het vak.
//
// Break-even ligt vast: dat is de ask gelijk aan de ontvangen premie. Het staat
// wel in de lijst — zonder dat punt is de schaal niet te lezen — maar het is
// geen keuze en wordt dus geweigerd als iemand het toch probeert te zetten.

const EENHEDEN = new Set(["punten", "pct_premie"]);

export async function drempelsVoorScherm(env) {
  const rijen = (await env.DB.prepare(
    `select d.stand, d.grens_waarde, d.grens_eenheid, d.vast, d.toelichting, d.revisie,
            c.label, c.kleur
       from barometerdrempel d
       left join db_choice c on c.tabel = 'barometerstand' and c.kolom = 'stand'
                            and c.waarde = cast(d.stand as text) and c.actief = 1
      where d.archief = 0
      order by d.stand`
  ).all()).results;

  return { drempels: rijen };
}

export async function zetDrempels(env, ik, body) {
  const wat = Array.isArray(body && body.drempels) ? body.drempels : null;
  if (!wat || !wat.length) return { fout: "Er is niets om te zetten.", status: 400 };

  const nu = (await env.DB.prepare(
    "select stand, grens_waarde, grens_eenheid, vast, revisie from barometerdrempel where archief = 0"
  ).all()).results;
  const bij = new Map(nu.map((r) => [Number(r.stand), r]));

  // Eerst alles nalopen, dan pas schrijven. Een halve schaal is erger dan een
  // geweigerde: hij zou meten op een volgorde die niemand zo bedoeld heeft.
  const teZetten = [];
  for (const w of wat) {
    const stand = Number(w.stand);
    const oud = bij.get(stand);
    if (!oud) return { fout: `Stand ${w.stand} bestaat niet.`, status: 400 };
    if (Number(oud.vast) === 1) continue;        // break-even: stil overslaan

    const waarde = Number(String(w.waarde).replace(",", "."));
    if (!Number.isFinite(waarde) || waarde <= 0) {
      return { fout: `De grens van stand ${stand} moet een getal boven nul zijn.`, stand, status: 422 };
    }
    if (!EENHEDEN.has(w.eenheid)) {
      return { fout: `'${w.eenheid}' is geen eenheid. Het is punten of procent van de premie.`, stand, status: 422 };
    }
    if (w.eenheid === "pct_premie" && waarde > 300) {
      return { fout: `Een grens van ${waarde} % van de premie is geen grens meer.`, stand, status: 422 };
    }
    teZetten.push({ stand, waarde, eenheid: w.eenheid, oud });
  }

  // De schaal moet van verlies naar winst aflopen. Of dat zo is hangt bij een
  // percentage af van de premie, dus toetsen we tegen een premie van 100: dan
  // is een procent een punt en zijn de vijf grenzen op één lijn te leggen.
  const na = new Map(nu.map((r) => [Number(r.stand), { waarde: Number(r.grens_waarde), eenheid: r.grens_eenheid }]));
  for (const t of teZetten) na.set(t.stand, { waarde: t.waarde, eenheid: t.eenheid });
  const alsAsk = (g) => (g.eenheid === "punten" ? g.waarde : g.waarde);   // premie 100
  for (let stand = 1; stand < 5; stand++) {
    const hoog = alsAsk(na.get(stand)), laag = alsAsk(na.get(stand + 1));
    if (!(hoog > laag)) {
      return {
        fout: "De grenzen moeten aflopen van verlies naar winst. Bij een premie van 100 punten "
            + `staat stand ${stand + 1} nu niet onder stand ${stand}.`,
        stand: stand + 1, status: 422,
      };
    }
  }

  for (const t of teZetten) {
    if (Number(t.oud.grens_waarde) === t.waarde && t.oud.grens_eenheid === t.eenheid) continue;
    await env.DB.prepare(
      `update barometerdrempel set grens_waarde = ?, grens_eenheid = ?, revisie = revisie + 1
        where stand = ?`
    ).bind(t.waarde, t.eenheid, t.stand).run();
    // Wie de schaal verzet, verzet wat alle leden te zien krijgen. Dat hoort in
    // de audit trail te staan, met de oude waarde erbij.
    await env.DB.prepare(
      `insert into audit (wie, tabel, record, soort, veld, oude_waarde, nieuwe_waarde)
       values (?, 'barometerdrempel', ?, 'veld', 'grens', ?, ?)`
    ).bind(ik && ik.id ? ik.id : null, t.stand,
           `${t.oud.grens_waarde} ${t.oud.grens_eenheid}`, `${t.waarde} ${t.eenheid}`).run();
  }

  return await drempelsVoorScherm(env);
}
