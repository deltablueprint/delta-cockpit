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
