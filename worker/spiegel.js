// De broker is de bron; de cockpit spiegelt.
//
// Eén functie, één richting. Wat bij de broker openstaat, staat in de cockpit.
// Wat daar verdwijnt, gaat hier dicht — met de prijzen uit de uitvoeringen.
// Er wordt niets geïnterpreteerd en niemand hoeft iets te bevestigen.
//
// De enige vraag die de broker niet kan beantwoorden is bij wélke cyclus een
// nieuwe positie hoort. Loopt er één, dan is het die. Lopen er meerdere, dan
// blijft ze onverdeeld staan tot iemand kiest. Dat is één rolmenu, geen flow.
//
// Wat deze code níét doet: zeggen dat een sluiting 'een rol' was. Dat is een
// verhaal over twee posities en hoort in de ledencommunicatie, niet hier.

import { zetExitplanKlaar } from "./positie.js";
import { log } from "./stroom.js";
import { meldGepubliceerd } from "./barometer.js";

const LOPEND = ["uitvoering ophalen", "uitvoering vastgelegd", "publiceren naar leden", "bewaken"];

const getal = (w) => (Number.isFinite(Number(w)) ? Number(w) : null);
const rond = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 10) / 10 : null);

// De cyclus waar een nieuwe positie bij hoort. Loopt er precies één, dan is dat
// hem. Anders laten we het open: gokken is hier erger dan niet weten.
async function cyclusVoor(env) {
  const lopend = (await env.DB.prepare(
    `select id from cyclus
      where archief = 0 and status in ('pre-analyse','go-nogo','uitvoering ophalen','in positie')
      order by geopend_op desc`
  ).all()).results;
  return lopend.length === 1 ? lopend[0].id : null;
}

// Het laatste go-besluit van die cyclus vóór de positie openging. Afgeleid,
// nooit gevraagd — en als het in een raar geval naast zit, breekt er niets.
async function besluitVoor(env, cyclusId, moment) {
  if (!cyclusId) return null;
  const r = await env.DB.prepare(
    `select id from beoordelingsmoment
      where cyclus = ? and archief = 0 and uitkomst = 'go'
        and (? is null or datum <= ?)
      order by datum desc, id desc limit 1`
  ).bind(cyclusId, moment || null, moment || null).first();
  return r ? r.id : null;
}

// Hoe een positie afliep, uit de feiten. Teruggekocht als er een terugkoop
// staat; anders waardeloos geëxpireerd als de expiratie voorbij is. Meer valt
// er niet uit af te leiden, en meer hoeft ook niet.
function uitkomstVan(positie, terugkoop, vandaag) {
  if (terugkoop) return "vervroegd teruggekocht";
  if (positie.expiratiedatum && String(positie.expiratiedatum) <= vandaag) return "waardeloos geexpireerd";
  return null;
}

