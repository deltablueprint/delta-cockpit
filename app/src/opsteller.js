// De opsteller: het scherm waarop een bericht naar de leden klaargemaakt wordt.
//
// Eén bericht, één scherm, en de volgorde van het scherm is de volgorde van het
// werk: wat er gebeurd is, wat wij erover schrijven, en dan pas de deur.
//
// De feiten staan boven de tekst en zijn vast. Ze zijn vastgelegd zoals ze waren
// toen het bericht werd klaargezet — verandert de positie later, dan verandert
// een verstuurd bericht niet mee. Wat eruit ging, ging eruit.
//
// Er staat met opzet geen knop 'wissen' op dit scherm. Een bericht dat niet weg
// moet, laat je staan; de kaart waar het uit kwam heeft een prullenbak die zegt
// 'gezien, en we doen niets'.

import {
  record, bewaar, verstuurBericht, vraagNalezen, geefVrij, stuurTerug,
  meta as haalMeta, ik as haalIk,
} from "./api.js";
import { ontsnap } from "./veld.js";

const STAND = {
  concept:   { label: "In concept",            kleur: "grijs" },
  nalezen:   { label: "Ligt bij de nalezer",   kleur: "amber" },
  klaar:     { label: "Klaar om te versturen", kleur: "blauw" },
  verstuurd: { label: "Verstuurd",             kleur: "groen" },
};

// Welke feiten op welk bericht horen. Een bericht over de barometer heeft geen
// strike, en een lege regel 'Strike —' maakt een bericht niet duidelijker.
const FEITEN = [
  ["contract", "Contract"],
  ["strike", "Strike"],
  ["expiratiedatum", "Expiratie"],
  ["aantal", "Aantal"],
  ["premie_pt", "Premie"],
  ["resultaat_pt", "Resultaat"],
];

// Een doorrol gaat over twee posities. Het bericht hangt aan de sluiting, dus
// de losse feiten hierboven beschrijven de oude positie — wie het bericht leest
// zag daardoor nergens welke positie er geopend werd. Staan beide kanten op het
// bericht, dan tonen we die twee en laten we de losse velden van de ene kant
// weg.
const DOORROL = [
  ["gesloten_positie", "Gesloten"],
  ["geopende_positie", "Geopend"],
];

export async function opstellerscherm(inhoud, kruimel, id, opties = {}) {
  kruimel.innerHTML = `<span>Communicatie</span> <span class="pijlje">&rsaquo;</span> <span>Bericht</span>`;
  inhoud.innerHTML = `<div class="opsteller">Bezig…</div>`;

  let ik = null;

  async function teken() {
    let data, m;
    try {
      [data, m, ik] = await Promise.all([record("publicatie", id), haalMeta(), ik ? ik : haalIk()]);
    } catch (fout) {
      inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
      return;
    }
    // Het recordscherm levert de waarden apart van de velddefinitie. Hier is
    // alleen het record zelf nodig; de opmaak staat in dit bestand.
    const p = { ...(data.waarden || {}), id, revisie: (data.waarden || {}).revisie };
    const gebruikers = m.gebruikers || {};

    const stand = STAND[p.status] || { label: p.status, kleur: "grijs" };
    const dicht = p.status === "verstuurd";
    const bijEenAnder = p.status === "nalezen";

    document.title = `${p.titel || "Bericht"} · Delta Wave Cockpit`;
    // De weg die je nam: uit Dispatch, of uit de lijst Berichten. Het oude
    // scherm /berichten staat niet meer in de navigator, dus wees de kruimel
    // daar ook niet meer naartoe.
    const uitDispatch = (opties && opties.van) === "werkbank";
    kruimel.innerHTML = `<span>Communicatie</span> <span class="pijlje">&rsaquo;</span>
      ${uitDispatch
        ? `<a href="#/werkbank">Dispatch</a>`
        : `<a href="#/t/publicatie">Berichten</a>`} <span class="pijlje">&rsaquo;</span>
      <span>${ontsnap(p.titel || "Bericht")}</span>`;

    const tweezijdig = Boolean(p.gesloten_positie || p.geopende_positie);
    const feiten = (tweezijdig ? DOORROL.concat([["resultaat_pt", "Resultaat"]]) : FEITEN)
      .filter(([k]) => p[k] !== null && p[k] !== undefined && p[k] !== "")
      .map(([k, label]) => `<div class="opfeit">
          <span class="opfeitlabel">${label}</span>
          <span class="opfeitwaarde">${ontsnap(p[k])}</span></div>`).join("");

    inhoud.innerHTML = `
      <div class="opsteller">
        <header class="opkop">
          <div class="opkoplinks">
            <span class="opstand s-${stand.kleur}">${ontsnap(stand.label)}</span>
            ${p.nalezer ? `<span class="opnalezer">${ontsnap(naam(gebruikers, p.nalezer))}</span>` : ""}
          </div>
          <span class="opkanaal">Naar de leden</span>
        </header>

        ${feiten ? `<div class="opfeiten">${feiten}</div>` : ""}

        <label class="opveld">
          <span class="opveldlabel">Titel</span>
          <input id="optitel" type="text" value="${ontsnap(p.titel || "")}" ${dicht || bijEenAnder ? "disabled" : ""}>
        </label>

        <label class="opveld">
          <span class="opveldlabel">Wat de leden lezen</span>
          <textarea id="optekst" rows="14" ${dicht || bijEenAnder ? "disabled" : ""}>${ontsnap(p.tekst || "")}</textarea>
        </label>

        ${dicht ? verstuurdRegel(p, gebruikers) : acties(p, gebruikers, ik)}
        <p class="opmelding" hidden></p>
      </div>`;

    if (!dicht) bind(p, teken);
  }

  await teken();
}

