// Wat er in deze cyclus nog te doen staat.
//
// Naast de wachtrij bestaat er een tweede soort werk: de stappen van het proces.
// 'Instapvoorwaarden invullen', 'Analysemoment prikken', 'Technische analyse
// gedaan'. Die stonden tot nu toe alleen op het recordscherm, in de stappenbalk
// — dus je zag ze pas als je het record al open had, en de werkbank zei
// ondertussen dat er niets op je wachtte.
//
// Waarom dit géén kaarten worden, en dat is met opzet:
//
//   Een kaart is een vraag die om een antwoord vraagt. 'Zullen we dit de leden
//   vertellen?' blijft staan tot een mens kiest, en het antwoord wordt bewaard.
//
//   Een processtap is geen vraag maar een toestand. Hij lost zichzelf op zodra
//   het werk gedaan is — de afvinkregel ziet dat vanzelf — en er valt niets te
//   beantwoorden. Hem als kaart laten openstaan zou betekenen dat je hem ook kunt
//   wegklikken, en een stap wegklikken is iets anders dan hem doen.
//
// Dus: afgeleid bij het lezen, net als de achterstand. Niets opgeslagen, niets
// te beantwoorden, en hij verdwijnt vanzelf.

import { stappenVoor } from "./proces.js";

const MAX = 40;

export async function tedoen(env, cyclusId) {
  if (!cyclusId) return { stappen: [] };

  const cyclus = await env.DB.prepare(
    "select * from cyclus where id = ? and archief = 0"
  ).bind(cyclusId).first();
  if (!cyclus) return { stappen: [] };

  const uit = [];

  // De stappen van de cyclus zelf.
  await verzamel(env, "cyclus", cyclus, {
    waar: cyclus.label, route: `#/t/cyclus/${cyclus.id}`,
  }, uit);

  // De besluiten die nog lopen. Een afgerond besluit heeft geen openstaande
  // stappen meer, maar we vragen het niet: dat beslist de afvinkregel.
  const momenten = (await env.DB.prepare(
    `select * from beoordelingsmoment
      where cyclus = ? and archief = 0 and status <> 'uitkomst vastgelegd'
      order by datum limit 5`
  ).bind(cyclusId).all()).results;
  for (const m of momenten) {
    await verzamel(env, "beoordelingsmoment", m, {
      waar: `Besluit ${m.datum || ""}`.trim(), route: `#/uitkomst/${m.id}`,
    }, uit);
  }

  // En de tranches die nog lopen.
  const posities = (await env.DB.prepare(
    `select * from positie
      where cyclus = ? and archief = 0 and status <> 'gesloten'
      order by id limit 10`
  ).bind(cyclusId).all()).results;
  for (const p of posities) {
    await verzamel(env, "positie", p, {
      waar: p.contract || `Tranche ${p.tranche || p.id}`, route: `#/t/positie/${p.id}`,
    }, uit);
  }

  return { stappen: uit.slice(0, MAX) };
}

async function verzamel(env, tabel, rij, waarover, uit) {
  if (uit.length >= MAX) return;
  let stappen = [];
  try {
    stappen = await stappenVoor(env, tabel, rij);
  } catch {
    return;   // één record dat struikelt mag de lijst niet kosten
  }
  for (const s of stappen) {
    if (s.gedaan) continue;          // wat af is, hoeft er niet te staan
    if (uit.length >= MAX) return;
    uit.push({
      naam: s.naam,
      uitleg: s.uitleg || null,
      stand: s.stand || null,        // '2 van 5' — hoe ver je bent
      verplicht: s.verplicht,
      eigenaar: s.eigenaar || null,
      fase: s.fase || null,
      waar: waarover.waar,
      route: waarover.route,
      soort: tabel,
    });
  }
}
