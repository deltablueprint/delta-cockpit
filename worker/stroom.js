// De stroom: één tijdlijn per cyclus.
//
// Eén aanroep, één regel. Schrijven mag nooit de handeling breken waar het bij
// hoort: een mislukte log is vervelend, een mislukte spiegeling is erger. Alles
// hier vangt zijn eigen fouten op en geeft null terug.
//
//   await log(env, ik, {
//     bron: "ibkr", soort: "positie_geopend",
//     titel: "Nieuwe tranche herkend",
//     detail: "OESX 6050 PUT · 4 ct · 18,0 pt",
//     cyclus, positie, feiten: { contract, premie_pt },
//   });

// Geëxporteerd, zodat scripts/proef/inrichting.mjs deze lijst naast de
// keuzelijst in beheer kan leggen in plaats van hem uit de tekst te raden.
export const BRONNEN = ["ibkr", "meting", "klok", "mens"];

// Afkappen op 2000 tekens maakte van geldige json bijna altijd ongeldige json,
// en die werd later blind geparseerd — één te rijk feitenobject legde daarmee de
// hele tijdlijn van een cyclus plat. Liever geen feiten dan kapotte feiten.
function feitenTekst(feiten) {
  if (!feiten) return null;
  let tekst;
  try {
    tekst = JSON.stringify(feiten);
  } catch {
    return null;
  }
  if (!tekst || tekst.length <= 2000) return tekst || null;
  return JSON.stringify({ te_groot: true, tekens: tekst.length });
}

function tekst(w, max = 400) {
  if (w === null || w === undefined) return null;
  const s = String(w).trim();
  return s === "" ? null : s.slice(0, max);
}

export async function log(env, ik, g = {}) {
  try {
    const titel = tekst(g.titel, 200);
    const soort = tekst(g.soort, 60);
    if (!titel || !soort) return null;

    const gemaakt = await env.DB.prepare(
      `insert into gebeurtenis
         (cyclus, moment, bron, soort, titel, detail, feiten,
          positie, publicatie, beoordelingsmoment, processtap,
          sleutel, vraagt_antwoord, eigenaar, aangemaakt_door)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      g.cyclus || null,
      tekst(g.moment, 25) || new Date().toISOString().slice(0, 19).replace("T", " "),
      BRONNEN.includes(g.bron) ? g.bron : "mens",
      soort, titel, tekst(g.detail),
      feitenTekst(g.feiten),
      g.positie || null, g.publicatie || null,
      g.beoordelingsmoment || null, g.processtap || null,
      tekst(g.sleutel, 120), g.vraagt_antwoord ? 1 : 0,
      g.eigenaar || null,
      ik && ik.id ? ik.id : null
    ).run();
    return gemaakt.meta ? gemaakt.meta.last_row_id : null;
  } catch (fout) {
    // Bewust stil: de stroom is een verslag, geen voorwaarde.
    return null;
  }
}

// De stroom van één cyclus, nieuwste eerst. Zonder cyclus: alles.
export async function stroom(env, cyclusId = null, limiet = 200) {
  const rijen = cyclusId
    ? await env.DB.prepare(
        `select * from gebeurtenis where archief = 0 and cyclus = ?
          order by moment desc, id desc limit ?`
      ).bind(cyclusId, limiet).all()
    : await env.DB.prepare(
        `select * from gebeurtenis where archief = 0
          order by moment desc, id desc limit ?`
      ).bind(limiet).all();
  return rijen.results.map((r) => ({
    ...r,
    // Nooit blind parsen. Eén rij met kapotte json mag niet de hele tijdlijn
    // onbereikbaar maken; die ene rij toont dan gewoon geen feiten.
    feiten: leesFeiten(r.feiten),
  }));
}

function leesFeiten(ruw) {
  if (!ruw) return null;
  try {
    const f = JSON.parse(ruw);
    return f && typeof f === "object" ? f : null;
  } catch {
    return null;
  }
}
