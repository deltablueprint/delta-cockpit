// Van kaart naar bericht.
//
// Een kaart met knop 'Bericht opstellen' wijst een sjabloon aan. Deze module
// zet dat sjabloon om in een concept: de feiten ingevuld, de tekst klaar, de
// oordelen nog open. Wat er daarna mee gebeurt is mensenwerk — nalezen,
// bijwerken, versturen. Er gaat hier niets vanzelf de deur uit.
//
// De sjablonen staan in de database (migratie 0105), niet hier. De woorden
// waarmee wij onze leden aanspreken horen in beheer te staan.

import { log } from "./stroom.js";

// De tekst van een bericht staat als sjabloon in beheer: "Positie gesloten:
// {{positie.naam}}". Wat er niet ingevuld kan worden valt weg in plaats van als
// {{...}} op het scherm te blijven staan — een bericht met een gat erin leest
// nog; een bericht met accolades leest als een storing.
const PLAATSHOUDER = /\{\{\s*([a-z0-9_]+)\.([a-z0-9_]+)\s*\}\}/gi;

// De vaste voet onder elk bericht aan de leden. Hij wordt ingebakken op het
// moment dat het concept gemaakt wordt, niet bij het versturen: wat eruit ging,
// ging eruit — ook als de tekst later verandert.
export async function voettekst(env) {
  try {
    const r = await env.DB.prepare(
      "select waarde from instelling where sleutel = 'bericht_voettekst' and archief = 0"
    ).first();
    return r && String(r.waarde).trim() ? String(r.waarde).trim() : null;
  } catch { return null; }
}

export function metVoet(tekst, voet) {
  if (!voet) return tekst;
  return `${tekst || ""}\n\n—\n${voet}`;
}

