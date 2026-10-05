// Delta Blueprint Cockpit — worker
//
// Twee regels die hier worden afgedwongen en nergens anders:
//   1. Er is geen DELETE-route op records. Niets wat vastgelegd is wordt
//      verwijderd (uitgangspunt 2). Uitzondering: een favoriet en je eigen
//      geschiedenis — dat zijn persoonlijke instellingen, geen vastlegging.
//   2. Authenticatie is per persoon: e-mailadres plus wachtwoord. Elke
//      schrijfactie draagt een identiteit (BOUWSPEC 11). Geen gedeelde sleutel.

import { lijst } from "./lijst.js";
import { wijzig, archiveer, dupliceer, maakAan, sjabloon, samen } from "./schrijf.js";
import { record } from "./record.js";
import { voorbereiden, uitvoeren } from "./import.js";
import { stand, startMoment, versturen, uitkomst as gonogoUitkomst } from "./gonogo.js";
import { openPosities, haalRapport, neemRapportAan, laatsteRapport } from "./lynx.js";
import { stappenVoor } from "./proces.js";
import { sjablonen, importeer as importeerVoorwaarden } from "./voorwaarden.js";
import { overzicht, bewaarChartlezing } from "./besluit.js";
import { onverdeeld, wijsToe, verstuurPublicatie, conceptberichten } from "./spiegel.js";
import { neemStand, stand as brugstand, zetInstellingen } from "./brug.js";
import { favorieten, favorietToevoegen, favorietWijzigen, favorietWeg,
         favorietenVolgorde, bezoeken, bezoekBijzetten, bezoekenLeeg } from "./navigator.js";
import { draai, motorstand, naWijziging } from "./motor.js";
import { wachtrij, beantwoord, stand as wachtrijstand } from "./wachtrij.js";
import { conceptUitKaart, vraagNalezen, geefVrij, stuurTerug } from "./bericht.js";
import { achterstand, inWoorden } from "./achterstand.js";
import { huidig as barometer, stelVast } from "./barometer.js";
import { stroom } from "./stroom.js";
import { tedoen } from "./stappen.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extraKoppen = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...JSON_HEADERS, ...extraKoppen } });
}

async function sha256hex(tekst) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Wie is dit? Geeft de gebruiker terug, of null.
//
// Aanmelden gaat met e-mailadres en wachtwoord, meegestuurd als HTTP Basic:
//   Authorization: Basic base64("simon@deltablueprint.nl:wachtwoord")
// Het wachtwoord staat nergens opgeslagen — alleen de SHA-256 hash ervan.
// Het e-mailadres is de gebruikersnaam; het wachtwoord kan wijzigen zonder
// dat de identiteit verandert.
function gelijkInVasteTijd(a, b) {
  if (a.length !== b.length) return false;
  let verschil = 0;
  for (let i = 0; i < a.length; i++) verschil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return verschil === 0;
}

async function wieIsDit(request, env) {
  const kop = request.headers.get("authorization") || "";
  if (!kop.startsWith("Basic ")) return null;

  let ontcijferd;
  try {
    ontcijferd = atob(kop.slice(6).trim());
  } catch {
    return null;
  }
  const scheiding = ontcijferd.indexOf(":");
  if (scheiding < 1) return null;

  const email = ontcijferd.slice(0, scheiding).trim().toLowerCase();
  const wachtwoord = ontcijferd.slice(scheiding + 1);
  if (!email || !wachtwoord) return null;

  const gebruiker = await env.DB.prepare(
    "select id, naam, korte_naam, email, wachtwoord_hash from gebruiker where lower(email) = ? and actief = 1"
  ).bind(email).first();

  if (!gebruiker || !gebruiker.wachtwoord_hash) return null;

  const hash = await sha256hex(wachtwoord);
  if (!gelijkInVasteTijd(hash, gebruiker.wachtwoord_hash)) return null;

  return { id: gebruiker.id, naam: gebruiker.naam, korte_naam: gebruiker.korte_naam, email: gebruiker.email };
}