export async function spiegel(env, ik, posities = [], uitvoeringen = [], vandaag = null) {
  const dag = vandaag || new Date().toISOString().slice(0, 10);
  const nu = `${dag} ${new Date().toISOString().slice(11, 19)}`;

  const bekend = (await env.DB.prepare(
    `select * from positie where archief = 0 and status in (${LOPEND.map(() => "?").join(",")})`
  ).bind(...LOPEND).all()).results;

  const openBijBroker = new Set(posities.map((p) => String(p.conid)));
  let geopend = 0, gesloten = 0, bijgewerkt = 0;

  // ---------------------------------------------------------- wat opent
  for (const p of posities) {
    if (!p.conid) continue;
    const al = bekend.find((t) => String(t.conid) === String(p.conid));
    if (al) {
      // Alleen het aantal kan nog wijzigen; de rest ligt vast zodra ze er is.
      if (Number(al.aantal) !== Math.abs(Number(p.aantal) || 0)) {
        await env.DB.prepare("update positie set aantal = ?, revisie = revisie + 1 where id = ?")
          .bind(Math.abs(Number(p.aantal) || 0), al.id).run();
        bijgewerkt++;
      }
      continue;
    }

    // De prijs waartegen geschreven werd. Zonder die prijs ontstaat de positie
    // wel, maar is ze niet te publiceren: er zou een geschatte premie naar de
    // leden gaan.
    const opening = uitvoeringen
      .filter((r) => r.richting === "verkoop" && String(r.conid) === String(p.conid))
      .pop();
    const premie = rond(opening ? opening.prijs_pt : p.gem_kostprijs);
    const cyclus = await cyclusVoor(env);
    const moment = opening ? (opening.datum || null) : dag;
    const besluit = await besluitVoor(env, cyclus, moment);

    const hoogste = cyclus
      ? await env.DB.prepare("select max(tranche) as n from positie where cyclus = ? and archief = 0")
          .bind(cyclus).first()
      : null;

    const gemaakt = await env.DB.prepare(
      `insert into positie
         (cyclus, beoordelingsmoment, tranche, status, contract, strike, expiratiedatum, aantal,
          ontvangen_premie_pt, conid, herkomst, uitvoering_op, zonder_besluit, aangemaakt_door)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'broker', ?, ?, ?)`
    ).bind(
      cyclus, besluit, (Number(hoogste && hoogste.n) || 0) + 1,
      premie === null ? "uitvoering ophalen" : "publiceren naar leden",
      p.contract || null, getal(p.strike), p.expiratiedatum || null,
      Math.abs(Number(p.aantal) || 0) || null, premie, String(p.conid),
      moment, cyclus && !besluit ? 1 : 0, ik && ik.id ? ik.id : null
    ).run();

    const id = gemaakt.meta ? gemaakt.meta.last_row_id : null;
    if (id) {
      const verse = await env.DB.prepare("select * from positie where id = ?").bind(id).first();
      await zetExitplanKlaar(env, ik || { id: null }, id, verse).catch(() => null);
      // Het bericht aan de leden gaat niet vanzelf de deur uit: er komt een
      // concept klaar te staan, en de positie wacht tot jij het geschreven en
      // verstuurd hebt.
      if (cyclus) {
        const { rekOpDoelexpiratie } = await import("./positie.js");
        await rekOpDoelexpiratie(env, cyclus, p.expiratiedatum).catch(() => null);
      }
      // Eerst de gebeurtenis, dan het concept. Die volgorde is niet willekeurig:
      // het concept moet weten uit welke gebeurtenis het komt, en die bestaat
      // pas als hij geschreven is.
      const aanleiding = await log(env, ik, {
        bron: "ibkr", soort: "positie_geopend", moment,
        titel: "Nieuwe tranche herkend",
        detail: [p.contract, `${Math.abs(Number(p.aantal) || 0)} ct`,
                 premie === null ? "prijs nog onbekend" : `${premie} pt`].filter(Boolean).join(" \u00b7 "),
        cyclus, positie: id,
        feiten: { contract: p.contract, strike: getal(p.strike), expiratiedatum: p.expiratiedatum,
                  aantal: Math.abs(Number(p.aantal) || 0), premie_pt: premie, conid: String(p.conid) },
      });
      // Het bericht aan de leden gaat niet vanzelf de deur uit: er komt een
      // concept klaar te staan, en de positie wacht tot jij het geschreven en
      // verstuurd hebt.
      await zetConceptKlaar(env, ik, verse, "opening", aanleiding).catch(() => null);
    }
    geopend++;
  }

  // --------------------------------------------------------- wat sluit
  for (const t of bekend) {
    if (!t.conid || openBijBroker.has(String(t.conid))) continue;
    const terugkoop = uitvoeringen
      .filter((r) => r.richting === "koop" && String(r.conid) === String(t.conid))
      .pop();
    const uitkomst = uitkomstVan(t, terugkoop, dag);
    const teruggekocht = terugkoop ? rond(terugkoop.prijs_pt)
      : (uitkomst === "waardeloos geexpireerd" ? 0 : null);
    const resultaat = Number.isFinite(Number(t.ontvangen_premie_pt)) && teruggekocht !== null
      ? rond(Number(t.ontvangen_premie_pt) - teruggekocht) : null;

    await env.DB.prepare(
      `update positie
          set status = 'gesloten', uitkomst = ?, sluittijdstip = ?, teruggekocht_pt = ?,
              resultaat_pt = ?, revisie = revisie + 1
        where id = ?`
    ).bind(
      uitkomst, terugkoop ? (terugkoop.datum || dag) : dag,
      teruggekocht, resultaat, t.id
    ).run();
    const aanleiding = await log(env, ik, {
      bron: "ibkr", soort: "positie_gesloten",
      moment: terugkoop ? (terugkoop.datum || dag) : dag,
      titel: "Tranche verdwenen bij de broker",
      detail: [t.contract, teruggekocht === null ? null : `teruggekocht ${teruggekocht} pt`,
               resultaat === null ? null : `${resultaat >= 0 ? "+" : "\u2212"} ${Math.abs(resultaat)} pt`,
               uitkomst].filter(Boolean).join(" \u00b7 "),
      cyclus: t.cyclus || null, positie: t.id,
      feiten: { contract: t.contract, teruggekocht_pt: teruggekocht, resultaat_pt: resultaat, uitkomst },
    });
    // Wie het openen las, hoort ook te horen hoe het afliep.
    await zetConceptKlaar(env, ik, {
      ...t, resultaat_pt: resultaat, ontvangen_premie_pt: t.ontvangen_premie_pt,
    }, "sluiting", aanleiding).catch(() => null);
    gesloten++;
  }

  return { geopend, gesloten, bijgewerkt, moment: nu };
}

