// Schrijven. Drie regels die hier worden afgedwongen:
//   1. Niets wordt verwijderd. Archiveren zet archief = 1 (uitgangspunt 2).
//   2. Elke wijziging komt in de audit trail, met naam en tijdstip.
//   3. Alleen velden die in de definitielaag staan en niet alleen-lezen zijn,
//      kunnen geschreven worden.

import { toets } from "./regels.js";
import { vulEventsBij, vulCyclitBij } from "./events.js";
import { startMoment, tilQuorum } from "./gonogo.js";
import { beweegFase } from "./proces.js";
import { instelling, wijktAf, stoplossVerruimd, noteerGeweigerdeStoploss,
         volgendeTranche, contractnaam, zetExitplanKlaar, exitplanCompleet,
         herberekenExitplan, besluitOpties, neemBesluitOver, premieInPunten } from "./positie.js";

async function veldenVan(env, tabelnaam) {
  return (await env.DB.prepare(
    "select * from db_field where tabel = ? and actief = 1 order by volgorde, id"
  ).bind(tabelnaam).all()).results;
}

// Wat de database zelf al van een kolom weet: of hij leeg mag zijn en of er
// een standaardwaarde op staat.
async function kolominfo(env, tabelnaam) {
  try {
    const r = await env.DB.prepare(
      "select name, \"notnull\", dflt_value from pragma_table_info(?)"
    ).bind(tabelnaam).all();
    return Object.fromEntries(r.results.map((k) => [k.name, k]));
  } catch {
    return {};
  }
}

// Standaardwaarden uit de definitielaag. Twee woorden hebben een betekenis in
// plaats van een waarde: 'vandaag' en 'nu'. Een datum die vandaag is, hoef je
// niet in te typen.
function standaardwaarde(w, ik) {
  if (w === "vandaag") return new Date().toISOString().slice(0, 10);
  if (w === "nu") return new Date().toISOString().slice(0, 16).replace("T", " ");
  if (w === "ik") return ik ? ik.id : null;
  return w;
}

async function tabelVan(env, tabelnaam) {
  return await env.DB.prepare(
    "select * from db_table where naam = ? and actief = 1"
  ).bind(tabelnaam).first();
}

