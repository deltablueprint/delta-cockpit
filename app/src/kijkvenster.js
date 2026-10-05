// Even kijken naar een record waar een veld naar verwijst, zonder weg te gaan.
//
// Een verwijzing die je alleen kunt volgen door het scherm te verlaten, kost
// je je plek: je was iets aan het invullen en staat ineens ergens anders. Het
// kijkvenster laat het record zien zoals het is — alle velden, alleen lezen —
// met één knop om het alsnog echt te openen als je er wél heen wilt.
//
// Het toont en wijzigt niets. Alles staat uitgeschakeld, net als elk veld dat
// vastligt op een gewoon formulier.

import { record } from "./api.js";
import { ontsnap, vastVeld } from "./veld.js";

let open = null;

export function sluitKijkvenster() {
  if (!open) return;
  open.laag.remove();
  document.removeEventListener("keydown", open.opToets);
  open = null;
}

export async function kijkvenster(knop, tabelnaam, id, meta) {
  // Twee keer op dezelfde knop klikken sluit het weer; dat is wat je verwacht.
  if (open && open.knop === knop) { sluitKijkvenster(); return; }
  sluitKijkvenster();

  const laag = document.createElement("div");
  laag.className = "kijklaag";
  laag.innerHTML = `<div class="kijkkaart" role="dialog" aria-label="Record bekijken">
    <div class="kijkkop"><span class="kijktitel">Bezig met ophalen&hellip;</span></div>
  </div>`;
  document.body.appendChild(laag);

  const opToets = (e) => { if (e.key === "Escape") sluitKijkvenster(); };
  document.addEventListener("keydown", opToets);
  laag.addEventListener("click", (e) => { if (e.target === laag) sluitKijkvenster(); });
  open = { laag, knop, opToets };

  // De kaart hangt onder de knop, en klapt naar boven of naar links zodra ze
  // anders buiten beeld zou vallen.
  const kaart = laag.querySelector(".kijkkaart");
  const plaats = () => {
    const r = knop.getBoundingClientRect();
    const b = kaart.getBoundingClientRect();
    const links = Math.min(Math.max(8, r.left - b.width + r.width), innerWidth - b.width - 8);
    const onder = r.bottom + 8;
    kaart.style.left = `${links}px`;
    kaart.style.top = onder + b.height > innerHeight - 8
      ? `${Math.max(8, r.top - b.height - 8)}px`
      : `${onder}px`;
  };
  plaats();

  let data;
  try {
    data = await record(tabelnaam, id);
  } catch (fout) {
    kaart.innerHTML = `<div class="kijkkop"><span class="kijktitel">Niet op te halen</span></div>
      <p class="kijkfout">${ontsnap(fout.message)}</p>`;
    plaats();
    return;
  }
  if (!open || open.knop !== knop) return;   // ondertussen gesloten

  const velden = (data.velden || []).filter((v) => v.toon_op_formulier !== 0);
  const titel = data.waarden[data.tabel.titel_veld] || `${data.tabel.label} ${id}`;

  kaart.innerHTML = `
    <div class="kijkkop">
      <span class="kijksoort">${ontsnap(data.tabel.label)}</span>
      <span class="kijktitel">${ontsnap(String(titel))}</span>
      <a class="knop tweede" href="#/t/${ontsnap(tabelnaam)}/${ontsnap(String(id))}">Record openen</a>
      <button class="kijkdicht" type="button" aria-label="Sluiten">&times;</button>
    </div>
    <div class="kijkvelden">
      ${velden.map((v) => `
        <label class="veldlabel">${ontsnap(v.label)}</label>
        <div class="veldwaarde">${vastVeld(v, data.waarden[v.kolom], meta, data.verwijzingen, data.waarden)}</div>
      `).join("")}
    </div>`;
  kaart.querySelector(".kijkdicht").addEventListener("click", sluitKijkvenster);
  kaart.querySelector("a.knop").addEventListener("click", sluitKijkvenster);
  plaats();
}
