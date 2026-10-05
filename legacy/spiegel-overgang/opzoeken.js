// Een record opzoeken voor een verwijzing.
//
// Een keuzelijst werkt bij vijf vaste waarden, niet bij records: je ziet er
// maar één tegelijk, je kunt er niet in zoeken, en wat er in staat zegt niets
// over waaruit je kiest. Dit venster toont de records met een zoekregel erboven
// en de huidige keuze gemarkeerd.

import { ontsnap } from "./veld.js";

let open = null;

export function sluitOpzoeken() {
  if (!open) return;
  open.laag.remove();
  document.removeEventListener("keydown", open.opToets);
  open = null;
}

// `opties` zijn de records waaruit gekozen mag worden — dezelfde die de worker
// meestuurt. `kies` krijgt het gekozen record, of null als je het leegmaakt.
export function opzoeken(knop, opties, huidige, kies, titel = "Opzoeken") {
  if (open && open.knop === knop) { sluitOpzoeken(); return; }
  sluitOpzoeken();

  const laag = document.createElement("div");
  laag.className = "kijklaag";
  laag.innerHTML = `
    <div class="zoekkaart" role="dialog" aria-label="${ontsnap(titel)}">
      <div class="kijkkop">
        <span class="kijktitel">${ontsnap(titel)}</span>
        <button class="kijkdicht" type="button" aria-label="Sluiten">&times;</button>
      </div>
      <div class="zoekregelvak"><input type="text" class="opzoekveld" placeholder="Zoeken" autofocus></div>
      <ul class="zoeklijst">
        <li data-id="" class="${huidige ? "" : "gekozen"}"><span class="faint">niets gekozen</span></li>
        ${opties.map((k) => `
          <li data-id="${ontsnap(k.id)}" class="${String(k.id) === String(huidige) ? "gekozen" : ""}">
            ${ontsnap(k.titel)}</li>`).join("")}
      </ul>
    </div>`;
  document.body.appendChild(laag);

  const kaart = laag.querySelector(".zoekkaart");
  const r = knop.getBoundingClientRect();
  const b = kaart.getBoundingClientRect();
  kaart.style.left = `${Math.min(Math.max(8, r.left - b.width + r.width), innerWidth - b.width - 8)}px`;
  kaart.style.top = r.bottom + b.height > innerHeight - 8
    ? `${Math.max(8, r.top - b.height - 8)}px`
    : `${r.bottom + 6}px`;

  const opToets = (e) => { if (e.key === "Escape") sluitOpzoeken(); };
  document.addEventListener("keydown", opToets);
  laag.addEventListener("click", (e) => { if (e.target === laag) sluitOpzoeken(); });
  open = { laag, knop, opToets };

  const zoek = kaart.querySelector(".opzoekveld");
  zoek.addEventListener("input", () => {
    const w = zoek.value.trim().toLowerCase();
    kaart.querySelectorAll(".zoeklijst li[data-id]").forEach((li) => {
      if (!li.dataset.id) return;
      li.hidden = w !== "" && !li.textContent.toLowerCase().includes(w);
    });
  });
  zoek.focus();

  kaart.querySelector(".kijkdicht").addEventListener("click", sluitOpzoeken);
  kaart.querySelectorAll(".zoeklijst li").forEach((li) => {
    li.addEventListener("click", () => {
      const id = li.dataset.id;
      kies(id ? opties.find((k) => String(k.id) === String(id)) || null : null);
      sluitOpzoeken();
    });
  });
}