// /api/meta — de applicatie leest hier haar eigen vorm.
async function meta(env) {
  const [tabellen, velden, keuzes, modules, weergaven, versie, gebruikers] = await Promise.all([
    env.DB.prepare("select * from db_table where actief = 1 order by volgorde, label").all(),
    env.DB.prepare("select * from db_field where actief = 1 order by tabel, volgorde").all(),
    env.DB.prepare("select * from db_choice where actief = 1 order by tabel, kolom, volgorde").all(),
    env.DB.prepare("select * from db_module where actief = 1 order by volgorde").all(),
    env.DB.prepare("select * from db_view where actief = 1").all(),
    env.DB.prepare("select * from configuratieversie order by nummer desc limit 1").first(),
    env.DB.prepare("select id, naam, korte_naam, avatar, kleur from gebruiker where actief = 1").all(),
  ]);

  // Het menu komt gegroepeerd terug, in de volgorde van db_module.
  const groepen = [];
  for (const m of modules.results) {
    let g = groepen.find((x) => x.groep === m.groep);
    if (!g) groepen.push((g = { groep: m.groep, items: [] }));
    g.items.push({
      label: m.label,
      tabel: m.doeltabel,
      route: m.route || (m.doeltabel ? `/t/${m.doeltabel}` : null),
      filter: m.standaardfilter,
    });
  }

  const velden_per_tabel = {};
  for (const v of velden.results) (velden_per_tabel[v.tabel] ||= []).push(v);

  const keuzes_per_veld = {};
  for (const k of keuzes.results) (keuzes_per_veld[`${k.tabel}.${k.kolom}`] ||= []).push(k);

  return {
    configuratieversie: versie,
    gebruikers: Object.fromEntries(gebruikers.results.map((g) => [g.id, g])),
    menu: groepen,
    tabellen: tabellen.results.map((t) => ({
      ...t,
      velden: velden_per_tabel[t.naam] || [],
    })),
    keuzes: keuzes_per_veld,
    weergaven: weergaven.results,
  };
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await behandel(request, env, ctx);
    } catch (fout) {
      // Een onverwachte fout mag nooit als Cloudflare-foutpagina terugkomen:
      // dan weet je niet wat er stuk is.
      return json({ fout: `Er ging iets mis: ${fout.message}` }, 500);
    }
  },

  // De cron. Eén keer per uur draait de motor een ronde: de klok schrijft wat
  // er niet gebeurde, de weger maakt kaarten van wat er wel gebeurde.
  //
  // Dit is het enige dat zonder mens draait, en het doet met opzet maar één
  // ding: gebeurtenissen stempelen. Er gaat hier niets naar de broker, er wordt
  // niets verstuurd en er wordt niets gewist. Een kaart is een vraag aan ons;
  // het antwoord blijft mensenwerk.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const verslag = await draai(env, { nu: new Date(event.scheduledTime) });
        console.log("motor", JSON.stringify(verslag));
      } catch (fout) {
        // Een ronde die omvalt mag de volgende niet meenemen. De cron komt
        // over een uur gewoon terug.
        console.log("motor mislukt:", fout.message);
      }
    })());
  },
};

