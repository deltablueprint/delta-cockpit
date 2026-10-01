// Schrijven. Drie regels die hier worden afgedwongen:
//   1. Niets wordt verwijderd. Archiveren zet archief = 1 (uitgangspunt 2).
//   2. Elke wijziging komt in de audit trail, met naam en tijdstip.
//   3. Alleen velden die in de definitielaag staan en niet alleen-lezen zijn,
//      kunnen geschreven worden.

import { toets } from "./regels.js";
import { vulEventsBij, vulCyclitBij } from "./events.js";
import { startMoment } from "./gonogo.js";
import { instelling, wijktAf, stoplossVerruimd, noteerGeweigerdeStoploss } from "./positie.js";

async function veldenVan(env, tabelnaam) {
  return (await env.DB.prepare(
    "select * from db_field where tabel = ? and actief = 1"
  ).bind(tabelnaam).all()).results;
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

  if (tabelnaam === "positie") {
    // De stoploss wordt niet verruimd tijdens de looptijd. Aanscherpen mag;
    // verruimen wordt geweigerd en genoteerd (BOUWSPEC 6).
    const stop = teSchrijven.find((t) => t.veld.kolom === "stoploss_ask");
    if (stop && stoplossVerruimd(stop.oudeWaarde, stop.nieuweWaarde)) {
      await noteerGeweigerdeStoploss(env, ik, id, stop.oudeWaarde, stop.nieuweWaarde);
      return {
        fout: `De stoploss staat op ask ${stop.oudeWaarde} en mag tijdens de looptijd niet verruimd worden. Aanscherpen mag wel.`,
        veld: "stoploss_ask",
        status: 409,
      };
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

  // De cyclus volgt zijn tranches. Loopt er één in de markt, dan staat de
  // cyclus in positie; is elke tranche gesloten, dan is er niets meer te
  // bewaken en begint de post-analyse. Afsluiten blijft mensenwerk.
  if (tabelnaam === "positie" && teSchrijven.some((t) => t.veld.kolom === "status")) {
    const rij = await env.DB.prepare("select cyclus, status from positie where id = ?").bind(id).first();
    if (rij) {
      if (rij.status === "bewaken") {
        await env.DB.prepare(
          "update cyclus set status = 'in positie' where id = ? and status in ('go-nogo', 'uitvoering ophalen')"
        ).bind(rij.cyclus).run();
      }
      const open = await env.DB.prepare(
        "select count(*) as n from positie where cyclus = ? and archief = 0 and status <> 'gesloten'"
      ).bind(rij.cyclus).first();
      if (open && open.n === 0) {
        await env.DB.prepare(
          "update cyclus set status = 'post-analyse' where id = ? and status = 'in positie'"
        ).bind(rij.cyclus).run();
      }
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
    if (veld.alleen_lezen && !isOuder) continue;
    nieuw[kolom] = w === "" ? null : w;
  }

  // Verplichte velden die de gebruiker niet zelf invult (zoals de ouder) horen
  // er wel te zijn: ontbreken ze, dan is dat een duidelijke melding en geen
  // databasefout.
  for (const veld of velden.filter((v) => v.verplicht)) {
    if (nieuw[veld.kolom] === undefined || nieuw[veld.kolom] === null || nieuw[veld.kolom] === "") {
      if (veld.standaard) nieuw[veld.kolom] = veld.standaard;
      else return { fout: `${veld.label} is verplicht.`, veld: veld.kolom, status: 422 };
    }
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

  const rij = await env.DB.prepare(
    `insert into "${tabelnaam}" (${kolommen.map((k) => `"${k}"`).join(", ")})
     values (${kolommen.map(() => "?").join(", ")}) returning id`
  ).bind(...kolommen.map((k) => nieuw[k])).first();

  await auditregel(env, ik, tabelnaam, rij.id, "gebeurtenis", { gebeurtenis: "aangemaakt" }).run();
  if (tabelnaam === "cyclus") await vulEventsBij(env, rij.id);
  if (tabelnaam === "event") await vulCyclitBij(env, rij.id);
  return { id: rij.id, waarschuwingen: uitslag.waarschuwingen };
}

// Een leeg record om mee te beginnen: standaardwaarden uit de definitielaag,
// en de verwijzing naar de ouder al ingevuld.
export async function sjabloon(env, tabelnaam, ouder) {
  const tabel = await tabelVan(env, tabelnaam);
  if (!tabel) return { fout: `Onbekende tabel: ${tabelnaam}`, status: 404 };
  const velden = await veldenVan(env, tabelnaam);
  const secties = (await env.DB.prepare(
    "select * from db_sectie where tabel = ? order by volgorde"
  ).bind(tabelnaam).all()).results;

  const waarden = {};
  for (const v of velden) waarden[v.kolom] = v.standaard ?? null;

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

  let proces = null;
  if (tabel.proces_veld) {
    const stappen = (await env.DB.prepare(
      "select waarde, label from db_choice where tabel = ? and kolom = ? and actief = 1 order by volgorde"
    ).bind(tabelnaam, tabel.proces_veld).all()).results;
    if (stappen.length) proces = { veld: tabel.proces_veld, nu: waarden[tabel.proces_veld] ?? stappen[0].waarde, stappen };
  }

  return {
    tabel: { naam: tabel.naam, label: tabel.label, label_mv: tabel.label_mv, titel_veld: tabel.titel_veld, proces_veld: tabel.proces_veld },
    secties, velden, waarden, ouderkolom, ouder: ouderInfo, proces,
    nieuw: true, relaties: [], verwijzingen: {},
  };
}
