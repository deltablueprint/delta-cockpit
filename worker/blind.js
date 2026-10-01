// De afscherming van inzendingen.
//
// Zolang het quorum niet gehaald is, zie je van andermans inzending alleen
// dát er verstuurd is — niet wát. Dat is een leesregel op de tabel en geen
// schermtruc: hij geldt dus ook in de lijst, in een export en overal waar de
// API deze rijen teruggeeft (BOUWSPEC 5.4, 10.0e punt 2).

const DICHT = [
  "positie", "strike", "expiratiedatum", "inzet_pct",
  "reden", "motivering", "intuitie", "wat_ik_zag",
];

// Welke beoordelingsmomenten open zijn. Eén vraag voor alle rijen samen.
async function openMomenten(env, ids) {
  const open = new Set();
  if (!ids.length) return open;
  const lijst = ids.map(() => "?").join(", ");
  const r = await env.DB.prepare(
    `select id from beoordelingsmoment where id in (${lijst}) and quorum_gehaald_op is not null`
  ).bind(...ids).all();
  for (const rij of r.results) open.add(rij.id);
  return open;
}

export async function schermAf(env, ik, tabelnaam, rijen) {
  if (tabelnaam !== "inzending" || !rijen || !rijen.length) return rijen;

  // Een lijst toont niet alle kolommen, dus bij wie een inzending hoort staat
  // er niet altijd bij. Dan haalt de regel die context zelf op: zonder die
  // vangst zou een lijst alles afschermen, ook ná het onthullen.
  const context = {};
  const onbekend = rijen.filter((r) => r.beoordelingsmoment === undefined || r.deelnemer === undefined);
  if (onbekend.length) {
    const ids = onbekend.map((r) => r.id).filter(Boolean);
    if (ids.length) {
      const r = await env.DB.prepare(
        `select id, beoordelingsmoment, deelnemer from inzending where id in (${ids.map(() => "?").join(", ")})`
      ).bind(...ids).all();
      for (const rij of r.results) context[rij.id] = rij;
    }
  }
  const hoortBij = (rij) => context[rij.id] || rij;

  const ids = [...new Set(rijen.map((r) => hoortBij(r).beoordelingsmoment).filter(Boolean))];
  const open = await openMomenten(env, ids);

  return rijen.map((rij) => {
    if (hoortBij(rij).deelnemer === ik.id) return rij;
    if (open.has(hoortBij(rij).beoordelingsmoment)) return rij;
    const uit = { ...rij, afgeschermd: 1 };
    for (const kolom of DICHT) if (kolom in uit) uit[kolom] = null;
    return uit;
  });
}

// Eén rij, voor het recordscherm. Dezelfde regel, zodat er geen tweede
// waarheid ontstaat.
export async function schermAfEen(env, ik, tabelnaam, rij) {
  if (!rij) return rij;
  const uit = await schermAf(env, ik, tabelnaam, [rij]);
  return uit[0];
}
