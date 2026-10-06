// Naar wie een bericht gaat.
//
// Een lid geeft in de app aan dat hij een positie volgt. Vanaf dat moment krijgt
// hij de berichten over díé positie — en alleen die. Dat is wat 'eenduidig
// communiceren' hier betekent: niet iedereen alles, maar wie meekijkt hoort wat
// er met zijn positie gebeurt.
//
// De lijst wordt twee keer gezet. Bij het opstellen als voorbeeld — zo zie je op
// het concept naar wie het zou gaan voordat je iets verstuurt — en bij het
// versturen opnieuw, en dan bevroren met een tijdstip erbij. Wat eruit ging,
// ging eruit: meldt iemand zich daarna aan, dan staat hij niet alsnog op een
// bericht dat hij nooit gekregen heeft.
import { log } from "./stroom.js";

// Welke leden bij een bericht horen, en waarom.
export async function wieKrijgtDit(env, publicatieId) {
  const p = await env.DB.prepare(
    "select id, positie, cyclus, soort from publicatie where id = ? and archief = 0"
  ).bind(publicatieId).first();
  if (!p) return [];

  // Een bericht over één tranche gaat naar wie die tranche volgt. Een
  // barometerbericht draagt sinds 0153 ook een tranche: het is de zwakste
  // positie die de stand draagt, en het zijn haar volgers die het aangaat.
  if (p.positie) {
    const r = await env.DB.prepare(
      `select v.lid, l.naam from positievolger v
         join lid l on l.id = v.lid
        where v.positie = ? and v.archief = 0 and v.gestopt_op is null
          and l.archief = 0 and l.status = 'actief'
        order by l.naam`
    ).bind(p.positie).all();
    return r.results.map((x) => ({ lid: x.lid, reden: "volgt deze positie" }));
  }

  // Een bericht zonder tranche gaat over de cyclus als geheel: dan zijn het de
  // leden die er ergens in meekijken.
  if (p.cyclus) {
    const r = await env.DB.prepare(
      `select distinct v.lid from positievolger v
         join positie pos on pos.id = v.positie
         join lid l on l.id = v.lid
        where pos.cyclus = ? and v.archief = 0 and v.gestopt_op is null
          and l.archief = 0 and l.status = 'actief'`
    ).bind(p.cyclus).all();
    return r.results.map((x) => ({ lid: x.lid, reden: "volgt een tranche in deze cyclus" }));
  }

  return [];
}

// De lijst op het bericht zetten. Zolang er niets verstuurd is mag hij
// meebewegen met wie er volgt; na het versturen staat hij vast.
export async function zetOntvangers(env, publicatieId, { bezorgd = false } = {}) {
  const al = await env.DB.prepare(
    "select count(*) as n from publicatie_ontvanger where publicatie = ? and bezorgd_op is not null"
  ).bind(publicatieId).first();
  if (al && Number(al.n) > 0) return { bevroren: true, aantal: Number(al.n) };

  const wie = await wieKrijgtDit(env, publicatieId);

  await env.DB.prepare("delete from publicatie_ontvanger where publicatie = ?").bind(publicatieId).run();
  for (const w of wie) {
    await env.DB.prepare(
      `insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
       values (?, ?, ?, ?)`
    ).bind(publicatieId, w.lid, w.reden, bezorgd ? new Date().toISOString().slice(0, 19).replace("T", " ") : null).run();
  }
  return { bevroren: bezorgd, aantal: wie.length };
}

// Hoeveel leden een bericht kreeg, voor de regel in de stroom. Geen vast getal
// meer: wie het kreeg staat op het bericht en is na te rekenen.
export async function aantalOntvangers(env, publicatieId) {
  const r = await env.DB.prepare(
    "select count(*) as n from publicatie_ontvanger where publicatie = ? and archief = 0"
  ).bind(publicatieId).first();
  return r ? Number(r.n) : 0;
}