function auditregel(env, ik, tabel, record, soort, extra = {}) {
  return env.DB.prepare(
    `insert into audit (wie, tabel, record, soort, veld, oude_waarde, nieuwe_waarde, gebeurtenis, reden)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    ik.id, tabel, record, soort,
    extra.veld ?? null, extra.oude ?? null, extra.nieuwe ?? null,
    extra.gebeurtenis ?? null, extra.reden ?? null
  );
}

// ---------------------------------------------------------------- wijzigen
export async function wijzig(env, ik, tabelnaam, id, body) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const velden = await veldenVan(env, tabelnaam);
  const huidig = await env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first();
  if (!huidig) return { fout: `Geen ${tabel.label.toLowerCase()} met nummer ${id}.`, status: 404 };

  // Versturen vergrendelt een inzending. Daarna is ze niet meer te wijzigen,
  // ook niet door degene die haar schreef: wie van mening verandert doet dat
  // in het gesprek (BOUWSPEC 5.4).
  if (tabelnaam === "inzending" && huidig.status === "verstuurd") {
    return { fout: "Deze inzending is verstuurd en staat vast.", status: 409 };
  }

  // Botsingsdetectie: wie opslaat op een verouderde revisie krijgt het record
  // terug in plaats van andermans werk te overschrijven.
  if (body.revisie !== undefined && huidig.revisie !== undefined &&
      Number(body.revisie) !== Number(huidig.revisie)) {
    return {
      fout: "Iemand anders heeft dit record intussen gewijzigd.",
      status: 409,
      huidig,
    };
  }

  const teSchrijven = [];
  for (const [kolom, nieuweWaarde] of Object.entries(body.velden || {})) {
    const veld = velden.find((v) => v.kolom === kolom);
    if (!veld) return { fout: `Onbekend veld: ${kolom}`, status: 400 };
    if (veld.alleen_lezen) return { fout: `Veld ${veld.label} is alleen-lezen.`, status: 400 };
    if (veld.verplicht && (nieuweWaarde === null || nieuweWaarde === "")) {
      return { fout: `${veld.label} is verplicht.`, status: 400 };
    }
    if (String(huidig[kolom] ?? "") !== String(nieuweWaarde ?? "")) {
      teSchrijven.push({ veld, nieuweWaarde, oudeWaarde: huidig[kolom] });
    }
  }
  if (!teSchrijven.length) return { ongewijzigd: true, id, revisie: huidig.revisie };

  // Validatie uit db_rule, tegen het record zoals het ná opslaan zou zijn.
  const straks = { ...huidig };
  for (const t of teSchrijven) straks[t.veld.kolom] = t.nieuweWaarde;

  // De stoploss wordt niet verruimd tijdens de looptijd. Aanscherpen mag;
  // verruimen wordt geweigerd en genoteerd (BOUWSPEC 6).
  if (tabelnaam === "exitregel" && huidig.soort === "stoploss") {
    const stop = teSchrijven.find((t) => t.veld.kolom === "niveau");
    if (stop && stoplossVerruimd(stop.oudeWaarde, stop.nieuweWaarde)) {
      await noteerGeweigerdeStoploss(env, ik, huidig.positie, stop.oudeWaarde, stop.nieuweWaarde);
      return {
        fout: `De stoploss staat op ${stop.oudeWaarde} en mag tijdens de looptijd niet verruimd worden. Aanscherpen mag wel.`,
        veld: "niveau",
        status: 409,
      };
    }
  }

  if (tabelnaam === "positie") {
    // Het exitplan ligt er vóór de order.
    if (teSchrijven.some((t) => t.veld.kolom === "status") &&
        huidig.status === "besluit goedgekeurd" && straks.status !== "besluit goedgekeurd") {
      const mist = await exitplanCompleet(env, id);
      if (mist) return { fout: mist, veld: "status", status: 422 };
    }

    // Een tranche geldt pas als uitgevoerd wanneer een afwijking geduid is.
    // Tot dat moment is het een waarschuwing: je bent nog aan het invullen.
    const gaatLopen = ["bewaken", "gesloten"].includes(String(straks.status));
    const wasAlLopend = ["bewaken", "gesloten"].includes(String(huidig.status));
    if (gaatLopen && !wasAlLopend && Number(huidig.afwijking ?? 0) === 1 &&
        !String(straks.afwijking_toelichting ?? "").trim()) {
      return {
        fout: "De uitvoering wijkt af van het besluit. Leg eerst vast waarom, daarna kan de tranche gaan lopen.",
        veld: "afwijking_toelichting",
        status: 422,
      };
    }

    // Kiest iemand een ander besluit, dan gaat ook wat dát besluit zei mee.
    if (teSchrijven.some((t) => t.veld.kolom === "beoordelingsmoment")) {
      const besluit = await neemBesluitOver(env, straks.beoordelingsmoment, straks.status);
      for (const [kolom, waarde] of Object.entries(besluit || {})) {
        if (String(straks[kolom] ?? "") === String(waarde ?? "")) continue;
        straks[kolom] = waarde;
        teSchrijven.push({
          veld: velden.find((v) => v.kolom === kolom),
          nieuweWaarde: waarde,
          oudeWaarde: huidig[kolom],
        });
      }
    }

    // De premie in punten volgt uit de contractwaarde.
    if (teSchrijven.some((t) => t.veld.kolom === "ontvangen_premie_eur")) {
      const pt = await premieInPunten(env, straks);
      if (pt !== null && pt !== Number(huidig.ontvangen_premie_pt)) {
        straks.ontvangen_premie_pt = pt;
        teSchrijven.push({
          veld: velden.find((v) => v.kolom === "ontvangen_premie_pt"),
          nieuweWaarde: pt,
          oudeWaarde: huidig.ontvangen_premie_pt,
        });
      }
    }

    // De contractnaam volgt uit de expiratie en de strike; hem met de hand
    // laten typen levert vroeg of laat een naam die niet klopt.
    const naam = contractnaam(straks);
    if (naam && naam !== huidig.contract) {
      straks.contract = naam;
      teSchrijven.push({
        veld: velden.find((v) => v.kolom === "contract"),
        nieuweWaarde: naam,
        oudeWaarde: huidig.contract,
      });
    }

    // De uitvoering tegen het besluit leggen. Het systeem stelt vast dát er
    // een afwijking is; waaróm blijft een mens vertellen.
    const inst = await instelling(env);
    const redenen = wijktAf(straks, inst ? inst.tolerantie_premie_pct : 10);
    const afwijkend = redenen.length ? 1 : 0;
    if (Number(straks.afwijking ?? 0) !== afwijkend) {
      straks.afwijking = afwijkend;
      teSchrijven.push({
        veld: velden.find((v) => v.kolom === "afwijking"),
        nieuweWaarde: afwijkend,
        oudeWaarde: huidig.afwijking,
      });
      if (afwijkend && !straks.afwijking_soort) {
        straks.afwijking_soort = redenen[0];
        teSchrijven.push({
          veld: velden.find((v) => v.kolom === "afwijking_soort"),
          nieuweWaarde: redenen[0],
          oudeWaarde: huidig.afwijking_soort,
        });
      }
    }
  }
  const uitslag = await toets(env, tabelnaam, straks, velden);
  if (uitslag.blokkades.length) {
    return { fout: uitslag.blokkades[0].melding, blokkades: uitslag.blokkades, status: 422 };
  }

  const heeftRevisie = huidig.revisie !== undefined;
  const zetten = teSchrijven.map((t) => `"${t.veld.kolom}" = ?`).join(", ")
    + (heeftRevisie ? ", revisie = revisie + 1" : "");
  const opdrachten = [
    env.DB.prepare(`update "${tabelnaam}" set ${zetten} where id = ?`)
      .bind(...teSchrijven.map((t) => t.nieuweWaarde), id),
    // Alleen gemarkeerde velden komen in de audit trail (db_field.audit).
    ...teSchrijven.filter((t) => t.veld.audit).map((t) =>
      auditregel(env, ik, tabelnaam, id, "veld", {
        veld: t.veld.kolom,
        oude: t.oudeWaarde === null ? null : String(t.oudeWaarde),
        nieuwe: t.nieuweWaarde === null ? null : String(t.nieuweWaarde),
        reden: body.reden || null,
      })
    ),
  ];
  await env.DB.batch(opdrachten);

  // Schoof de looptijd op, dan horen de events uit de nieuwe periode erbij.
  if (tabelnaam === "cyclus" &&
      teSchrijven.some((t) => ["geopend_op", "doelexpiratie", "afgesloten_op"].includes(t.veld.kolom))) {
    await vulEventsBij(env, id);
  }

  if (tabelnaam === "positie" &&
      teSchrijven.some((t) => ["ontvangen_premie_pt", "ontvangen_premie_eur", "strike"].includes(t.veld.kolom))) {
    await herberekenExitplan(env, id, straks);
  }

  // Verschuift de datum van een event, dan verschuift hij mee in de
  // behandelingen: anders staan ze in de lijst op een dag waarop ze niet meer
  // vallen.
  if (tabelnaam === "event" && teSchrijven.some((t) => t.veld.kolom === "datum")) {
    await env.DB.prepare("update cyclus_event set datum = ? where event = ?")
      .bind(straks.datum, id).run();
  }

  // De fase volgt uit wat er gebeurd is: elk record schuift op zodra de
  // verplichte stappen van zijn fase gedaan zijn, en een cyclus volgt zijn
  // besluiten en tranches.
  await beweegFase(env, tabelnaam, id, ik);
  if (["beoordelingsmoment", "positie"].includes(tabelnaam)) {
    const ouder = await env.DB.prepare(`select cyclus from "${tabelnaam}" where id = ?`).bind(id).first();
    if (ouder && ouder.cyclus) await beweegFase(env, "cyclus", ouder.cyclus, ik);
  }

  // Het tijdstip bij de twee handelingen die een mens bevestigt.
  if (tabelnaam === "positie") {
    if (teSchrijven.some((t) => t.veld.kolom === "order_geplaatst") && Number(straks.order_geplaatst) === 1) {
      await env.DB.prepare("update positie set order_op = datetime('now') where id = ? and order_op is null").bind(id).run();
    }
    if (teSchrijven.some((t) => t.veld.kolom === "gepubliceerd") && Number(straks.gepubliceerd) === 1) {
      await env.DB.prepare("update positie set gepubliceerd_op = datetime('now') where id = ? and gepubliceerd_op is null").bind(id).run();
    }
  }

  // Een cyclus op *go / no-go* zetten ís het openen van een beoordelingsmoment.
  // Daar nog een aparte knop voor vragen zou betekenen dat je twee keer
  // hetzelfde zegt — en tot die tweede klik zou de cyclus in een stap staan
  // waar niets onder hangt.
  if (tabelnaam === "cyclus" &&
      teSchrijven.some((t) => t.veld.kolom === "status" && t.nieuweWaarde === "go-nogo")) {
    await startMoment(env, ik, id);
  }

  return {
    id,
    revisie: heeftRevisie ? Number(huidig.revisie) + 1 : undefined,
    gewijzigd: teSchrijven.map((t) => t.veld.kolom),
    waarschuwingen: uitslag.waarschuwingen,
  };
}

// -------------------------------------------------------------- archiveren
export async function archiveer(env, ik, tabelnaam, ids, reden) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };
  if (!tabel.archiveerbaar) return { fout: `${tabel.label_mv} kunnen niet gearchiveerd worden.`, status: 400 };

  const velden = await veldenVan(env, tabelnaam);
  if (!velden.some((v) => v.kolom === "archief") &&
      !(await heeftKolom(env, tabelnaam, "archief"))) {
    return { fout: `${tabel.label_mv} hebben geen archiefkolom.`, status: 400 };
  }

  // Een verstuurde inzending staat vast — ook voor wie opruimt. Is het moment
  // zelf verkeerd, dan archiveer je het moment; dan gaat wat eraan hangt mee
  // uit beeld zonder dat iemands oordeel verdwijnt.
  if (tabelnaam === "inzending") {
    const plek = ids.map(() => "?").join(", ");
    const vast = await env.DB.prepare(
      `select count(*) as n from inzending where id in (${plek}) and status = 'verstuurd'`
    ).bind(...ids).first();
    if (vast && vast.n) {
      return {
        fout: "Een verstuurde inzending staat vast. Is het moment zelf verkeerd, archiveer dan het beoordelingsmoment.",
        status: 409,
      };
    }
  }

  const plekken = ids.map(() => "?").join(", ");
  await env.DB.batch([
    env.DB.prepare(`update "${tabelnaam}" set archief = 1 where id in (${plekken})`).bind(...ids),
    ...ids.map((id) =>
      auditregel(env, ik, tabelnaam, id, "gebeurtenis", {
        gebeurtenis: "gearchiveerd",
        reden: reden || null,
      })
    ),
  ]);
  return { gearchiveerd: ids };
}

// --------------------------------------------------------------- dupliceren
export async function dupliceer(env, ik, tabelnaam, id) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const velden = await veldenVan(env, tabelnaam);
  const bron = await env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first();
  if (!bron) return { fout: `Geen ${tabel.label.toLowerCase()} met nummer ${id}.`, status: 404 };

  // Een kopie neemt de inhoudelijke velden over, maar nooit de uitkomst van
  // het origineel: wat alleen-lezen is of door het systeem gezet wordt, blijft leeg.
  const overTeNemen = velden.filter(
    (v) => !v.alleen_lezen && v.kolom !== "id" && bron[v.kolom] !== undefined
  );
  const kolommen = overTeNemen.map((v) => v.kolom);
  const waarden = overTeNemen.map((v) =>
    v.kolom === tabel.titel_veld && typeof bron[v.kolom] === "string"
      ? `${bron[v.kolom]} (kopie)`
      : bron[v.kolom]
  );

  const nieuw = await env.DB.prepare(
    `insert into "${tabelnaam}" (${kolommen.map((k) => `"${k}"`).join(", ")})
     values (${kolommen.map(() => "?").join(", ")}) returning id`
  ).bind(...waarden).first();

  await auditregel(env, ik, tabelnaam, nieuw.id, "gebeurtenis", {
    gebeurtenis: `gedupliceerd van nummer ${id}`,
  }).run();

  return { id: nieuw.id };
}

async function heeftKolom(env, tabel, kolom) {
  const r = await env.DB.prepare(
    "select count(*) as n from pragma_table_info(?) where name = ?"
  ).bind(tabel, kolom).first();
  return r && r.n > 0;
}

// ---------------------------------------------------------------- aanmaken
// Een record wordt gemaakt vanaf zijn ouder (BOUWSPEC 10.0). Komt er een
// ouder mee, dan wordt die verwijzing meteen ingevuld en vastgezet.
export async function maakAan(env, ik, tabelnaam, body) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };

  const velden = await veldenVan(env, tabelnaam);
  const nieuw = {};

  for (const [kolom, w] of Object.entries(body.velden || {})) {
    const veld = velden.find((v) => v.kolom === kolom);
    if (!veld) return { fout: `Onbekend veld: ${kolom}`, status: 400 };
    // Een alleen-lezen veld blijft leeg, behalve de verwijzing naar de ouder:
    // die wordt bij het aanmaken juist vastgezet.
    const isOuder = veld.type === "verwijzing" && w !== null && w !== "" &&
                    (kolom === body.ouderkolom || veld.toon_op_formulier === 0);
    // Een alleen-lezen veld dat het systeem zelf invult (jij, vandaag, nu)
    // mag het formulier wel meesturen: het komt immers van het systeem.
    const isSysteem = veld.standaard && ["ik", "vandaag", "nu"].includes(veld.standaard);
    if (veld.alleen_lezen && !isOuder && !isSysteem) continue;
    nieuw[kolom] = w === "" ? null : w;
  }

  if (tabelnaam === "positie") {
    if (!nieuw.tranche) nieuw.tranche = await volgendeTranche(env, nieuw.cyclus);
    const besluit = await neemBesluitOver(env, nieuw.beoordelingsmoment, "besluit goedgekeurd");
    for (const [kolom, waarde] of Object.entries(besluit || {})) {
      // Wat iemand zelf invulde blijft staan; de rest komt uit het besluit.
      if (nieuw[kolom] === null || nieuw[kolom] === undefined || nieuw[kolom] === "") nieuw[kolom] = waarde;
    }
    const pt = await premieInPunten(env, nieuw);
    if (pt !== null) nieuw.ontvangen_premie_pt = pt;
    const naam = contractnaam(nieuw);
    if (naam) nieuw.contract = naam;
  }

  // Verplichte velden die de gebruiker niet zelf invult. Ontbreken ze, dan is
  // dat een duidelijke melding en geen databasefout — maar alleen als er echt
  // niets is om op terug te vallen. Een veld dat niet op het aanmaakformulier
  // staat en in de database een standaardwaarde heeft, laten we gewoon aan de
  // database over: anders vraagt het systeem om iets wat het zelf al weet.
  // De ouder van mijn ouder. Een inzending hoort bij een beoordelingsmoment én
  // bij een cyclus; maak je hem vanaf het moment, dan weet het systeem de
  // cyclus al — die staat op dat moment. Dat uitvragen zou betekenen dat je
  // iets moet opzoeken wat er al is, met de kans dat het de verkeerde wordt.
  for (const veld of velden.filter((v) => v.type === "verwijzing" && v.verplicht)) {
    if (nieuw[veld.kolom] !== undefined && nieuw[veld.kolom] !== null && nieuw[veld.kolom] !== "") continue;
    for (const ander of velden.filter((v) => v.type === "verwijzing" && v.kolom !== veld.kolom)) {
      const w = nieuw[ander.kolom];
      if (w === undefined || w === null || w === "" || !ander.verwijst_naar) continue;

      // Eerst kijken of die tabel de kolom überhaupt heeft. Vraag je in SQLite
      // naar een kolom die niet bestaat, dan geeft hij de naam terug als
      // tekst in plaats van een fout — en dan verwijst het veld naar de
      // letterlijke tekst 'deelnemer'.
      const kolommenDaar = await kolominfo(env, ander.verwijst_naar);
      if (!kolommenDaar[veld.kolom]) continue;

      try {
        const r = await env.DB.prepare(
          `select "${veld.kolom}" as w from "${ander.verwijst_naar}" where id = ?`
        ).bind(w).first();
        if (r && r.w !== null && r.w !== undefined) { nieuw[veld.kolom] = r.w; break; }
      } catch { /* niet te lezen: dan is dit niet de weg */ }
    }
  }

  const info = await kolominfo(env, tabelnaam);

  // Een veld dat je leeg laat terwijl de database er een waarde voor heeft,
  // laten we aan de database over. Anders schrijft het formulier een lege
  // waarde over een standaard heen — en dat is precies wat 'volgorde mag niet
  // leeg zijn' betekende op een veld dat je niet hoeft in te vullen.
  for (const [kolom, w] of Object.entries(nieuw)) {
    if (w !== null && w !== "") continue;
    const k = info[kolom];
    if (k && k.notnull && k.dflt_value !== null) delete nieuw[kolom];
  }

  for (const veld of velden.filter((v) => v.verplicht)) {
    const leeg = nieuw[veld.kolom] === undefined || nieuw[veld.kolom] === null || nieuw[veld.kolom] === "";
    if (!leeg) continue;
    if (veld.standaard) { nieuw[veld.kolom] = standaardwaarde(veld.standaard, ik); continue; }

    const kolom = info[veld.kolom];
    if (kolom && (kolom.dflt_value !== null || !kolom.notnull)) {
      delete nieuw[veld.kolom];   // de database vult hem zelf in
      continue;
    }
    return { fout: `${veld.label} is verplicht.`, veld: veld.kolom, status: 422 };
  }

  const uitslag = await toets(env, tabelnaam, nieuw, velden);
  if (uitslag.blokkades.length) {
    return { fout: uitslag.blokkades[0].melding, blokkades: uitslag.blokkades, status: 422 };
  }

  if (velden.some((v) => v.kolom === "aangemaakt_door") && !nieuw.aangemaakt_door) {
    nieuw.aangemaakt_door = ik.id;
  }

  // Onder welke versie van de instellingen dit record ontstaat, zet het
  // systeem zelf. Dat is een feit over het moment, geen keuze van wie klikt.
  if (velden.some((v) => v.kolom === "configuratieversie") && !nieuw.configuratieversie) {
    const versie = await env.DB.prepare("select max(nummer) as nu from configuratieversie").first();
    if (versie && versie.nu) nieuw.configuratieversie = versie.nu;
  }

  const kolommen = Object.keys(nieuw);
  if (!kolommen.length) return { fout: "Niets om op te slaan.", status: 400 };

  let rij;
  try {
    rij = await env.DB.prepare(
      `insert into "${tabelnaam}" (${kolommen.map((k) => `"${k}"`).join(", ")})
       values (${kolommen.map(() => "?").join(", ")}) returning id`
    ).bind(...kolommen.map((k) => nieuw[k])).first();
  } catch (fout) {
    // Een verwijzingsfout van de database zegt alleen dát er iets niet klopt.
    // Welke verwijzing het is, kunnen we zelf opzoeken — en dan staat er een
    // melding waar iemand iets mee kan.
    if (/FOREIGN KEY/i.test(fout.message)) {
      for (const veld of velden.filter((v) => v.type === "verwijzing" && v.verwijst_naar)) {
        const w = nieuw[veld.kolom];
        if (w === undefined || w === null || w === "") continue;
        try {
          const bestaat = await env.DB.prepare(
            `select 1 as n from "${veld.verwijst_naar}" where id = ?`
          ).bind(w).first();
          if (!bestaat) {
            return { fout: `${veld.label} verwijst naar iets dat niet bestaat (${w}).`, veld: veld.kolom, status: 422 };
          }
        } catch { /* die tabel bestaat niet; dan is dit niet de oorzaak */ }
      }
    }
    throw fout;
  }

  await auditregel(env, ik, tabelnaam, rij.id, "gebeurtenis", { gebeurtenis: "aangemaakt" }).run();
  if (tabelnaam === "positie") await zetExitplanKlaar(env, ik, rij.id, nieuw);

  // Een inzending invullen ís hem versturen: er is geen tussenstand waarin je
  // hem bewaart en later nog aanpast. Daarna telt het systeem of iedereen die
  // aanwezig is er inmiddels is, en gaan de inzendingen open zodra dat zo is.
  if (tabelnaam === "inzending") {
    await env.DB.prepare(
      "update inzending set status = 'verstuurd', verstuurd_op = datetime('now') where id = ?"
    ).bind(rij.id).run();
    await auditregel(env, ik, "inzending", rij.id, "gebeurtenis", { gebeurtenis: "verstuurd" }).run();
    if (nieuw.beoordelingsmoment) {
      await tilQuorum(env, ik, Number(nieuw.beoordelingsmoment));
      await beweegFase(env, "beoordelingsmoment", Number(nieuw.beoordelingsmoment), ik);
    }
  }
  if (tabelnaam === "cyclus") await vulEventsBij(env, rij.id);
  if (tabelnaam === "event") await vulCyclitBij(env, rij.id);
  return { id: rij.id, waarschuwingen: uitslag.waarschuwingen };
}

// Een leeg record om mee te beginnen: standaardwaarden uit de definitielaag,
// en de verwijzing naar de ouder al ingevuld.
export async function sjabloon(env, tabelnaam, ouder, ik) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };
  const velden = await veldenVan(env, tabelnaam);
  const secties = (await env.DB.prepare(
    "select * from db_sectie where tabel = ? order by volgorde"
  ).bind(tabelnaam).all()).results;

  const waarden = {};
  for (const v of velden) waarden[v.kolom] = standaardwaarde(v.standaard, ik) ?? null;

  let ouderkolom = null;
  let ouderInfo = null;
  if (ouder) {
    const veld = velden.find((v) => v.verwijst_naar === ouder.tabel);
    if (veld) {
      waarden[veld.kolom] = Number(ouder.id);
      ouderkolom = veld.kolom;
      const ot = await env.DB.prepare("select naam, label, label_mv, titel_veld from db_table where naam = ?")
        .bind(ouder.tabel).first();
      if (ot) {
        const r = await env.DB.prepare(`select "${ot.titel_veld}" as titel from "${ot.naam}" where id = ?`)
          .bind(ouder.id).first();
        ouderInfo = { tabel: ot.naam, label_mv: ot.label_mv, id: Number(ouder.id), titel: r ? r.titel : `${ot.label} ${ouder.id}` };
      }
    }
  }

  const opties = {};
  if (tabelnaam === "positie" && ouder && ouder.tabel === "cyclus") {
    waarden.tranche = await volgendeTranche(env, Number(ouder.id));

    // Het laatste goedgekeurde besluit staat voorgevuld; een ander kiezen kan.
    opties.beoordelingsmoment = await besluitOpties(env, Number(ouder.id));
    const laatste = opties.beoordelingsmoment[0];
    if (laatste) {
      waarden.beoordelingsmoment = laatste.id;
      Object.assign(waarden, laatste.overnemen);
      if (waarden.strike === null) waarden.strike = laatste.overnemen.besluit_strike;
      if (waarden.expiratiedatum === null) waarden.expiratiedatum = laatste.overnemen.besluit_expiratiedatum;
      if (waarden.inzet_pct === null) waarden.inzet_pct = laatste.overnemen.besluit_inzet_pct;
    }
  }

  let proces = null;
  if (tabel.proces_veld) {
    const stappen = (await env.DB.prepare(
      "select waarde, label from db_choice where tabel = ? and kolom = ? and actief = 1 order by volgorde"
    ).bind(tabelnaam, tabel.proces_veld).all()).results;
    if (stappen.length) {
      // Een nieuw record staat al in zijn eerste stand; die hoort dus ook in
      // het formulier te staan en niet als streepje.
      if (!waarden[tabel.proces_veld]) waarden[tabel.proces_veld] = stappen[0].waarde;
      proces = { veld: tabel.proces_veld, nu: waarden[tabel.proces_veld], stappen };
    }
  }

  return {
    tabel: { naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv,
             titel_veld: tabel.titel_veld, proces_veld: tabel.proces_veld,
             aanmaakknop: tabel.aanmaakknop, na_aanmaken: tabel.na_aanmaken },
    secties, velden, waarden, ouderkolom, ouder: ouderInfo, proces, opties,
    nieuw: true, relaties: [], verwijzingen: {},
  };
}

// Dezelfde wijziging op meerdere records tegelijk: wat je in de lijst in één
// kolom aanwijst en in één keer zet. Elk record loopt door dezelfde controles
// als wanneer je het los opslaat — regels, revisies en de audit trail gelden
// hier net zo goed.
export async function samen(env, ik, tabelnaam, ids, velden, revisies = {}) {
  if (!Array.isArray(ids) || !ids.length) return { fout: "Geen records opgegeven.", status: 400 };
  if (ids.length > 200) return { fout: "Maximaal 200 regels tegelijk.", status: 413 };

  const gelukt = [];
  const mislukt = [];
  for (const id of ids) {
    const uit = await wijzig(env, ik, tabelnaam, Number(id), {
      velden,
      revisie: revisies[id],
    });
    if (uit.fout) mislukt.push({ id: Number(id), fout: uit.fout });
    else gelukt.push({ id: Number(id), revisie: uit.revisie });
  }
  return { gelukt, mislukt };
}