// De posities die bij geen enkele cyclus horen. Eén vraag, één rolmenu.
export async function onverdeeld(env) {
  return (await env.DB.prepare(
    `select id, contract, strike, expiratiedatum, aantal, ontvangen_premie_pt, status, uitvoering_op
       from positie
      where archief = 0 and cyclus is null and buiten_cycli = 0 and status <> 'gesloten'
      order by uitvoering_op desc, id desc`
  ).all()).results;
}

// Een positie bij een cyclus zetten — of buiten de cycli, als ze er niet bij
// hoort. Dit is het enige wat een mens hier doet.
export async function wijsToe(env, ik, positieId, cyclusId, buiten = false) {
  const p = await env.DB.prepare("select * from positie where id = ? and archief = 0")
    .bind(positieId).first();
  if (!p) return { fout: `Geen positie met nummer ${positieId}.`, status: 404 };

  if (buiten) {
    await env.DB.prepare(
      "update positie set buiten_cycli = 1, cyclus = null, revisie = revisie + 1 where id = ?"
    ).bind(positieId).run();
    return { positie: positieId, buiten_cycli: true };
  }

  const c = await env.DB.prepare("select id from cyclus where id = ? and archief = 0")
    .bind(Number(cyclusId)).first();
  if (!c) return { fout: "Kies de cyclus waar deze positie bij hoort.", status: 422, veld: "cyclus" };

  const hoogste = await env.DB.prepare(
    "select max(tranche) as n from positie where cyclus = ? and archief = 0"
  ).bind(c.id).first();
  const besluit = await besluitVoor(env, c.id, p.uitvoering_op);

  await env.DB.prepare(
    `update positie set cyclus = ?, tranche = ?, beoordelingsmoment = ?, buiten_cycli = 0,
                        zonder_besluit = ?, revisie = revisie + 1
      where id = ?`
  ).bind(c.id, (Number(hoogste && hoogste.n) || 0) + 1, besluit, besluit ? 0 : 1, positieId).run();

  const { rekOpDoelexpiratie } = await import("./positie.js");
  await rekOpDoelexpiratie(env, c.id, p.expiratiedatum).catch(() => null);
  await log(env, ik, {
    bron: "mens", soort: "positie_toegewezen",
    titel: "Positie toegewezen aan een cyclus",
    detail: [p.contract, `cyclus ${c.id}`].filter(Boolean).join(" \u00b7 "),
    cyclus: c.id, positie: positieId,
    feiten: { contract: p.contract, zonder_besluit: besluit ? 0 : 1 },
  });
  return { positie: positieId, cyclus: c.id };
}

