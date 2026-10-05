// Aankondigen wat je gaat doen, vóór je het bij Lynx doet.
//
// Tien seconden werk, op het moment dat je er nog tijd voor hebt. Daarna hoeft
// het systeem niet te raden wát er gebeurde: het legt wat binnenkomt naast wat
// je zei. Het plaatst zelf nooit een order — dit is een aantekening.

import { kondigAan } from "./api.js";
import { ontsnap } from "./veld.js";

let open = null;

export function sluitAankondigen() {
  if (!open) return;
  open.laag.remove();
  document.removeEventListener("keydown", open.opToets);
  open = null;
}

// `tranche` is het positierecord zoals het scherm het kent; `klaar` wordt
// geroepen met het antwoord van de server.
export function aankondigen(tranche, klaar) {
  sluitAankondigen();

  const laag = document.createElement("div");
  laag.className = "kijklaag midden";
  laag.innerHTML = `
    <div class="aankondigkaart" role="dialog" aria-label="Aankondigen">
      <div class="kijkkop">
        <span class="kijktitel">Wat ga je doen?</span>
        <button class="kijkdicht" type="button" aria-label="Sluiten">&times;</button>
      </div>
      <div class="aankondigvorm">
        <label class="veldlabel">Tranche</label>
        <div class="veldwaarde"><input type="text" disabled value="${
          ontsnap(tranche.contract || `${tranche.strike} / ${tranche.expiratiedatum}`)}"></div>

        <label class="veldlabel"><span class="ster">*</span> Wat</label>
        <div class="veldwaarde"><select id="a_soort">
          <option value="rol">Doorrollen</option>
          <option value="terugkopen">Vervroegd terugkopen</option>
        </select></div>

        <label class="veldlabel" data-rol><span class="ster">*</span> Nieuwe strike</label>
        <div class="veldwaarde" data-rol><input id="a_strike" type="number" step="25"
          value="${ontsnap(tranche.strike ?? "")}"></div>

        <label class="veldlabel" data-rol><span class="ster">*</span> Nieuwe expiratie</label>
        <div class="veldwaarde" data-rol><input id="a_expiratie" type="date"></div>

        <label class="veldlabel">Aantal</label>
        <div class="veldwaarde"><input id="a_aantal" type="number" step="1"
          value="${ontsnap(tranche.aantal ?? "")}"></div>

        <label class="veldlabel">Waarom</label>
        <div class="veldwaarde"><input id="a_reden" type="text" placeholder="optioneel"></div>

        <div class="aankondigknoppen">
          <span class="aankondigmelding"></span>
          <button class="knop tweede" type="button" id="a_annuleer">Annuleren</button>
          <button class="knop" type="button" id="a_bewaar">Aankondigen</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(laag);

  const opToets = (e) => { if (e.key === "Escape") sluitAankondigen(); };
  document.addEventListener("keydown", opToets);
  laag.addEventListener("click", (e) => { if (e.target === laag) sluitAankondigen(); });
  open = { laag, opToets };

  const kaart = laag.querySelector(".aankondigkaart");
  const soort = kaart.querySelector("#a_soort");
  const melding = kaart.querySelector(".aankondigmelding");
  const toon = () => kaart.querySelectorAll("[data-rol]").forEach((el) => {
    el.hidden = soort.value !== "rol";
  });
  soort.addEventListener("change", toon);
  toon();

  kaart.querySelector(".kijkdicht").addEventListener("click", sluitAankondigen);
  kaart.querySelector("#a_annuleer").addEventListener("click", sluitAankondigen);

  const knop = kaart.querySelector("#a_bewaar");
  knop.addEventListener("click", async () => {
    const lees = (id) => {
      const el = kaart.querySelector(id);
      return el && el.value !== "" ? el.value : null;
    };
    const body = {
      positie: tranche.id,
      soort: soort.value,
      nieuwe_strike: lees("#a_strike"),
      nieuwe_expiratiedatum: lees("#a_expiratie"),
      aantal: lees("#a_aantal"),
      reden: lees("#a_reden"),
    };
    if (body.soort === "rol" && (!body.nieuwe_strike || !body.nieuwe_expiratiedatum)) {
      melding.textContent = "Bij een rol hoort het nieuwe contract: strike en expiratie.";
      melding.className = "aankondigmelding fouttekst";
      return;
    }
    knop.disabled = true;
    melding.textContent = "Bezig…";
    melding.className = "aankondigmelding";
    try {
      const uit = await kondigAan(body);
      sluitAankondigen();
      klaar(uit);
    } catch (fout) {
      knop.disabled = false;
      melding.textContent = fout.message;
      melding.className = "aankondigmelding fouttekst";
    }
  });
  kaart.querySelector("#a_strike").focus();
}
