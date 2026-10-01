// ============================================================================
// Het recordscherm — één component voor élk record in de applicatie.
//
// Bovenaan het formulier met de velden in secties, daaronder de gerelateerde
// lijsten (BOUWSPEC 10.0). Of die als tabbladen of onder elkaar staan, zegt
// de tabel zelf: db_table.related_weergave.
//
// Opslaan draagt de revisie mee. Heeft iemand anders intussen opgeslagen, dan
// krijg je dat te zien in plaats van zijn werk te overschrijven.
// ============================================================================

import { record as haalRecord, bewaar, maakAan, nieuwSjabloon } from "./api.js";
import { lijstscherm } from "./lijst.js";
import { lees, invoer, ontsnap } from "./veld.js";
import { volgLive } from "./live.js";

export async function recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties = {}) {
  let data;
  try {
    data = id === "nieuw"
      ? await nieuwSjabloon(tabelnaam, opties.ouder)
      : await haalRecord(tabelnaam, id);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  const isNieuw = data.nieuw === true;
  const titel = isNieuw
    ? `Nieuwe ${data.tabel.label.toLowerCase()}`
    : String(data.waarden[data.tabel.titel_veld] ?? `${data.tabel.label} ${id}`);

  document.title = `${titel} · Delta Blueprint Cockpit`;
  kruimel.innerHTML =
    `<a href="#/t/${tabelnaam}">${ontsnap(data.tabel.label_mv)}</a>
     <span class="pijlje">&rsaquo;</span> <span>${ontsnap(titel)}</span>`;

  // De velden per sectie, in de volgorde van de definitielaag.
  const zichtbaar = data.velden.filter((v) => v.sectie !== "systeem" || !isNieuw);
  const secties = data.secties.length
    ? data.secties
    : [{ naam: "algemeen", label: data.tabel.label }];

  const sectieHtml = secties.map((sectie) => {
    const velden = zichtbaar.filter((v) => (v.sectie || "algemeen") === sectie.naam);
    if (!velden.length) return "";
    return `
      <div class="sectie">
        <div class="sectiekop">${ontsnap(sectie.label)}</div>
        <div class="velden">
          ${velden.map((v) => `
            <label class="veldlabel" for="veld-${v.kolom}">${ontsnap(v.label)}${v.verplicht ? ' <span class="ster">*</span>' : ""}</label>
            <div class="veldwaarde" data-veld="${v.kolom}">
              ${v.alleen_lezen
                ? `<span class="alleenlezen">${lees(v, data.waarden[v.kolom], meta, data.verwijzingen)}</span>`
                : invoer(v, data.waarden[v.kolom], meta)}
            </div>`).join("")}
        </div>
      </div>`;
  }).join("");

  // Gerelateerde lijsten.
  const relaties = data.relaties || [];
  const tabbladen = data.tabel.related_weergave !== "onder_elkaar";
  const actiefTab = opties.tab && relaties.some((r) => r.tabel === opties.tab)
    ? opties.tab
    : relaties.length ? relaties[0].tabel : null;

  const relatieHtml = !relaties.length ? "" : tabbladen
    ? `<div class="tabbalk">
         ${relaties.map((r) => `
           <a href="#/t/${tabelnaam}/${id}?tab=${r.tabel}" class="tab ${r.tabel === actiefTab ? "actief" : ""}">
             ${ontsnap(r.label)}<span class="tabtelling">${r.aantal}</span>
           </a>`).join("")}
       </div>
       <div id="relatie-${actiefTab}" class="relatieinhoud"></div>`
    : relaties.map((r) => `<div id="relatie-${r.tabel}" class="relatieinhoud los"></div>`).join("");

  inhoud.innerHTML = `
    <div class="titelrij">
      <h1>${ontsnap(titel)}</h1>
      <span class="badge" style="color:var(--ink2);background:var(--head)">${ontsnap(data.tabel.label.toUpperCase())}</span>
      <span class="sub" id="opslagmelding"></span>
      <span class="knoppen">
        <button class="knop tweede" id="terug">Terug naar de lijst</button>
        <button class="knop" id="opslaan">${isNieuw ? "Aanmaken" : "Opslaan"}</button>
      </span>
    </div>
    <div class="formulier">${sectieHtml}</div>
    ${relatieHtml}`;

  // ---- gerelateerde lijsten vullen met dezelfde lijstcomponent ----
  const teTonen = tabbladen ? relaties.filter((r) => r.tabel === actiefTab) : relaties;
  for (const r of teTonen) {
    const vak = inhoud.querySelector(`#relatie-${r.tabel}`);
    if (!vak) continue;
    lijstscherm(vak, { textContent: "" }, r.tabel, meta, {
      q: "", sorteer: null, richting: "asc", offset: 0,
      filters: { [r.kolom]: String(id) },
      ingebed: { ouder: { tabel: tabelnaam, id }, kolom: r.kolom, label: r.label },
    });
  }

  // Een lopende cyclus ververst snel, de rest traag (BOUWSPEC 10.2).
  if (!isNieuw) {
    const loopt = ["go-nogo", "uitvoering ophalen", "in positie"].includes(data.waarden.status);
    volgLive(() => recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties), loopt);
  }

  // ---- opslaan ----
  const melding = inhoud.querySelector("#opslagmelding");
  const knop = inhoud.querySelector("#opslaan");

  inhoud.querySelector("#terug").addEventListener("click", () => {
    location.hash = `/t/${tabelnaam}`;
  });

  function verzamel() {
    const velden = {};
    inhoud.querySelectorAll(".veldwaarde [data-kolom]").forEach((el) => {
      velden[el.dataset.kolom] = el.value === "" ? null : el.value;
    });
    return velden;
  }

  knop.addEventListener("click", async () => {
    knop.disabled = true;
    melding.textContent = "Bezig met opslaan…";
    melding.className = "sub";
    try {
      if (isNieuw) {
        const gemaakt = await maakAan(tabelnaam, { ...verzamel(), ...(data.ouderkolom ? { [data.ouderkolom]: data.waarden[data.ouderkolom] } : {}) });
        location.hash = `/t/${tabelnaam}/${gemaakt.id}`;
      } else {
        const uitkomst = await bewaar(tabelnaam, id, verzamel(), data.waarden.revisie);
        data.waarden.revisie = uitkomst.revisie ?? data.waarden.revisie;
        melding.textContent = uitkomst.ongewijzigd ? "Niets gewijzigd" : "Opgeslagen";
        if (uitkomst.waarschuwingen && uitkomst.waarschuwingen.length) {
          melding.textContent = `Opgeslagen — ${uitkomst.waarschuwingen[0].melding}`;
          melding.className = "sub waarschuwing";
        }
        setTimeout(() => { melding.textContent = ""; melding.className = "sub"; }, 4000);
      }
    } catch (fout) {
      melding.textContent = fout.message;
      melding.className = "sub fouttekst";
    } finally {
      knop.disabled = false;
    }
  });
}
