// Favorieten en geschiedenis: de twee tabbladen naast het menu.
//
// Het menu komt uit db_module en is van de beheerder. Deze twee zijn van de
// gebruiker: waar hij zelf steeds naartoe gaat, en waar hij net was. Allebei
// serverzijdig, zodat ze meekomen op een andere computer, en allebei strikt
// persoonlijk — de geschiedenis van een ander is niet te bekijken.

const KLEUREN = ["blauw", "turkoois", "groen", "geel", "oranje", "rood", "roze", "paars", "grijs"];
const BEWAAR = 30;   // zoveel bezoeken houden we vast

const schoon = (w, max = 120) => String(w ?? "").trim().slice(0, max);

export async function favorieten(env, ik) {
  const r = await env.DB.prepare(
    `select id, label, route, kleur, icoon, volgorde
       from favoriet where gebruiker = ? and archief = 0
      order by volgorde, id`
  ).bind(ik.id).all();
  return { favorieten: r.results };
}

export async function favorietToevoegen(env, ik, body = {}) {
  const route = schoon(body.route, 500);
  const label = schoon(body.label) || "Zonder naam";
  if (!route) return { fout: "Een favoriet hoort ergens heen te wijzen.", status: 422 };

  const laatste = await env.DB.prepare(
    "select coalesce(max(volgorde), 0) + 10 as n from favoriet where gebruiker = ? and archief = 0"
  ).bind(ik.id).first();

  const rij = await env.DB.prepare(
    `insert into favoriet (gebruiker, label, route, kleur, icoon, volgorde)
     values (?, ?, ?, ?, ?, ?) returning id`
  ).bind(
    ik.id, label, route,
    KLEUREN.includes(body.kleur) ? body.kleur : "blauw",
    schoon(body.icoon, 40) || "lijst",
    laatste ? laatste.n : 10
  ).first();
  return { id: rij.id };
}

export async function favorietWijzigen(env, ik, id, body = {}) {
  const bestaand = await env.DB.prepare(
    "select * from favoriet where id = ? and gebruiker = ? and archief = 0"
  ).bind(id, ik.id).first();
  if (!bestaand) return { fout: "Die favoriet bestaat niet.", status: 404 };

  await env.DB.prepare(
    "update favoriet set label = ?, route = ?, kleur = ?, icoon = ? where id = ?"
  ).bind(
    schoon(body.label) || bestaand.label,
    schoon(body.route, 500) || bestaand.route,
    KLEUREN.includes(body.kleur) ? body.kleur : bestaand.kleur,
    schoon(body.icoon, 40) || bestaand.icoon,
    id
  ).run();
  return { id };
}

// Een favoriet gaat echt weg. Dit is geen record maar een instelling: hij legt
// niets vast over een cyclus, een besluit of een positie, alleen waar jij graag
// heen gaat. Hem archiveren zou een lijst opbouwen die niemand ooit nog leest.
export async function favorietWeg(env, ik, id) {
  await env.DB.prepare(
    "delete from favoriet where id = ? and gebruiker = ?"
  ).bind(id, ik.id).run();
  return { ok: true };
}

export async function favorietenVolgorde(env, ik, ids = []) {
  if (!Array.isArray(ids) || !ids.length) return { ok: true };
  await env.DB.batch(ids.map((id, i) => env.DB.prepare(
    "update favoriet set volgorde = ? where id = ? and gebruiker = ?"
  ).bind((i + 1) * 10, Number(id), ik.id)));
  return { ok: true };
}

export async function bezoeken(env, ik) {
  const r = await env.DB.prepare(
    "select id, route, titel, soort, moment from bezoek where gebruiker = ? order by id desc limit ?"
  ).bind(ik.id, BEWAAR).all();
  return { bezoeken: r.results };
}

// Twee keer achter elkaar dezelfde plek levert één regel op: je bent er niet
// twee keer geweest, je bent er gebleven.
export async function bezoekBijzetten(env, ik, body = {}) {
  const route = schoon(body.route, 500);
  const titel = schoon(body.titel, 200);
  if (!route || !titel) return { ok: true };

  const laatste = await env.DB.prepare(
    "select id, route from bezoek where gebruiker = ? order by id desc limit 1"
  ).bind(ik.id).first();
  if (laatste && laatste.route === route) {
    await env.DB.prepare("update bezoek set moment = datetime('now'), titel = ? where id = ?")
      .bind(titel, laatste.id).run();
    return { ok: true };
  }

  await env.DB.batch([
    env.DB.prepare("insert into bezoek (gebruiker, route, titel, soort) values (?, ?, ?, ?)")
      .bind(ik.id, route, titel, schoon(body.soort, 60) || null),
    // Afkappen: dit is een hulpmiddel, geen archief.
    env.DB.prepare(
      `delete from bezoek where gebruiker = ? and id not in (
         select id from bezoek where gebruiker = ? order by id desc limit ?)`
    ).bind(ik.id, ik.id, BEWAAR),
  ]);
  return { ok: true };
}

export async function bezoekenLeeg(env, ik) {
  await env.DB.prepare("delete from bezoek where gebruiker = ?").bind(ik.id).run();
  return { ok: true };
}