async function behandel(request, env, ctx) {
  // Een korte motorronde achter het antwoord aan. Het scherm hoeft er niet op te
  // wachten, maar als je een beoordelingsmoment op 'blind inzenden' zet omdat het
  // gesprek nú begint, staat de kaart er een seconde later — niet pas als de
  // cron langskomt.
  const naSchrijven = (tabel) => {
    if (!ctx || typeof ctx.waitUntil !== "function") return;
    ctx.waitUntil(naWijziging(env, tabel).catch(() => null));
  };
  {
    const url = new URL(request.url);
    const pad = url.pathname;

    // Er is geen DELETE op records. De uitzondering is wat geen vastlegging is
    // maar een persoonlijke instelling: een favoriet en je eigen geschiedenis.
    // Die bewaren niets over een cyclus, een besluit of een positie — ze zeggen
    // alleen waar jij graag heen gaat en waar je net was. Zoiets hoort gewoon
    // weg te kunnen, en het archiveren ervan zou een lijst opbouwen die niemand
    // ooit nog wil lezen.
    const magWeg = /^\/api\/favoriet\/\d+$/.test(pad) || pad === "/api/bezoek";
    if (request.method === "DELETE" && !magWeg) {
      return json({ fout: "Er is geen DELETE-route. Records worden gearchiveerd, niet verwijderd." }, 405);
    }

    // Open: zegt alleen of de boel draait.
    if (pad === "/api/gezondheid") {
      let db = "niet bereikbaar";
      try {
        const r = await env.DB.prepare("select versie from schema_versie order by versie desc limit 1").first();
        db = r ? `schema versie ${r.versie}` : "leeg";
      } catch (e) {
        db = `fout: ${e.message}`;
      }
      return json({ ok: true, omgeving: env.OMGEVING, database: db, tijd: new Date().toISOString() });
    }

    // Het rapport van Lynx wordt aangeleverd door een machine die wél bij IBKR
    // mag. Dat is geen mens: hij meldt zich niet aan met e-mailadres en
    // wachtwoord maar met een eigen sleutel, en hij kan ook niets anders dan
    // dit ene ding.
    // De brug levert af zonder aanmelding, met de afgesproken sleutel: dit is
    // een programma en geen mens. Eén kant op — er is geen route terug naar de
    // broker, en de brug vraagt de cockpit nooit iets.
    if (pad === "/api/brug" && request.method === "POST") {
      const sleutel = request.headers.get("x-brug-sleutel") || "";
      const verwacht = env.BRUG_SLEUTEL || "";
      if (!verwacht || !gelijkInVasteTijd(sleutel, verwacht)) {
        return json({ fout: "Niet herkend." }, 401);
      }
      const pakket = await request.json().catch(() => null);
      if (!pakket) return json({ fout: "Geen leesbaar pakket." }, 400);
      const uit = await neemStand(env, pakket);
      if (uit.fout) return json(uit, uit.status || 400);
      return json(uit);
    }

    if (pad === "/api/lynx/rapport" && request.method === "POST") {
      const sleutel = request.headers.get("x-lynx-sleutel") || "";
      const verwacht = env.LYNX_PUSH_SLEUTEL || "";
      if (!verwacht || !gelijkInVasteTijd(sleutel, verwacht)) {
        return json({ fout: "Niet herkend." }, 401);
      }
      const xml = await request.text();
      const uit = await neemRapportAan(env, xml, "script");
      if (uit.fout) return json(uit, uit.status || 400);
      return json(uit);
    }

    // Alles onder /api/ vraagt om een persoon.
    if (pad.startsWith("/api/")) {
      const ik = await wieIsDit(request, env);
      if (!ik) {
        return json({ fout: "Niet herkend. Meld je aan met je e-mailadres en wachtwoord." }, 401, { "www-authenticate": 'Basic realm="Delta Blueprint Cockpit", charset="UTF-8"' });
      }

      if (pad === "/api/meta") return json(await meta(env));

      if (pad === "/api/ik" && request.method === "GET") {
        const g = await env.DB.prepare(
          "select id, naam, korte_naam, email, avatar, kleur from gebruiker where id = ?"
        ).bind(ik.id).first();
        return json(g || ik);
      }

      // Je eigen avatar. Alleen die van jezelf: iemand anders zijn gezicht
      // veranderen hoort niet te kunnen.
      if (pad === "/api/ik/avatar" && request.method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const avatar = body.avatar;
        if (avatar !== null && (typeof avatar !== "string" || !avatar.startsWith("data:image/"))) {
          return json({ fout: "Dat is geen afbeelding." }, 400);
        }
        if (avatar && avatar.length > 200000) {
          return json({ fout: "De afbeelding is te groot; kies een kleinere." }, 413);
        }
        await env.DB.prepare("update gebruiker set avatar = ? where id = ?").bind(avatar, ik.id).run();
        return json({ ok: true });
      }

      // /api/t/<tabel> — de lijst
      const lijstPad = pad.match(/^\/api\/t\/([a-z_]+)$/);
      if (lijstPad) {
        if (request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const gemaakt = await maakAan(env, ik, lijstPad[1], body);
          if (gemaakt.fout) return json(gemaakt, gemaakt.status || 400);
          naSchrijven(lijstPad[1]);
          return json(gemaakt, 201);
        }
        if (request.method !== "GET") return json({ fout: "Deze methode bestaat niet." }, 405);
        const uitkomst = await lijst(env, lijstPad[1], url.searchParams, ik);
        if (uitkomst.fout) return json({ fout: uitkomst.fout }, uitkomst.status || 400);
        return json(uitkomst);
      }

      // Wat er met de lopende tranches gebeurd is bij Lynx. Lezend en
      // voorstellend: dit eindpunt legt niets vast en verandert niets.
      // De live stand van de broker, met hoe vers hij is.
      if (pad === "/api/brug" && request.method === "GET") {
        return json(await brugstand(env));
      }
      if (pad === "/api/brug/instelling" && request.method === "PUT") {
        const body = await request.json().catch(() => ({}));
        const uit = await zetInstellingen(env, ik, body.waarden || {});
        if (uit.fout) return json(uit, uit.status || 400);
        return json(await brugstand(env));
      }
      // Of het laatste Flex-rapport er is, en hoe oud: het vangnet hoort ook
      // zichtbaar te zijn.
      if (pad === "/api/brug/flex" && request.method === "GET") {
        const r = await env.DB.prepare(
          "select opgehaald_op, bron, regels, length(xml) as grootte from lynx_rapport order by id desc limit 1"
        ).first().catch(() => null);
        return json({ rapport: r || null });
      }


      // De wachtrij: wat er nu van ons gevraagd wordt. Zonder cyclus: alles.
      // Dit is een vraag, geen opgeslagen lijst — de prioriteit en de tekst
      // worden bij elke aanroep opnieuw afgeleid, omdat ze met de tijd mee
      // veranderen.
      if (pad === "/api/wachtrij" && request.method === "GET") {
        const c = url.searchParams.get("cyclus");
        return json(await wachtrij(env, ik, {
          cyclus: c ? Number(c) : null,
          van: url.searchParams.get("van") === "mij" ? "mij" : "alles",
        }));
      }

      // Of er iets veranderd is. Klein genoeg om elke tien seconden te stellen;
      // het scherm haalt de volle wachtrij pas op als het antwoord anders is.
      if (pad === "/api/wachtrij/stand" && request.method === "GET") {
        const c = url.searchParams.get("cyclus");
        const [rij, motor] = await Promise.all([
          wachtrijstand(env, ik, { cyclus: c ? Number(c) : null }),
          motorstand(env),
        ]);

        // Het vangnet. De brug is de klok, maar een klok die stilstaat moet
        // iemand merken — en als jij naar de werkbank kijkt, ben jij die
        // iemand. Deze peiling komt elke tien seconden langs; is de brug stil,
        // dan houdt een openstaand scherm de motor draaiend.
        //
        // Achter het antwoord aan, zodat het scherm er niet op wacht. De ronde
        // zelf beslist of er iets te doen valt.
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(draai(env, { aanleiding: "brug" }).catch(() => null));
        }

        return json({ ...rij, motor });
      }

      // Een kaart beantwoorden. Wegklikken is ook een antwoord: het zegt
      // "gezien, en we doen niets", en het blijft staan. Er is geen route die
      // een kaart wist.
      const kaartAntwoord = pad.match(/^\/api\/wachtrij\/(\d+)\/antwoord$/);
      if (kaartAntwoord && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const uit = await beantwoord(env, ik, Number(kaartAntwoord[1]), {
          knop: body.knop ? Number(body.knop) : null,
          doel: body.doel || null,
          reden: body.reden || null,
          tot: body.tot || null,
        });
        if (uit.fout) return json(uit, uit.status || 400);
        return json(uit);
      }

      // De werkbank opent op één cyclus: de lopende. Welke dat is hoort het
      // scherm niet zelf te raden uit een lijst.
      if (pad === "/api/werkbank/cycli" && request.method === "GET") {
        const cycli = (await env.DB.prepare(
          `select id, label, status, geopend_op from cyclus
            where archief = 0 and status not in ('afgesloten', 'geannuleerd')
            order by geopend_op desc`
        ).all()).results;
        return json({ cycli });
      }

      // Wat er in deze cyclus nog te doen staat: de stappen van het proces die
      // nog niet af zijn. Geen kaarten — een stap is een toestand die zichzelf
      // oplost, geen vraag die om een antwoord vraagt. Zie worker/stappen.js.
      const tedoenRoute = pad.match(/^\/api\/cyclus\/(\d+)\/tedoen$/);
      if (tedoenRoute && request.method === "GET") {
        return json(await tedoen(env, Number(tedoenRoute[1])));
      }

      // De stroom van een cyclus: wat er gebeurde, nieuwste eerst.
      const stroomRoute = pad.match(/^\/api\/cyclus\/(\d+)\/stroom$/);
      if (stroomRoute && request.method === "GET") {
        const n = Number(url.searchParams.get("limiet")) || 40;
        return json({ stroom: await stroom(env, Number(stroomRoute[1]), Math.min(n, 200)) });
      }

      // De barometer van een cyclus: wat wij vastgesteld hebben, en wat de leden
      // ervan weten. Twee velden, met opzet — zolang ze verschillen loopt er
      // een achterstand, en die hoort niet weggerekend te worden tot één getal.
      const baro = pad.match(/^\/api\/cyclus\/(\d+)\/barometer$/);
      if (baro && request.method === "GET") {
        return json(await barometer(env, Number(baro[1])));
      }
      if (baro && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const uit = await stelVast(env, ik, {
          cyclus: Number(baro[1]),
          stand: body.stand, venster: body.venster, reden: body.reden,
          gebeurtenis: body.gebeurtenis ? Number(body.gebeurtenis) : null,
        });
        if (uit.fout) return json(uit, uit.status || 400);
        return json(uit);
      }

      // De achterstand: hoe lang weten wij iets dat de leden niet weten. De ene
      // blijvende meter van de werkbank, en de enige maat waarin de leden
      // voorkomen. Afgeleid, nooit bijgehouden.
      if (pad === "/api/achterstand" && request.method === "GET") {
        const c = url.searchParams.get("cyclus");
        const a = await achterstand(env, { cyclus: c ? Number(c) : null });
        return json({ ...a, zin: inWoorden(a) });
      }

      // Van kaart naar concept. Het sjabloon staat in beheer, niet in de code.
      // Twee keer drukken levert hetzelfde concept op, geen tweede.
      const kaartConcept = pad.match(/^\/api\/wachtrij\/(\d+)\/concept$/);
      if (kaartConcept && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const uit = await conceptUitKaart(env, ik, Number(kaartConcept[1]), body.sjabloon || null);
        if (uit.fout) return json(uit, uit.status || 400);
        return json(uit);
      }

      // Nalezen: de vraag gaat als kaart naar de wachtrij van de lezer. Er is
      // geen aparte postbus — er is één rij, en dit staat erin.
      const bericht = pad.match(/^\/api\/publicatie\/(\d+)\/(nalezen|vrijgeven|terug)$/);
      if (bericht && request.method === "POST") {
        const id = Number(bericht[1]);
        const body = await request.json().catch(() => ({}));
        const uit = bericht[2] === "nalezen" ? await vraagNalezen(env, ik, id, body.lezer)
                  : bericht[2] === "vrijgeven" ? await geefVrij(env, ik, id)
                  : await stuurTerug(env, ik, id, body.reden);
        if (uit.fout) return json(uit, uit.status || 400);
        return json(uit);
      }

      // De posities die bij geen cyclus horen, en het toewijzen ervan. Dat is
      // het enige wat een mens nog doet aan de brokerkant: zeggen waar een
      // contract bij hoort, of dat het er niet bij hoort.
      if (pad === "/api/posities/onverdeeld" && request.method === "GET") {
        const cycli = (await env.DB.prepare(
          `select id, label, status from cyclus
            where archief = 0 and status <> 'afgesloten' order by geopend_op desc`
        ).all()).results;
        return json({ posities: await onverdeeld(env), cycli });
      }
      const toewijzen = pad.match(/^\/api\/posities\/(\d+)\/cyclus$/);
      if (toewijzen && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const uit = await wijsToe(env, ik, Number(toewijzen[1]), body.cyclus, Boolean(body.buiten));
        if (uit.fout) return json(uit, uit.status || 400);
        return json(uit);
      }

      // Het bericht aan de leden. Versturen is onomkeerbaar, dus het is een
      // eigen handeling met een eigen knop — geen gevolg van een gevuld veld.
      if (pad === "/api/publicaties/concept" && request.method === "GET") {
        return json({ berichten: await conceptberichten(env) });
      }
      const versturen = pad.match(/^\/api\/publicaties\/(\d+)\/versturen$/);
      if (versturen && request.method === "POST") {
        const uit = await verstuurPublicatie(env, ik, Number(versturen[1]));
        if (uit.fout) return json(uit, uit.status || 400);
        return json(uit);
      }

      // Favorieten en geschiedenis: de twee tabbladen van de navigator. Altijd
      // van jezelf — er is geen weg naar die van een ander.
      if (pad === "/api/favoriet") {
        if (request.method === "GET") return json(await favorieten(env, ik));
        if (request.method === "POST") {
          const uit = await favorietToevoegen(env, ik, await request.json().catch(() => ({})));
          if (uit.fout) return json(uit, uit.status || 400);
          return json(uit);
        }
        return json({ fout: "Deze methode bestaat niet." }, 405);
      }
      if (pad === "/api/favoriet/volgorde" && request.method === "PUT") {
        const body = await request.json().catch(() => ({}));
        return json(await favorietenVolgorde(env, ik, body.ids));
      }
      const favPad = pad.match(/^\/api\/favoriet\/(\d+)$/);
      if (favPad) {
        const id = Number(favPad[1]);
        if (request.method === "PATCH") {
          const uit = await favorietWijzigen(env, ik, id, await request.json().catch(() => ({})));
          if (uit.fout) return json(uit, uit.status || 400);
          return json(uit);
        }
        if (request.method === "DELETE") return json(await favorietWeg(env, ik, id));
        return json({ fout: "Deze methode bestaat niet." }, 405);
      }

      if (pad === "/api/bezoek") {
        if (request.method === "GET") return json(await bezoeken(env, ik));
        if (request.method === "POST") {
          return json(await bezoekBijzetten(env, ik, await request.json().catch(() => ({}))));
        }
        if (request.method === "DELETE") return json(await bezoekenLeeg(env, ik));
        return json({ fout: "Deze methode bestaat niet." }, 405);
      }

      // Persoonlijke voorkeuren: kolombreedtes en wat iemand verder zelf
      // instelt. Altijd van jezelf; die van een ander kun je niet lezen.
      const voorkeurPad = pad.match(/^\/api\/voorkeur\/([a-z0-9._-]+)$/i);
      if (voorkeurPad && request.method === "GET") {
        const r = await env.DB.prepare(
          "select waarde from gebruiker_voorkeur where gebruiker = ? and sleutel = ?"
        ).bind(ik.id, voorkeurPad[1]).first();
        return json({ waarde: r ? JSON.parse(r.waarde) : null });
      }
      if (voorkeurPad && request.method === "PUT") {
        const body = await request.json().catch(() => ({}));
        const tekst = JSON.stringify(body.waarde ?? null);
        if (tekst.length > 20000) return json({ fout: "Te veel om te onthouden." }, 413);
        await env.DB.prepare(
          `insert into gebruiker_voorkeur (gebruiker, sleutel, waarde, gewijzigd)
           values (?, ?, ?, datetime('now'))
           on conflict (gebruiker, sleutel) do update set waarde = excluded.waarde, gewijzigd = excluded.gewijzigd`
        ).bind(ik.id, voorkeurPad[1], tekst).run();
        return json({ ok: true });
      }

      // Importeren uit een document, in twee stappen.
      if (pad === "/api/import/event/voorbereiden" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!Array.isArray(body.rijen)) return json({ fout: "Geen regels ontvangen." }, 400);
        if (body.rijen.length > 2000) return json({ fout: "Maximaal 2000 regels per keer." }, 413);
        return json(await voorbereiden(env, body.rijen));
      }
      if (pad === "/api/import/event/uitvoeren" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!Array.isArray(body.regels)) return json({ fout: "Geen regels ontvangen." }, 400);
        return json(await uitvoeren(env, ik, body.regels));
      }

      // /api/t/<tabel>/nieuw — een leeg record om mee te beginnen
      const nieuwPad = pad.match(/^\/api\/t\/([a-z_]+)\/nieuw$/);
      if (nieuwPad && request.method === "GET") {
        const ouderParam = url.searchParams.get("ouder");
        const ouder = ouderParam && ouderParam.includes(":")
          ? { tabel: ouderParam.split(":")[0], id: ouderParam.split(":")[1] }
          : null;
        const uitkomst = await sjabloon(env, nieuwPad[1], ouder, ik);
        if (uitkomst.fout) return json({ fout: uitkomst.fout }, uitkomst.status || 400);
        return json(uitkomst);
      }

      // Wat er bij de broker open staat. Lezend; het systeem plaatst nooit
      // zelf een order.
      if (pad === "/api/lynx/posities" && request.method === "GET") {
        return json(await openPosities(env));
      }
      // Om te zien wat Lynx werkelijk antwoordt als er iets misgaat. Het token
      // staat er niet in: alleen wat er terugkwam.
      if (pad === "/api/lynx/diagnose" && request.method === "GET") {
        const uit = await haalRapport(env, true);
        return json({
          fout: uit.fout || null,
          pogingen: uit.pogingen || null,
          ruw: uit.ruw || (uit.xml ? uit.xml.slice(0, 2000) : null),
          token_ingesteld: Boolean(env.LYNX_FLEX_TOKEN),
          query_ingesteld: Boolean(env.LYNX_FLEX_QUERY),
        });
      }

      // Voorwaarden overnemen uit eerdere cycli: de vraag, niet het antwoord.
      const voorwaardePad = pad.match(/^\/api\/voorwaarde\/(sjablonen|overnemen)\/(\d+)$/);
      if (voorwaardePad) {
        const cyclusId = Number(voorwaardePad[2]);
        if (voorwaardePad[1] === "sjablonen" && request.method === "GET") {
          return json({ voorwaarden: await sjablonen(env, cyclusId) });
        }
        if (voorwaardePad[1] === "overnemen" && request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const uit = await importeerVoorwaarden(env, ik, cyclusId, body.sleutels);
          if (uit.fout) return json(uit, uit.status || 400);
          return json(uit);
        }
        return json({ fout: "Deze methode bestaat niet." }, 405);
      }

      // Het materiaal voor het gesprek, en de uitkomst die eruit volgt.
      const besluitPad = pad.match(/^\/api\/besluit\/(\d+)(?:\/(uitkomst|chart))?$/);
      if (besluitPad) {
        const momentId = Number(besluitPad[1]);
        if (!besluitPad[2] && request.method === "GET") {
          const uit = await overzicht(env, ik, momentId);
          if (uit.fout) return json({ fout: uit.fout }, uit.status || 400);
          return json(uit);
        }
        if (besluitPad[2] === "chart" && request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const uit = await bewaarChartlezing(env, ik, momentId, body);
          if (uit.fout) return json(uit, uit.status || 400);
          return json(uit);
        }
        if (besluitPad[2] === "uitkomst" && request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const m = await env.DB.prepare("select cyclus from beoordelingsmoment where id = ?")
            .bind(momentId).first();
          if (!m) return json({ fout: "Geen besluit met dat nummer." }, 404);
          const uit = await gonogoUitkomst(env, ik, m.cyclus, body, momentId);
          if (uit.fout) return json(uit, uit.status || 400);
          naSchrijven("beoordelingsmoment");
          return json(uit);
        }
        return json({ fout: "Deze methode bestaat niet." }, 405);
      }

      // ---- de go/no-go (etappe 10) ----
      // Twee schermen op één cyclus: blind versturen en de meeting. De
      // afscherming zit hier, aan de serverkant.
      const gonogoPad = pad.match(/^\/api\/gonogo\/(\d+)(?:\/(moment|versturen|uitkomst))?$/);
      if (gonogoPad) {
        const cyclusId = Number(gonogoPad[1]);
        const wat = gonogoPad[2];
        if (!wat && request.method === "GET") {
          const uitkomst = await stand(env, ik, cyclusId);
          if (uitkomst.fout) return json({ fout: uitkomst.fout }, uitkomst.status || 400);
          return json(uitkomst);
        }
        if (wat && request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const doen = wat === "moment" ? startMoment : wat === "versturen" ? versturen : gonogoUitkomst;
          const uitkomst = await doen(env, ik, cyclusId, body);
          if (uitkomst.fout) return json(uitkomst, uitkomst.status || 400);
          // Het gesprek begint nu: de kaarten horen er nu te staan.
          naSchrijven("beoordelingsmoment");
          return json(uitkomst);
        }
        return json({ fout: "Deze methode bestaat niet." }, 405);
      }

      // /api/t/<tabel>/<id> — één record lezen of wijzigen
      const recordPad = pad.match(/^\/api\/t\/([a-z_]+)\/(\d+)$/);
      if (recordPad && request.method === "GET") {
        const uitkomst = await record(env, recordPad[1], Number(recordPad[2]), ik);
        if (uitkomst.fout) return json({ fout: uitkomst.fout }, uitkomst.status || 400);
        return json(uitkomst);
      }
      if (recordPad && request.method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const uitkomst = await wijzig(env, ik, recordPad[1], Number(recordPad[2]), body);
        if (uitkomst.fout) return json(uitkomst, uitkomst.status || 400);
        naSchrijven(recordPad[1]);
        return json(uitkomst);
      }

      // /api/t/<tabel>/samen — dezelfde wijziging op meerdere records
      const samenPad = pad.match(/^\/api\/t\/([a-z_]+)\/samen$/);
      if (samenPad && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const uit = await samen(env, ik, samenPad[1], body.ids || [], body.velden || {}, body.revisies || {});
        if (uit.fout) return json(uit, uit.status || 400);
        naSchrijven(samenPad[1]);
        return json(uit);
      }

      // /api/t/<tabel>/archiveer — één of meer records naar het archief
      const archiefPad = pad.match(/^\/api\/t\/([a-z_]+)\/archiveer$/);
      if (archiefPad && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const ids = (body.ids || []).map(Number).filter(Boolean);
        if (!ids.length) return json({ fout: "Geen records opgegeven." }, 400);
        const uitkomst = await archiveer(env, ik, archiefPad[1], ids, body.reden);
        if (uitkomst.fout) return json({ fout: uitkomst.fout }, uitkomst.status || 400);
        naSchrijven(archiefPad[1]);
        return json(uitkomst);
      }

      // /api/t/<tabel>/<id>/stappen — de stand van het proces, los op te halen
      // zodat de checklist kan bijwerken zonder het hele scherm te hertekenen.
      const stappenPad = pad.match(/^\/api\/t\/([a-z_]+)\/(\d+)\/stappen$/);
      if (stappenPad && request.method === "GET") {
        const tabelnaam = stappenPad[1];
        const rij = await env.DB.prepare(`select * from "${tabelnaam}" where id = ?`)
          .bind(Number(stappenPad[2])).first().catch(() => null);
        if (!rij) return json({ fout: "Niet gevonden." }, 404);
        const t = await env.DB.prepare("select proces_veld from db_table where naam = ?").bind(tabelnaam).first();
        return json({
          stappen: await stappenVoor(env, tabelnaam, rij),
          stand: t && t.proces_veld ? rij[t.proces_veld] : null,
        });
      }

      // /api/t/<tabel>/<id>/dupliceer
      const kopiePad = pad.match(/^\/api\/t\/([a-z_]+)\/(\d+)\/dupliceer$/);
      if (kopiePad && request.method === "POST") {
        const uitkomst = await dupliceer(env, ik, kopiePad[1], Number(kopiePad[2]));
        if (uitkomst.fout) return json({ fout: uitkomst.fout }, uitkomst.status || 400);
        return json(uitkomst);
      }

      return json({ fout: `Onbekend eindpunt: ${pad}` }, 404);
    }

    return new Response("Delta Blueprint Cockpit", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