function naam(gebruikers, id) {
  const g = gebruikers[id];
  return g ? (g.korte_naam || g.naam) : id;
}

function verstuurdRegel(p, gebruikers) {
  return `<div class="opverstuurd">
    Verstuurd op ${ontsnap(String(p.verstuurd_op || "").slice(0, 16))}
    door ${ontsnap(naam(gebruikers, p.verstuurd_door))}.
    ${p.nagelezen_op ? ` Nagelezen door ${ontsnap(naam(gebruikers, p.nalezer))}.` : ""}
  </div>`;
}

// De knoppen die er zijn hangen van de stand af. Een knop tonen die niet mag,
// en hem dan laten mislukken, is erger dan hem weglaten: je hebt al bedacht dat
// je erop ging drukken.
function acties(p, gebruikers, ik) {
  const anderen = Object.values(gebruikers).filter((g) => !ik || g.id !== ik.id);

  if (p.status === "nalezen") {
    const ikBenDeLezer = ik && p.nalezer === ik.id;
    return `
      <div class="opacties">
        ${ikBenDeLezer
          ? `<button type="button" class="knop tweede" id="opterug">Terug naar de opsteller</button>
             <button type="button" class="knop" id="opvrij">Nalezen en vrijgeven</button>`
          : `<p class="opwacht">Ligt bij ${ontsnap(naam(gebruikers, p.nalezer))}. Zolang dat zo is, gaat het niet weg.</p>`}
      </div>`;
  }

  // Concept of klaar: alles op één regel. Kies je een nalezer, dan verandert de
  // knop mee — hij zegt dan wat er gebeurt als je erop drukt, en er is geen
  // tweede knop nodig die hetzelfde doet.
  return `
    <div class="opacties">
      <label class="opnalezenvak" for="oplezer">Eerst laten nalezen door
        <select id="oplezer">
          <option value="">niemand</option>
          ${anderen.map((g) => `<option value="${ontsnap(g.id)}">${ontsnap(g.naam)}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="knop tweede" id="opbewaar">Bewaren</button>
      <button type="button" class="knop" id="opversturen">Versturen naar de leden</button>
    </div>`;
}

// ------------------------------------------------------------- de handeling
function bind(p, opnieuw) {
  const vak = document.querySelector(".opmelding");
  const titel = document.getElementById("optitel");
  const tekst = document.getElementById("optekst");
  let bezig = false;

  const meld = (woorden, soort = "fout") => {
    vak.textContent = woorden;
    vak.className = `opmelding ${soort}`;
    vak.hidden = false;
  };

  const vergrendel = (aan) => {
    bezig = aan;
    document.querySelectorAll(".opacties button").forEach((b) => { b.disabled = aan; });
    if (!aan) kijkNalezer();
  };

  const doe = async (wat, daarna = opnieuw) => {
    if (bezig) return;
    vergrendel(true);
    try {
      await wat();
      await daarna();
    } catch (fout) {
      meld(fout.message);
      vergrendel(false);
    }
  };

  // Eerst bewaren wat er staat, dan pas de handeling. Anders verdwijnt de laatste
  // zin die je net typte op het moment dat je op versturen drukt — en dat is de
  // zin waar je het langst over hebt gedaan.
  const bewaarEerst = async () => {
    if (!titel || !tekst || titel.disabled) return;
    const velden = {};
    if (titel.value !== (p.titel || "")) velden.titel = titel.value;
    if (tekst.value !== (p.tekst || "")) velden.tekst = tekst.value;
    if (Object.keys(velden).length === 0) return;
    await bewaar("publicatie", p.id, velden, p.revisie, null);
  };

  const bewaarKnop = document.getElementById("opbewaar");
  if (bewaarKnop) {
    bewaarKnop.addEventListener("click", () => doe(bewaarEerst, async () => {
      meld("Bewaard.", "goed");
      vergrendel(false);
      await opnieuw();
    }));
  }

  const versturen = document.getElementById("opversturen");
  if (versturen) {
    versturen.addEventListener("click", () => {
      const naarLezer = document.getElementById("oplezer");
      if (!String(tekst.value || "").trim()) {
        meld("Schrijf eerst wat jullie gedaan hebben en waarom. Zonder dat zijn het alleen cijfers.");
        tekst.focus();
        return;
      }
      // Eén knop, twee bestemmingen: de nalezer als er een gekozen is, anders
      // de leden. Wat het wordt staat op de knop.
      if (naarLezer && naarLezer.value) {
        doe(async () => {
          await bewaarEerst();
          await vraagNalezen(p.id, naarLezer.value);
        });
        return;
      }
      // Verstuurd is klaar: het bericht is weg, er valt hier niets meer te doen.
      // Dan hoor je terug te staan waar het werk is — in Dispatch — en niet op
      // een scherm met een grijs tekstvak dat je zelf moet verlaten.
      doe(async () => {
        await bewaarEerst();
        await verstuurBericht(p.id);
      }, async () => { location.hash = "/werkbank"; });
    });
  }

  // Kies je een nalezer, dan gaat het bericht daar eerst heen. Dan hoort de knop
  // dat te zeggen — en niet 'versturen naar de leden', want dat gebeurt er niet.
  const lezer = document.getElementById("oplezer");
  function kijkNalezer() {
    if (!versturen || !lezer) return;
    versturen.textContent = lezer.value ? "Concept laten nalezen" : "Versturen naar de leden";
  }
  if (lezer) {
    lezer.addEventListener("change", kijkNalezer);
    kijkNalezer();
  }

  const vrij = document.getElementById("opvrij");
  if (vrij) vrij.addEventListener("click", () => doe(() => geefVrij(p.id)));

  const terug = document.getElementById("opterug");
  if (terug) {
    terug.addEventListener("click", () => {
      const acties = document.querySelector(".opacties");
      if (document.getElementById("opredenvak")) return;
      const el = document.createElement("div");
      el.id = "opredenvak";
      el.className = "opredenvak";
      el.innerHTML = `
        <label for="opreden">Wat moet eraan?</label>
        <textarea id="opreden" rows="2" placeholder="Eén regel is genoeg."></textarea>
        <div class="opredenknoppen">
          <button type="button" class="knop tweede" id="opredenaf">Terug</button>
          <button type="button" class="knop" id="opredenok">Terugsturen</button>
        </div>`;
      acties.appendChild(el);
      const veld = document.getElementById("opreden");
      veld.focus();
      document.getElementById("opredenaf").addEventListener("click", () => el.remove());
      document.getElementById("opredenok").addEventListener("click", () => {
        const w = veld.value.trim();
        if (!w) { veld.focus(); return; }
        doe(() => stuurTerug(p.id, w));
      });
    });
  }
}
