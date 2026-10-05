// De achterstand: hoe ver de leden achterlopen op wat wij weten.
//
// Dit is de ene blijvende meter van de werkbank. Niet "hoeveel kaarten staan er
// open" — dat zegt iets over ons — maar "hoe lang weten wij iets dat zij niet
// weten". Dat is de enige maat waarin de leden voorkomen.
//
// Hij wordt afgeleid, nooit bijgehouden. Er is geen teller die opgehoogd wordt
// en die na een fout de rest van het jaar scheef staat.
//
// De rekensom is kort: een kaart waarvan het antwoord een bericht aan de leden
// is, en waar dat bericht nog niet verstuurd is, is achterstand. De leeftijd
// van de oudste daarvan is de achterstand.

import { urenSinds } from "./tijd.js";

// Eén lege stand, zodat elk scherm hetzelfde terugkrijgt als er niets is. Een
// scherm dat moet weten of het antwoord leeg is, vergeet dat een keer.
const NIETS = { uren: 0, dagen: 0, posten: [], aantal: 0, kleur: "grijs", sinds: null, bij: true };

async function uurGrens(env, sleutel, standaard) {
  try {
    const r = await env.DB.prepare(
      "select waarde from instelling where sleutel = ? and archief = 0"
    ).bind(sleutel).first();
    const n = Number(r && r.waarde);
    return Number.isFinite(n) && n > 0 ? n : standaard;
  } catch {
    return standaard;
  }
}

export async function achterstand(env, { cyclus = null, nu = null } = {}) {
  const moment = nu ? new Date(nu) : new Date();

  // Welke kaartsoorten gaan over de leden? Dat staat in de definitie: een kaart
  // waarvan knop 1 naar 'publicatie' wijst, vraagt om een bericht. Zo hoeft hier
  // geen lijst met kaartsoorten te staan die achterloopt op de inrichting.
  const posten = (await env.DB.prepare(
    `select g.id, g.titel, g.moment, g.cyclus, g.positie,
            d.kaartsoort, d.knop1_label,
            p.id as publicatie, p.status as bericht_status
       from gebeurtenis g
       join processtap d on d.id = g.processtap
       left join publicatie p on p.gebeurtenis = g.id and p.archief = 0
      where d.knop1_doel = 'publicatie' and d.archief = 0
        and g.archief = 0 and g.vraagt_antwoord = 1
        and (p.id is null or p.status <> 'verstuurd')
        and (g.beantwoord_op is null or p.id is not null)
        -- Een naleeskaart gaat over een bericht dat al bestaat; dat bericht
        -- staat hier al via zijn eigen kaart. Zonder deze regel telde hetzelfde
        -- onvertelde ding twee keer, en zei de meter 'achter op 2 dingen' waar
        -- er één was.
        and g.publicatie is null
        and (? is null or g.cyclus = ?)
      order by g.moment
      limit 500`
  ).bind(cyclus, cyclus).all()).results;

  if (posten.length === 0) return { ...NIETS, posten: [] };

  const amber = await uurGrens(env, "achterstand_amber_uur", 24);
  const rood = await uurGrens(env, "achterstand_rood_uur", 72);

  const oudste = posten[0].moment;
  const uren = urenSinds(oudste, moment);

  return {
    uren: Math.round(uren),
    dagen: Math.floor(uren / 24),
    sinds: oudste,
    aantal: posten.length,
    // Groen bestaat hier niet. Een achterstand van nul is niet 'goed' maar
    // gewoon niets — dan staat de meter grijs en zwijgt hij.
    kleur: uren >= rood ? "rood" : uren >= amber ? "amber" : "grijs",
    bij: false,
    posten: posten.map((p) => ({
      gebeurtenis: p.id,
      titel: p.titel,
      sinds: p.moment,
      kaartsoort: p.kaartsoort,
      // Waar het vastzit: nog geen bericht, of een bericht dat nog niet weg is.
      stand: p.publicatie ? `bericht ${p.bericht_status}` : "nog geen bericht",
      publicatie: p.publicatie || null,
      cyclus: p.cyclus,
    })),
  };
}

// Hetzelfde in één regel, voor de kop van een scherm.
export function inWoorden(a) {
  if (!a || a.bij) return "De leden zijn bij.";
  if (a.uren < 24) return `De leden lopen ${a.uren} uur achter.`;
  const d = a.dagen;
  return `De leden lopen ${d} ${d === 1 ? "dag" : "dagen"} achter op ${a.aantal === 1 ? "één ding" : `${a.aantal} dingen`}.`;
}
