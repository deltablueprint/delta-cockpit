// De events uit de periode van een cyclus bijzetten.
//
// Wat het systeem doet: de regel aanmaken voor elk event dat in de looptijd
// valt. Wat het niet doet: de behandeling kiezen. Die blijft 'nog te wegen'
// tot een mens hem zet — een systeem dat 'accepteren' invult, verzint een
// afspraak die niemand gemaakt heeft.
//
// Al vastgelegde behandelingen blijven staan. Verschuift de doelexpiratie,
// dan komen de nieuwe events erbij; wat eruit valt blijft staan, want daar is
// over nagedacht.

export async function vulEventsBij(env, cyclusId) {
  const cyclus = await env.DB.prepare(
    "select id, geopend_op, doelexpiratie, afgesloten_op from cyclus where id = ?"
  ).bind(cyclusId).first();
  if (!cyclus || !cyclus.geopend_op) return { bijgezet: 0 };

  const einde = cyclus.doelexpiratie || cyclus.afgesloten_op;
  if (!einde) return { bijgezet: 0 };

  const uitkomst = await env.DB.prepare(
    `insert or ignore into cyclus_event (cyclus, event, behandeling, zwaarte)
     select ?, e.id, 'nog te wegen', e.zwaarte
       from event e
      where e.archief = 0 and e.datum >= ? and e.datum <= ?`
  ).bind(cyclusId, cyclus.geopend_op, einde).run();

  return { bijgezet: uitkomst.meta ? uitkomst.meta.changes || 0 : 0 };
}

// En andersom: komt er een event bij — met de hand of uit een document — dan
// hoort het in de lopende cycli te verschijnen waar het binnen de looptijd
// valt. Anders zou je een event moeten invoeren en daarna elke cyclus nog
// eens aanraken om het te zien.
export async function vulCyclitBij(env, eventId) {
  const event = await env.DB.prepare(
    "select id, datum, zwaarte, archief from event where id = ?"
  ).bind(eventId).first();
  if (!event || !event.datum || event.archief) return { bijgezet: 0 };

  const uitkomst = await env.DB.prepare(
    `insert or ignore into cyclus_event (cyclus, event, behandeling, zwaarte)
     select c.id, ?, 'nog te wegen', ?
       from cyclus c
      where c.archief = 0
        and c.geopend_op is not null and c.geopend_op <= ?
        and coalesce(c.doelexpiratie, c.afgesloten_op) >= ?`
  ).bind(eventId, event.zwaarte, event.datum, event.datum).run();

  return { bijgezet: uitkomst.meta ? uitkomst.meta.changes || 0 : 0 };
}

// Na een import: alle cycli bijwerken waarvan de looptijd over een van de
// ingelezen datums loopt. Eén ronde per cyclus, niet per event.
export async function vulCycliBijVoorPeriode(env, datums) {
  if (!datums || !datums.length) return { bijgezet: 0 };
  const van = datums.reduce((a, b) => (b < a ? b : a));
  const tot = datums.reduce((a, b) => (b > a ? b : a));

  const cycli = (await env.DB.prepare(
    `select id from cyclus
      where archief = 0 and geopend_op is not null
        and geopend_op <= ? and coalesce(doelexpiratie, afgesloten_op) >= ?`
  ).bind(tot, van).all()).results;

  let bijgezet = 0;
  for (const c of cycli) bijgezet += (await vulEventsBij(env, c.id)).bijgezet;
  return { bijgezet };
}
