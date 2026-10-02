// De twee tabbladen naast het menu: favorieten en geschiedenis.
//
// Het menu toont wat er is; deze twee tonen waar jij bent. Een favoriet draagt
// de hele route — dus ook het filter en de sortering — en de geschiedenis is
// een werkspoor: waar was ik ook alweer. Allebei strikt persoonlijk.

import { ontsnap } from "./veld.js";
import { ikoon, KLEUREN } from "./ikonen.js";
import { haalFavorieten, maakFavoriet, haalBezoeken, wisBezoeken } from "./api.js";

export const ICOON = {
  menu: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  ster: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>`,
  klok: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round"><path d="M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4.5l3 1.8"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  potlood: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>`,
};

// 'net' · '12 min' · '3 uur' · '2 dagen'. Preciezer heeft niemand nodig om
// terug te vinden waar hij was.
function geleden(stempel) {
  const t = Date.parse(String(stempel).replace(" ", "T") + "Z");
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "net";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} uur`;
  return `${Math.round(s / 86400)} d`;
}

export function navtabsHtml() {
  return `
    <div class="navtabs" role="tablist">
      <button class="navtab actief" data-tab="alles" title="Alle modules" aria-label="Alle modules">${ICOON.menu}</button>
      <button class="navtab" data-tab="favoriet" title="Favorieten" aria-label="Favorieten">${ICOON.ster}</button>
      <button class="navtab" data-tab="geschiedenis" title="Geschiedenis" aria-label="Geschiedenis">${ICOON.klok}</button>
    </div>`;
}

export function navpanelenHtml() {
  return `
    <div class="navpaneel" data-paneel="favoriet" hidden>
      <div class="navkop">
        <span>Favorieten</span>
        <button class="navknopje" id="favtoevoegen" title="Deze pagina toevoegen"
          aria-label="Deze pagina toevoegen">${ICOON.plus}</button>
        <a class="navknopje" href="#/favorieten" title="Favorieten inrichten"
          aria-label="Favorieten inrichten">${ICOON.potlood}</a>
      </div>
      <div class="navlijst" id="favlijst"></div>
    </div>
    <div class="navpaneel" data-paneel="geschiedenis" hidden>
      <div class="navkop">
        <span>Geschiedenis</span>
        <button class="navknopje" id="geschiedenisleeg" title="Geschiedenis leegmaken">wissen</button>
      </div>
      <div class="navlijst" id="geschiedenislijst"></div>
    </div>`;
}

// Hoe een favoriet nu heet als je hem vanaf deze pagina maakt: de titel van het
// scherm, zonder de applicatienaam erachter.
function voorstelNaam() {
  return (document.title || "Favoriet").split(" · ")[0].slice(0, 80);
}

export function navtabsAansluiten(wortel) {
  const tabs = [...wortel.querySelectorAll(".navtab")];
  const panelen = [...wortel.querySelectorAll(".navpaneel")];
  const menulijst = wortel.querySelector("#menulijst");
  const menufilter = wortel.querySelector(".menufilter");
  const menuleeg = wortel.querySelector("#menuleeg");
  const favlijst = wortel.querySelector("#favlijst");
  const geschiedenislijst = wortel.querySelector("#geschiedenislijst");

  const tekenFavorieten = async () => {
    try {
      const { favorieten } = await haalFavorieten();
      favlijst.innerHTML = favorieten.length
        ? favorieten.map((f) => `
            <a href="#${ontsnap(f.route)}" class="navregel" data-route="${ontsnap(f.route)}">
              <span class="navikoon" style="color:${KLEUREN[f.kleur] || KLEUREN.blauw}">${ikoon(f.icoon, 15)}</span>
              <span class="navtekst">${ontsnap(f.label)}</span>
            </a>`).join("")
        : `<p class="navleeg">Nog geen favorieten. Sta je op een lijst of een record die je vaker nodig hebt,
             klik dan op het plusje hierboven.</p>`;
    } catch {
      favlijst.innerHTML = `<p class="navleeg">De favorieten zijn niet op te halen.</p>`;
    }
  };

  const tekenGeschiedenis = async () => {
    try {
      const { bezoeken } = await haalBezoeken();
      geschiedenislijst.innerHTML = bezoeken.length
        ? bezoeken.map((b) => `
            <a href="#${ontsnap(b.route)}" class="navregel">
              <span class="navtekst">${ontsnap(b.titel)}${
                b.soort ? `<i class="navsoort">${ontsnap(b.soort)}</i>` : ""}</span>
              <span class="navtijd">${ontsnap(geleden(b.moment))}</span>
            </a>`).join("")
        : `<p class="navleeg">Nog niets bezocht.</p>`;
    } catch {
      geschiedenislijst.innerHTML = `<p class="navleeg">De geschiedenis is niet op te halen.</p>`;
    }
  };

  const kies = (naam) => {
    tabs.forEach((t) => t.classList.toggle("actief", t.dataset.tab === naam));
    panelen.forEach((p) => { p.hidden = p.dataset.paneel !== naam; });
    const alles = naam === "alles";
    if (menulijst) menulijst.hidden = !alles;
    if (menufilter) menufilter.hidden = !alles;
    if (menuleeg && !alles) menuleeg.hidden = true;
    if (naam === "favoriet") tekenFavorieten();
    if (naam === "geschiedenis") tekenGeschiedenis();
  };

  tabs.forEach((t) => t.addEventListener("click", () => kies(t.dataset.tab)));

  // Deze pagina bewaren. De route komt uit de adresbalk, dus het filter en de
  // sortering waar je nu naar kijkt gaan mee.
  const plus = wortel.querySelector("#favtoevoegen");
  if (plus) {
    plus.addEventListener("click", async () => {
      plus.disabled = true;
      try {
        await maakFavoriet({ route: location.hash.slice(1) || "/dashboard", label: voorstelNaam() });
        await tekenFavorieten();
      } catch { /* stil: een favoriet die niet lukt mag het scherm niet breken */ }
      plus.disabled = false;
    });
  }

  const wissen = wortel.querySelector("#geschiedenisleeg");
  if (wissen) {
    wissen.addEventListener("click", async () => {
      try { await wisBezoeken(); await tekenGeschiedenis(); } catch { /* idem */ }
    });
  }

  return { tekenFavorieten, tekenGeschiedenis };
}
