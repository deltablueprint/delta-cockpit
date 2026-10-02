// De tweekolommenkiezer: links wat er niet bij hoort, rechts wat wel.
//
// Hij staat op het besluit (wie er aanwezig was) en bij het overnemen van
// voorwaarden. Eén vorm voor hetzelfde gebaar — kiezen uit een lijst — zodat
// je hem maar één keer hoeft te leren.

import { ontsnap } from "./veld.js";

export function kiezerHtml({ id, linkskop, rechtskop, links, rechts }) {
  const regel = (r) => `<li data-id="${ontsnap(r.id)}">${r.html || ontsnap(r.naam)}</li>`;
  return `
    <div class="kolomkiezer" id="${id}">
      <div class="kiezerkolom">
        <div class="kiezerkop">${ontsnap(linkskop)}</div>
        <ul class="kiezerlijst" data-kant="links">${links.map(regel).join("")}</ul>
      </div>
      <div class="kiezerknoppen">
        <button type="button" class="ikoonknop" data-naar="rechts" title="Naar rechts">&rsaquo;</button>
        <button type="button" class="ikoonknop" data-naar="links" title="Naar links">&lsaquo;</button>
      </div>
      <div class="kiezerkolom">
        <div class="kiezerkop">${ontsnap(rechtskop)}</div>
        <ul class="kiezerlijst" data-kant="rechts">${rechts.map(regel).join("")}</ul>
      </div>
    </div>`;
}

// Sluit het gedrag aan en geeft een functie terug die zegt wat er rechts staat.
export function kiezerAansluiten(wortel, bijVerandering) {
  const links = wortel.querySelector('[data-kant="links"]');
  const rechts = wortel.querySelector('[data-kant="rechts"]');

  const gekozen = () => [...rechts.querySelectorAll("li")].map((li) => li.dataset.id);
  const melden = () => { if (bijVerandering) bijVerandering(gekozen()); };

  const verhuis = (van, naar) => {
    van.querySelectorAll("li.gekozen").forEach((li) => {
      li.classList.remove("gekozen");
      naar.appendChild(li);
    });
    melden();
  };

  [links, rechts].forEach((lijst) => {
    lijst.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (li) li.classList.toggle("gekozen");
    });
    lijst.addEventListener("dblclick", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      li.classList.remove("gekozen");
      (lijst === links ? rechts : links).appendChild(li);
      melden();
    });
  });

  wortel.querySelector('[data-naar="rechts"]').addEventListener("click", () => verhuis(links, rechts));
  wortel.querySelector('[data-naar="links"]').addEventListener("click", () => verhuis(rechts, links));

  return gekozen;
}
