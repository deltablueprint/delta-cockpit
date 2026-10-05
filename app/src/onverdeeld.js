// Posities die bij geen cyclus horen.
//
// De broker weet wat er openstaat, maar niet waar het bij hoort. Loopt er één
// cyclus, dan zet de cockpit de positie daar vanzelf bij. Lopen er meerdere,
// dan blijft ze hier staan tot iemand kiest — gokken is hier erger dan niet
// weten.
//
// Dit is het enige wat een mens nog doet aan de brokerkant: zeggen waar een
// contract bij hoort, of dat het er niet bij hoort.

import { onverdeeldePosities, wijsPositieToe } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";

const punten = (n) =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(1).replace(".", ",")} pt` : "—";

export async function onverdeeldscherm(inhoud, kruimel) {
  kruimel.innerHTML = `<span>Werken</span> <span class="pijlje">&rsaquo;</span> <span>Posities zonder cyclus</span>`;
  document.title = "Posities zonder cyclus · Delta Blueprint Cockpit";
  inhoud.innerHTML = "";

  let data;
  try {
    data = await onverdeeldePosities();
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  if (!data.posities.length) {
    inhoud.innerHTML = `<div class="paneel">
      <div class="paneelkop">Posities zonder cyclus</div>
      <p class="paneelleeg">Alles wat bij Lynx openstaat hoort bij een cyclus. Er is niets te kiezen.</p>
    </div>`;
    return;
  }

  inhoud.innerHTML = `
    <div class="paneel">
      <div class="paneelkop">Posities zonder cyclus
        <span class="paneelmeta">${data.posities.length} ${
          data.posities.length === 1 ? "contract staat" : "contracten staan"} open bij Lynx
          zonder dat bekend is waar ze bij horen</span></div>
      <table class="lijsttabel">
        <colgroup><col><col style="width:90px"><col style="width:120px"><col style="width:80px">
                  <col style="width:110px"><col style="width:300px"><col style="width:150px"></colgroup>
        <thead><tr>
          <th>Contract</th><th class="rechts">Strike</th><th>Expiratie</th>
          <th class="rechts">Aantal</th><th class="rechts">Geschreven op</th>
          <th>Hoort bij</th><th></th>
        </tr></thead>
        <tbody>
          ${data.posities.map((p) => `
            <tr data-id="${p.id}">
              <td><b>${ontsnap(p.contract || "—")}</b></td>
              <td class="rechts">${ontsnap(String(p.strike ?? "—"))}</td>
              <td>${toonDatum(p.expiratiedatum)}</td>
              <td class="rechts">${p.aantal ?? "—"}</td>
              <td class="rechts">${punten(p.ontvangen_premie_pt)}</td>
              <td>
                <select data-veld="cyclus">
                  ${(data.cycli || []).map((c) => `<option value="${c.id}">${ontsnap(c.label)}</option>`).join("")}
                  <option value="buiten">&mdash; hoort bij geen cyclus &mdash;</option>
                </select>
              </td>
              <td>
                <button class="knop" data-toewijzen>Vastleggen</button>
                <span class="toewijsmelding"></span>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  for (const rij of inhoud.querySelectorAll("tbody tr")) {
    const id = Number(rij.dataset.id);
    const keuze = rij.querySelector('[data-veld="cyclus"]');
    const knop = rij.querySelector("[data-toewijzen]");
    const melding = rij.querySelector(".toewijsmelding");

    knop.addEventListener("click", async () => {
      knop.disabled = true;
      melding.textContent = "Bezig…";
      melding.className = "toewijsmelding";
      try {
        const buiten = keuze.value === "buiten";
        const uit = await wijsPositieToe(id, buiten ? { buiten: true } : { cyclus: Number(keuze.value) });
        rij.innerHTML = `<td colspan="7" class="toewijsklaar">${
          buiten
            ? "Buiten de cycli gezet."
            : `Vastgelegd. <a href="#/t/positie/${uit.positie}">Naar de positie</a>`}</td>`;
      } catch (fout) {
        knop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "toewijsmelding fouttekst";
      }
    });
  }
}