// ------------------------------------------------------- het bericht
//
// Een positie die opent of sluit levert een concept op met de feiten er al in.
// De begeleidende tekst is leeg en verplicht: de cijfers vertellen wát er
// gebeurd is, niet waaróm, en dat laatste is het enige deel dat je leden
// werkelijk lezen. Zolang het concept openstaat, blijft de positie op
// 'publiceren naar leden' wachten.
// Het concept draagt de gebeurtenis waar het uit voortkwam. Zonder dat ziet de
// achterstand het bericht niet — die joint op publicatie.gebeurtenis — en bleef
// de meter voor altijd zeggen dat de leden achterlopen op iets dat allang
// verstuurd was. En de kaart die om dit bericht vroeg ging bij het versturen
// niet dicht, waardoor 'Bericht opstellen' een tweede publicatie maakte.
async function zetConceptKlaar(env, ik, positie, soort, gebeurtenis = null) {
  const al = await env.DB.prepare(
    "select id from publicatie where positie = ? and soort = ? and archief = 0"
  ).bind(positie.id, soort).first();
  if (al) return al.id;

  const gemaakt = await env.DB.prepare(
    `insert into publicatie
       (positie, cyclus, gebeurtenis, soort, status, contract, strike, expiratiedatum, aantal,
        premie_pt, resultaat_pt, aangemaakt_door)
     values (?, ?, ?, ?, 'concept', ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    positie.id, positie.cyclus || null, gebeurtenis, soort,
    positie.contract || null, positie.strike, positie.expiratiedatum,
    positie.aantal, positie.ontvangen_premie_pt,
    soort === "sluiting" ? positie.resultaat_pt : null,
    ik && ik.id ? ik.id : null
  ).run();
  const id = gemaakt.meta ? gemaakt.meta.last_row_id : null;
  await log(env, ik, {
    bron: "ibkr", soort: "concept_klaargezet",
    titel: soort === "opening" ? "Concept klaargezet: nieuwe positie" : "Concept klaargezet: positie gesloten",
    detail: [positie.contract, positie.aantal ? `${positie.aantal} ct` : null].filter(Boolean).join(" \u00b7 "),
    cyclus: positie.cyclus || null, positie: positie.id, publicatie: id,
    feiten: { soort, contract: positie.contract, premie_pt: positie.ontvangen_premie_pt },
  });
  return id;
}

// Versturen is onomkeerbaar, dus het is een eigen handeling en geen gevolg van
// een gevuld veld. Pas hier gaat de positie door naar 'bewaken'.
export async function verstuurPublicatie(env, ik, publicatieId) {
  const p = await env.DB.prepare(
    "select * from publicatie where id = ? and archief = 0"
  ).bind(publicatieId).first();
  if (!p) return { fout: `Geen publicatie met nummer ${publicatieId}.`, status: 404 };
  if (p.status === "verstuurd") return { fout: "Dit bericht is al verstuurd.", status: 409 };
  // Ligt het bij een nalezer, dan is het niet aan de opsteller om het alvast de
  // deur uit te doen. Nagelezen worden en verstuurd worden zijn twee stappen,
  // en de eerste is nog niet af.
  if (p.status === "nalezen") {
    return { fout: `Dit bericht ligt nog bij ${p.nalezer || "een nalezer"}.`, status: 409 };
  }
  if (!String(p.tekst || "").trim()) {
    return {
      fout: "Schrijf eerst wat jullie gedaan hebben en waarom. Zonder dat zijn het alleen cijfers.",
      status: 422, veld: "tekst",
    };
  }

  // De voorwaarde hoort in de UPDATE, niet alleen in de lezing hierboven. Twee
  // tabbladen die tegelijk op versturen drukken zagen allebei 'concept', en dan
  // ging het bericht twee keer de deur uit — twee regels in de stroom, en bij een
  // barometerbericht een stand die bij de verkeerde publicatie belandde.
  const weg = await env.DB.prepare(
    `update publicatie set status = 'verstuurd', verstuurd_op = datetime('now'),
                           verstuurd_door = ?, revisie = revisie + 1
      where id = ? and status <> 'verstuurd'`
  ).bind(ik && ik.id ? ik.id : null, publicatieId).run();

  if (weg.meta && weg.meta.changes === 0) {
    return { fout: "Dit bericht is al verstuurd.", status: 409 };
  }

  // Een opening die verstuurd is, brengt de positie naar 'bewaken'. Bij een
  // sluiting staat ze al dicht en valt er niets meer te verschuiven.
  if (p.soort === "opening") {
    await env.DB.prepare(
      `update positie set gepubliceerd = 1, gepubliceerd_op = datetime('now'),
                          status = case when status = 'publiceren naar leden' then 'bewaken' else status end,
                          revisie = revisie + 1
        where id = ?`
    ).bind(p.positie).run();
  }
  // Een barometerbericht is het moment waarop de leden de nieuwe stand weten.
  // Daarom staat er geen knop 'markeer als gemeld': er is er maar één manier.
  if (p.soort === "barometer" && p.cyclus) {
    await meldGepubliceerd(env, p.cyclus, publicatieId);
  }

  // Het bericht is weg, dus de vraag is beantwoord. Zonder dit blijft de kaart
  // staan die om precies dit bericht vroeg, en blijft de achterstand hangen op
  // iets dat de leden allang weten.
  if (p.gebeurtenis) {
    await env.DB.prepare(
      `update gebeurtenis
          set beantwoord_op = datetime('now'), antwoord = 'publicatie', beantwoord_door = ?,
              wachten_tot = null
        where id = ? and vraagt_antwoord = 1 and beantwoord_op is null`
    ).bind(ik && ik.id ? ik.id : null, p.gebeurtenis).run();
  }

  await log(env, ik, {
    bron: "mens", soort: "bericht_verstuurd",
    titel: p.soort === "opening" ? "Bericht verstuurd: nieuwe positie" : "Bericht verstuurd: positie gesloten",
    detail: [p.contract, "412 leden"].filter(Boolean).join(" \u00b7 "),
    cyclus: p.cyclus || null, positie: p.positie, publicatie: publicatieId,
    feiten: { soort: p.soort, contract: p.contract },
  });
  return { publicatie: publicatieId, positie: p.positie, status: "verstuurd" };
}

// Wat er klaarstaat om geschreven te worden.
export async function conceptberichten(env) {
  return (await env.DB.prepare(
    `select p.*, c.label as cyclusnaam
       from publicatie p left join cyclus c on c.id = p.cyclus
      where p.status = 'concept' and p.archief = 0
      order by p.aangemaakt_op desc, p.id desc`
  ).all()).results;
}