export function vulIn(sjabloon, gegevens) {
  if (!sjabloon) return null;
  const uit = String(sjabloon).replace(PLAATSHOUDER, (heel, groep, naam) => {
    const bron = gegevens[groep];
    if (!bron) return "";
    const w = bron[naam];
    return w === null || w === undefined ? "" : String(w);
  });
  // Alleen spaties opruimen, geen regels. Een sjabloon met alinea's werd hier
  // tot één doorlopende regel geplet — en dan gaat er een bericht de deur uit
  // waarin de titel, de cijfers en de reden aan elkaar vast zitten.
  return uit.replace(/[ \t]{2,}/g, " ")
            .replace(/[ \t]+$/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim() || null;
}


// Alles wat een plaatshouder kan aanwijzen, voor één kaart.
async function gegevensVoor(env, g) {
  const uit = { feiten: {} };
  try {
    uit.feiten = g.feiten ? JSON.parse(g.feiten) : {};
  } catch { /* dan blijft het leeg */ }

  // 'wat' is de zin die in de titel komt: wát er verandert. Komt het bericht uit
  // een kaart, dan staat die zin er niet bij maar valt hij af te leiden — en een
  // titel met een gat erin leest als een storing.
  if (uit.feiten && !uit.feiten.wat && uit.feiten.naar !== undefined && uit.feiten.naar !== null) {
    uit.feiten.wat = `de barometer naar ${uit.feiten.naar}`;
  }

  if (g.positie) {
    uit.positie = await env.DB.prepare("select * from positie where id = ?").bind(g.positie).first() || {};
    // Het contract heet op het scherm 'naam', maar in de tabel staat het onder
    // de kolom die het nu eenmaal heeft. Eén woord per begrip, ook hier.
    if (uit.positie && !uit.positie.naam) uit.positie.naam = uit.positie.contract || null;
  }
  if (g.cyclus) {
    const c = await env.DB.prepare("select id, label, status from cyclus where id = ?").bind(g.cyclus).first();
    uit.cyclus = c ? { ...c, naam: c.label } : {};
  }
  if (g.beoordelingsmoment) {
    uit.beoordelingsmoment = await env.DB.prepare(
      "select id, datum, status from beoordelingsmoment where id = ?"
    ).bind(g.beoordelingsmoment).first() || {};
  }
  return uit;
}

// Het concept dat bij een kaart hoort. Twee keer op dezelfde knop drukken mag
// geen twee concepten opleveren: dan staan er twee halve berichten en gaat er
// een de deur uit die iemand anders nog aan het schrijven was.
export async function conceptUitKaart(env, ik, kaartId, sjabloonnaam = null) {
  // Een kaart is een gebeurtenis die nog om een antwoord vraagt. Welke dat zijn
  // is een vraag over de stroom en geen vlag op een rij (BOUWSPEC §13b), dus er
  // wordt hier niet op een vlag gefilterd. Wat wel geldt: waar al over besloten
  // is — gemeld, of bewust niet gemeld — levert geen tweede bericht op.
  const g = await env.DB.prepare(
    "select * from gebeurtenis where id = ? and archief = 0"
  ).bind(kaartId).first();
  if (!g) return { fout: "Die kaart bestaat niet.", status: 404 };
  if (g.beantwoord_op) {
    return { fout: `Daar is al over besloten: ${g.antwoord || "afgehandeld"}.`, status: 409 };
  }

  const bestaat = await env.DB.prepare(
    "select * from publicatie where gebeurtenis = ? and archief = 0 limit 1"
  ).bind(kaartId).first();
  if (bestaat) return { ok: true, publicatie: bestaat.id, bestond_al: true };

  // Welk sjabloon erbij hoort zegt de aanroeper. Dat stond ooit in de
  // kaartdefinitie; die laag is weg, en de werkbank weet het beter: zij kent de
  // soort gebeurtenis waar de knop onder staat.
  const naam = sjabloonnaam;
  if (!naam) return { fout: "Er is geen sjabloon gekozen.", status: 400 };

  const sjabloon = await env.DB.prepare(
    "select * from berichtsjabloon where naam = ? and archief = 0"
  ).bind(naam).first();
  if (!sjabloon) return { fout: `Het sjabloon '${naam}' bestaat niet.`, status: 404 };

  const gegevens = await gegevensVoor(env, g);
  const positie = gegevens.positie || {};

  // De vaste nalezer uit het sjabloon. Is er een,
  // dan begint het bericht bij 'nalezen' en niet bij 'concept': dan is meteen
  // zichtbaar dat het nog ergens langs moet.
  // Een vaste nalezer die jijzelf blijkt te zijn, is geen nalezer. Dan ligt het
  // bericht bij jou, geef je het zelf vrij, en lijkt het alsof er iemand
  // meegekeken heeft.
  const gevraagd = sjabloon.vaste_nalezer || null;
  const nalezer = gevraagd && ik && gevraagd === ik.id ? null : gevraagd;

  const gemaakt = await env.DB.prepare(
    `insert into publicatie
       (positie, cyclus, gebeurtenis, soort, status, titel, kanaal,
        contract, strike, expiratiedatum, aantal, premie_pt, resultaat_pt,
        tekst, nalezer, aangemaakt_door)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    g.positie || null, g.cyclus || null, kaartId,
    sjabloon.soort, nalezer ? "nalezen" : "concept",
    vulIn(sjabloon.titel, gegevens) || sjabloon.label,
    sjabloon.kanaal,
    // De feiten worden hier vastgelegd zoals ze nu zijn. Verandert de positie
    // later, dan verandert een verstuurd bericht niet mee: wat eruit ging, ging
    // eruit.
    positie.contract || null, positie.strike || null, positie.expiratiedatum || null,
    // De kolom op positie heet ontvangen_premie_pt. 'premie_pt' bestaat daar
    // niet, dus hier stond altijd null — en in het bericht stond "Premie:
    // punten".
    positie.aantal || null, positie.ontvangen_premie_pt ?? null, positie.resultaat_pt ?? null,
    // Niet terugvallen op het ruwe sjabloon: daar staan de accolades nog in, en
    // dan gaat er een bericht met {{positie.naam}} erin de deur uit.
    metVoet(vulIn(sjabloon.tekst, gegevens) || "", await voettekst(env)),
    nalezer,
    ik && ik.id ? ik.id : null
  ).run();

  const id = gemaakt.meta ? gemaakt.meta.last_row_id : null;

  await log(env, ik, {
    bron: "mens", soort: "concept_opgesteld", cyclus: g.cyclus,
    titel: `Concept klaargezet: ${sjabloon.label}`,
    detail: nalezer ? `Gaat eerst langs ${nalezer}.` : null,
    positie: g.positie || null, publicatie: id,
    feiten: { sjabloon: sjabloon.naam, uit_kaart: kaartId },
  });

  // Ligt het meteen bij een lezer, dan hoort die dat in zijn eigen overzicht te
  // zien. Niet in een aparte postbus: er is één rij.
  if (nalezer && id) {
    await log(env, ik, {
      bron: "mens", soort: "nalezen_gevraagd", cyclus: g.cyclus || null,
      titel: `Nalezen gevraagd: ${sjabloon.label}`,
      detail: `Ligt bij ${nalezer}.`,
      positie: g.positie || null, publicatie: id,
      feiten: { lezer: nalezer, opsteller: ik && ik.id ? ik.id : null },
    });
  }

  return { ok: true, publicatie: id, status_bericht: nalezer ? "nalezen" : "concept", nalezer };
}

// ---------------------------------------------------------------- nalezen
//
// Nalezen is geen vinkje dat de opsteller zelf zet. De vraag gaat als kaart
// naar de lezer, en pas zijn antwoord zet het bericht door.
// Daarom is er geen aparte postbus: er is één rij, en dit staat erin.
export async function vraagNalezen(env, ik, publicatieId, lezer) {
  const p = await env.DB.prepare(
    "select * from publicatie where id = ? and archief = 0"
  ).bind(publicatieId).first();
  if (!p) return { fout: `Geen publicatie met nummer ${publicatieId}.`, status: 404 };
  if (p.status === "verstuurd") return { fout: "Dit bericht is al verstuurd.", status: 409 };
  if (!lezer) return { fout: "Zeg wie het moet nalezen.", status: 400 };
  if (ik && ik.id === lezer) return { fout: "Je eigen bericht nalezen is geen nalezen.", status: 400 };

  const bestaat = await env.DB.prepare("select id from gebruiker where id = ?").bind(lezer).first();
  if (!bestaat) return { fout: "Die lezer bestaat niet.", status: 404 };

  await env.DB.prepare(
    "update publicatie set status = 'nalezen', nalezer = ?, revisie = revisie + 1 where id = ?"
  ).bind(lezer, publicatieId).run();

  await log(env, ik, {
    bron: "mens", soort: "nalezen_gevraagd", cyclus: p.cyclus || null,
    titel: `Nalezen gevraagd: ${p.titel || p.contract || "bericht"}`,
    detail: `Ligt bij ${lezer}.`,
    positie: p.positie || null, publicatie: publicatieId,
    feiten: { lezer, opsteller: ik && ik.id ? ik.id : null },
  });

  return { ok: true, status_bericht: "nalezen", nalezer: lezer };
}

// De lezer geeft vrij. Dat is niet hetzelfde als versturen: iets kan
// goedgekeurd zijn en toch nog niet weg. Versturen blijft een eigen handeling
// met een eigen knop.
export async function geefVrij(env, ik, publicatieId) {
  const p = await env.DB.prepare(
    "select * from publicatie where id = ? and archief = 0"
  ).bind(publicatieId).first();
  if (!p) return { fout: `Geen publicatie met nummer ${publicatieId}.`, status: 404 };
  if (p.status === "verstuurd") return { fout: "Dit bericht is al verstuurd.", status: 409 };
  if (p.status !== "nalezen") return { fout: "Dit bericht ligt niet bij een nalezer.", status: 409 };
  if (p.nalezer && ik && ik.id !== p.nalezer) {
    return { fout: "Dit bericht ligt bij iemand anders.", status: 403 };
  }

  await env.DB.prepare(
    `update publicatie set status = 'klaar', nagelezen_op = datetime('now'), revisie = revisie + 1
      where id = ?`
  ).bind(publicatieId).run();

  await log(env, ik, {
    bron: "mens", soort: "bericht_vrijgegeven", cyclus: p.cyclus || null,
    titel: `Nagelezen en vrijgegeven: ${p.titel || "bericht"}`,
    positie: p.positie || null, publicatie: publicatieId,
  });

  return { ok: true, status_bericht: "klaar" };
}

// De lezer stuurt terug. Geen afkeuring maar een vraag: er moet iets aan.
export async function stuurTerug(env, ik, publicatieId, reden) {
  const p = await env.DB.prepare(
    "select * from publicatie where id = ? and archief = 0"
  ).bind(publicatieId).first();
  if (!p) return { fout: `Geen publicatie met nummer ${publicatieId}.`, status: 404 };
  if (p.status === "verstuurd") return { fout: "Dit bericht is al verstuurd.", status: 409 };
  if (!String(reden || "").trim()) return { fout: "Zeg wat eraan moet.", status: 400 };

  // Terugsturen is iets wat de lezer doet. Zonder deze regel kon de opsteller
  // zijn eigen bericht terugsturen — stand terug naar 'concept', nalezer leeg —
  // en het daarna zelf versturen. Het vierogenprincipe was dan één klik waard.
  if (p.status === "nalezen" && p.nalezer && ik && ik.id !== p.nalezer) {
    return { fout: "Dit bericht ligt bij iemand anders; alleen die kan het terugsturen.", status: 403 };
  }

  await env.DB.prepare(
    "update publicatie set status = 'concept', nalezer = null, revisie = revisie + 1 where id = ?"
  ).bind(publicatieId).run();

  await log(env, ik, {
    bron: "mens", soort: "bericht_teruggestuurd", cyclus: p.cyclus || null,
    titel: `Teruggestuurd naar de opsteller: ${p.titel || "bericht"}`,
    detail: String(reden).slice(0, 400),
    positie: p.positie || null, publicatie: publicatieId,
    feiten: { reden: String(reden).slice(0, 400) },
  });

  return { ok: true, status_bericht: "concept" };
}

// --------------------------------------------- van stand naar bericht
//
// Een stand die vastligt is nog geen stand die de leden kennen. Tot vandaag
// stopte de knop *Publiceren* bij het vastleggen: er kwam een rij in
// `barometerstand` en verder niets, terwijl het scherm wel zei dat de leden het
// wisten. Dit is de ontbrekende schakel — vastleggen maakt meteen één concept,
// en pas het versturen daarvan zet `gepubliceerd_op` (zie worker/spiegel.js).
//
// Eén bericht over allebei. Kiest iemand het venster én de stand, dan gaat er
// één bericht uit over dat ene moment: een lid dat twee berichten krijgt over
// hetzelfde moment leest het tweede niet meer.
export async function conceptVoorStand(env, ik, { cyclus, barometerstand, van, naar, venster_van, venster_naar, reden }) {
  const sjabloon = await env.DB.prepare(
    "select * from berichtsjabloon where naam = 'barometer' and archief = 0"
  ).first();
  if (!sjabloon) return { fout: "Er is geen sjabloon voor een standbericht.", status: 409 };

  const c = await env.DB.prepare("select id, label from cyclus where id = ?").bind(cyclus).first();

  // Wat er veranderde, in de woorden die op het scherm staan. Verandert er maar
  // één van de twee, dan gaat het bericht ook maar over die ene.
  const stukken = [];
  if (venster_naar && venster_naar !== venster_van) stukken.push(`het venster naar ${venster_naar}`);
  if (naar && naar !== van) stukken.push(`de barometer naar ${naar}`);

  const gegevens = {
    cyclus: c ? { ...c, naam: c.label } : {},
    feiten: {
      van: van || "—", naar: naar || "—",
      venster_van: venster_van || "—", venster_naar: venster_naar || "—",
      wat: stukken.join(" en ") || "de stand",
      reden: String(reden || "").trim(),
    },
  };

  const gevraagd = sjabloon.vaste_nalezer || null;
  const nalezer = gevraagd && ik && gevraagd === ik.id ? null : gevraagd;

  const gemaakt = await env.DB.prepare(
    `insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, nalezer, aangemaakt_door)
     values (?, 'barometer', ?, ?, ?, ?, ?, ?)`
  ).bind(
    cyclus, nalezer ? "nalezen" : "concept",
    vulIn(sjabloon.titel, gegevens) || sjabloon.label,
    sjabloon.kanaal,
    metVoet(vulIn(sjabloon.tekst, gegevens) || "", await voettekst(env)),
    nalezer, ik && ik.id ? ik.id : null
  ).run();

  const id = gemaakt.meta ? gemaakt.meta.last_row_id : null;

  // Welke vastlegging dit bericht beschrijft. Zonder die koppeling zou het
  // versturen de laatste stand melden in plaats van de stand waar het bericht
  // over gaat — en dat gaat mis zodra er twee kort na elkaar vastliggen.
  if (id && barometerstand) {
    await env.DB.prepare("update barometerstand set publicatie = ? where id = ?")
      .bind(id, barometerstand).run();
  }

  await log(env, ik, {
    bron: "mens", soort: "concept_opgesteld", cyclus, publicatie: id,
    titel: `Concept: ${vulIn(sjabloon.titel, gegevens) || sjabloon.label}`,
    detail: gegevens.feiten.reden.slice(0, 400),
    feiten: { sjabloon: sjabloon.naam, barometerstand },
  });

  return { publicatie: id, status: nalezer ? "nalezen" : "concept" };
}
