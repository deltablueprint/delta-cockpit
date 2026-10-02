// Voorwaarden overnemen uit eerdere cycli.
//
// Elke cyclus heeft zijn eigen voorwaarden — ze worden immers per cyclus
// gemeten — maar de vráág blijft vaak dezelfde: 'daling ten opzichte van de
// vorige top', 'VSTOXX-bandbreedte'. Die opnieuw intypen is werk zonder
// opbrengst, en levert bovendien kleine verschillen in naamgeving op waardoor
// je ze later niet meer naast elkaar kunt leggen.
//
// Wat hier gekopieerd wordt is de vraag, niet het antwoord: naam, soort en
// bron gaan mee, de gemeten waarde en de status niet.

export async function sjablonen(env, cyclusId) {
  const bestaand = (await env.DB.prepare(
    "select lower(naam) as naam from voorwaarde where cyclus = ? and archief = 0"
  ).bind(cyclusId).all()).results.map((r) => r.naam);

  const rijen = (await env.DB.prepare(
    `select naam, soort, bron, max(cyclus) as laatste, count(*) as keer
       from voorwaarde
      where archief = 0 and cyclus <> ?
      group by lower(naam), soort
      order by laatste desc, naam`
  ).bind(cyclusId).all()).results;

  return rijen
    .filter((r) => !bestaand.includes(String(r.naam).toLowerCase()))
    .map((r) => ({
      sleutel: `${r.soort}|${r.naam}`,
      naam: r.naam,
      soort: r.soort,
      bron: r.bron,
      keer: r.keer,
    }));
}

export async function importeer(env, ik, cyclusId, sleutels) {
  if (!Array.isArray(sleutels) || !sleutels.length) return { fout: "Niets gekozen.", status: 400 };

  const beschikbaar = await sjablonen(env, cyclusId);
  const kiezen = beschikbaar.filter((b) => sleutels.includes(b.sleutel));
  if (!kiezen.length) return { fout: "Die voorwaarden staan er al, of bestaan niet meer.", status: 400 };

  const begin = (await env.DB.prepare(
    "select coalesce(max(volgorde), 0) as n from voorwaarde where cyclus = ?"
  ).bind(cyclusId).first()).n;

  const opdrachten = [];
  kiezen.forEach((k, i) => {
    opdrachten.push(env.DB.prepare(
      `insert into voorwaarde (cyclus, naam, soort, bron, status, volgorde)
       values (?, ?, ?, ?, 'niet gemeten', ?)`
    ).bind(cyclusId, k.naam, k.soort, k.bron, begin + (i + 1) * 10));
  });
  opdrachten.push(env.DB.prepare(
    `insert into audit (wie, tabel, record, soort, gebeurtenis, nieuwe_waarde)
     values (?, 'cyclus', ?, 'gebeurtenis', 'voorwaarden overgenomen', ?)`
  ).bind(ik.id, cyclusId, kiezen.map((k) => k.naam).join(", ")));

  await env.DB.batch(opdrachten);
  return { overgenomen: kiezen.length };
}
