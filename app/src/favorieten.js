// Favorieten inrichten: naam, kleur en icoon.
//
// Links de favorieten in hun volgorde, rechts de gekozen favoriet. De kleur en
// het icoon zijn er om uit elkaar te houden, niet om te versieren: je herkent
// een favoriet aan zijn vorm voor je zijn naam leest.

import { ontsnap } from "./veld.js";
import { ikoon, IKOONNAMEN, KLEUREN, KLEURNAMEN } from "./ikonen.js";
import { haalFavorieten, wijzigFavoriet, weghaalFavoriet, zetFavorietenVolgorde } from "./api.js";

export async function favorietenscherm(inhoud, kruimel, bijWijziging) {
  kruimel.innerHTML = `<span>Favorieten inrichten</span>`;
  document.title = "Favorieten · Delta Blueprint Cockpit";
  inhoud.innerHTML = `<div class="kaart leeg">Bezig met ophalen&hellip;</div>`;

  let lijst = [];
  try {
    lijst = (await haalFavorieten()).favorieten;
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  let gekozen = lijst.length ? lijst[0].id : null;

  const melden = () => { if (typeof bijWijziging === "function") bijWijziging(); };

  const lijstHtml = () => lijst.map((f, i) => `
    <li class="favregel ${f.id === gekozen ? "actief" : ""}" data-id="${f.id}">
      <span class="favikoon" style="color:${KLEUREN[f.kleur] || KLEUREN.blauw}">${ikoon(f.icoon, 18)}</span>
      <span class="favnaam">${ontsnap(f.label)}</span>
      <span class="favorde">
        <button class="ikoonknop" data-op="omhoog" data-id="${f.id}" ${i === 0 ? "disabled" : ""}
          title="Naar boven" aria-label="Naar boven">&#8593;</button>
        <button class="ikoonknop" data-op="omlaag" data-id="${f.id}" ${i === lijst.length - 1 ? "disabled" : ""}
          title="Naar beneden" aria-label="Naar beneden">&#8595;</button>
      </span>
    </li>`).join("");

  const vormHtml = () => {
    const f = lijst.find((x) => x.id === gekozen);
    if (!f) {
      return `<p class="paneelleeg">Nog geen favorieten. Je maakt er een door op een lijst of een record
        te staan en in het tabblad Favorieten op het plusje te klikken: de favoriet bewaart dan ook het
        filter en de sortering waar je op dat moment naar kijkt.</p>`;
    }
    return `
      <div class="formsectie">
        <div class="formkolommen een">
          <div class="formkolom">
            <label class="veldlabel" for="fav_naam">Naam</label>
            <div class="veldwaarde"><input id="fav_naam" type="text" value="${ontsnap(f.label)}"></div>
            <label class="veldlabel" for="fav_route">Gaat naar</label>
            <div class="veldwaarde"><input id="fav_route" type="text" value="${ontsnap(f.route)}"></div>
            <span class="veldlabel">Kleur</span>
            <div class="veldwaarde"><span class="kleurkiezer">${KLEURNAMEN.map((k) => `
              <button type="button" class="kleurvak ${k === f.kleur ? "actief" : ""}" data-kleur="${k}"
                style="background:${KLEUREN[k]}" title="${k}" aria-label="${k}"></button>`).join("")}</span></div>
            <span class="veldlabel">Icoon</span>
            <div class="veldwaarde"><span class="ikoonkiezer" style="color:${KLEUREN[f.kleur] || KLEUREN.blauw}">${
              IKOONNAMEN.map((n) => `
              <button type="button" class="ikoonvak ${n === f.icoon ? "actief" : ""}" data-icoon="${n}"
                title="${n}" aria-label="${n}">${ikoon(n, 24)}</button>`).join("")}</span></div>
          </div>
        </div>
        <div class="knoprij">
          <button class="knop" id="favopslaan">Opslaan</button>
          <button class="knop tweede" id="favweg">Verwijderen</button>
          <span class="paneelmeta" id="favmelding"></span>
        </div>
      </div>`;
  };

  const teken = () => {
    inhoud.innerHTML = `
      <div class="recordbalk"><span class="recordnaam">Favorieten inrichten</span></div>
      <div class="favscherm">
        <div class="paneel">
          <div class="paneelkop">Jouw favorieten<span class="paneelmeta">de volgorde hier is de volgorde in het menu</span></div>
          <ul class="favlijstbewerk">${lijstHtml()}</ul>
        </div>
        <div class="paneel">
          <div class="paneelkop">Deze favoriet</div>
          ${vormHtml()}
        </div>
      </div>`;
    aansluiten();
  };

  function aansluiten() {
    inhoud.querySelectorAll(".favregel").forEach((li) => {
      li.addEventListener("click", (e) => {
        if (e.target.closest("[data-op]")) return;
        gekozen = Number(li.dataset.id);
        teken();
      });
    });

    inhoud.querySelectorAll("[data-op]").forEach((knop) => {
      knop.addEventListener("click", async () => {
        const id = Number(knop.dataset.id);
        const i = lijst.findIndex((f) => f.id === id);
        const naar = knop.dataset.op === "omhoog" ? i - 1 : i + 1;
        if (naar < 0 || naar >= lijst.length) return;
        [lijst[i], lijst[naar]] = [lijst[naar], lijst[i]];
        teken();
        try { await zetFavorietenVolgorde(lijst.map((f) => f.id)); melden(); } catch { /* stil */ }
      });
    });

    const kleurknoppen = inhoud.querySelectorAll("[data-kleur]");
    kleurknoppen.forEach((k) => k.addEventListener("click", () => {
      const f = lijst.find((x) => x.id === gekozen);
      if (!f) return;
      f.kleur = k.dataset.kleur;
      teken();
    }));

    inhoud.querySelectorAll("[data-icoon]").forEach((k) => k.addEventListener("click", () => {
      const f = lijst.find((x) => x.id === gekozen);
      if (!f) return;
      f.icoon = k.dataset.icoon;
      teken();
    }));

    const melding = inhoud.querySelector("#favmelding");
    const opslaan = inhoud.querySelector("#favopslaan");
    if (opslaan) {
      opslaan.addEventListener("click", async () => {
        const f = lijst.find((x) => x.id === gekozen);
        if (!f) return;
        f.label = inhoud.querySelector("#fav_naam").value.trim() || f.label;
        f.route = inhoud.querySelector("#fav_route").value.trim() || f.route;
        opslaan.disabled = true;
        try {
          await wijzigFavoriet(f.id, { label: f.label, route: f.route, kleur: f.kleur, icoon: f.icoon });
          melden();
          melding.textContent = "Bewaard.";
        } catch (fout) {
          melding.textContent = fout.message;
        }
        opslaan.disabled = false;
      });
    }

    const weg = inhoud.querySelector("#favweg");
    if (weg) {
      weg.addEventListener("click", async () => {
        const f = lijst.find((x) => x.id === gekozen);
        if (!f) return;
        weg.disabled = true;
        try {
          await weghaalFavoriet(f.id);
          lijst = lijst.filter((x) => x.id !== f.id);
          gekozen = lijst.length ? lijst[0].id : null;
          melden();
          teken();
        } catch (fout) {
          weg.disabled = false;
          melding.textContent = fout.message;
        }
      });
    }
  }

  teken();
}
