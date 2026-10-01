// ============================================================================
// Het recordscherm — één vorm voor élk record in de applicatie.
//
//   · een balk met de naam van het record, een bijlageknop en de acties
//   · daaronder, als de tabel een procesveld heeft, een chevronbalk:
//     lichtblauw is gedaan, donkerblauw is waar je nu staat, grijs komt nog
//   · dan het formulier: twee kolommen labels en velden, geen kaarten
//   · onderaan de gerelateerde lijsten
// ============================================================================

import { record as haalRecord, bewaar, maakAan, nieuwSjabloon } from "./api.js";
import { lijstscherm } from "./lijst.js";
import { lees, invoer, ontsnap } from "./veld.js";
import { volgLive } from "./live.js";

const ICOON = {
  bijlage: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 6"/></svg>`,
  vink: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`,
};

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

  // ---- breadcrumb: de hele ouderketen, zoals het bouwplan voorschrijft ----
  const kruimels = [];
  if (data.ouder) {
    kruimels.push(`<a href="#/t/${data.ouder.tabel}">${ontsnap(data.ouder.label_mv)}</a>`);
    kruimels.push(`<a href="#/t/${data.ouder.tabel}/${data.ouder.id}">${ontsnap(data.ouder.titel)}</a>`);
  }
  kruimels.push(`<a href="#/t/${tabelnaam}">${ontsnap(data.tabel.label_mv)}</a>`);
  kruimels.push(`<span>${ontsnap(titel)}</span>`);
  kruimel.innerHTML = kruimels.join(` <span class="pijlje">&rsaquo;</span> `);

  // ---- procesbalk ----
  let procesHtml = "";
  if (data.proces && data.proces.stappen.length) {
    const nu = data.proces.stappen.findIndex((s) => s.waarde === data.proces.nu);
    procesHtml = `<div class="chevrons">${data.proces.stappen.map((s, i) => {
      const stand = i < nu ? "gedaan" : i === nu ? "nu" : "straks";
      return `<span class="chevron ${stand}">${ontsnap(s.label)}${i < nu ? ICOON.vink : ""}</span>`;
    }).join("")}</div>`;
  }

  // ---- formulier: twee kolommen, velden om en om verdeeld ----
  const velden = data.velden.filter(
    (v) => v.toon_op_formulier !== 0 && (v.sectie !== "systeem" || !isNieuw)
  );
  const secties = data.secties.length ? data.secties : [{ naam: "algemeen", label: data.tabel.label }];

  const veldHtml = (v) => `
    <label class="veldlabel" for="veld-${v.kolom}">${v.verplicht ? '<span class="ster">*</span> ' : ""}${ontsnap(v.label)}</label>
    <div class="veldwaarde">${
      v.alleen_lezen
        ? `<span class="alleenlezen">${lees(v, data.waarden[v.kolom], meta, data.verwijzingen)}</span>`
        : invoer(v, data.waarden[v.kolom], meta)
    }</div>`;

  const sectieHtml = secties.map((sectie) => {
    const eigen = velden.filter((v) => (v.sectie || "algemeen") === sectie.naam);
    if (!eigen.length) return "";
    const breed = eigen.filter((v) => v.type === "lang");
    const smal = eigen.filter((v) => v.type !== "lang");
    const links = smal.filter((_, i) => i % 2 === 0);
    const rechts = smal.filter((_, i) => i % 2 === 1);
    return `
      <div class="formsectie">
        ${secties.length > 1 ? `<div class="formsectiekop">${ontsnap(sectie.label)}</div>` : ""}
        <div class="formkolommen">
          <div class="formkolom">${links.map(veldHtml).join("")}</div>
          <div class="formkolom">${rechts.map(veldHtml).join("")}</div>
        </div>
        ${breed.length ? `<div class="formbreed">${breed.map(veldHtml).join("")}</div>` : ""}
      </div>`;
  }).join("");

  // ---- gerelateerde lijsten ----
  const relaties = data.relaties || [];
  const tabbladen = data.tabel.related_weergave !== "onder_elkaar";
  const actiefTab = opties.tab && relaties.some((r) => r.tabel === opties.tab)
    ? opties.tab
    : relaties.length ? relaties[0].tabel : null;

  const relatieHtml = !relaties.length ? "" : tabbladen
    ? `<div class="tabbalk">
         ${relaties.map((r) => `
           <a href="#/t/${tabelnaam}/${id}?tab=${r.tabel}" class="tab ${r.tabel === actiefTab ? "actief" : ""}">
             ${ontsnap(r.label)}<span class="tabtelling">${r.aantal}</span></a>`).join("")}
       </div>
       <div id="relatie-${actiefTab}" class="relatieinhoud"></div>`
    : relaties.map((r) => `<div id="relatie-${r.tabel}" class="relatieinhoud los"></div>`).join("");

  const terugNaar = data.ouder
    ? { href: `#/t/${data.ouder.tabel}/${data.ouder.id}`, label: `Terug naar ${data.ouder.titel}` }
    : { href: `#/t/${tabelnaam}`, label: "Terug naar de lijst" };

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(titel)}</span>
      <span class="recordmelding" id="opslagmelding"></span>
      <span class="recordacties">
        <button class="ikoonknop" id="bijlage" title="Bijlage toevoegen" aria-label="Bijlage toevoegen">${ICOON.bijlage}</button>
        <a class="knop tweede" href="${terugNaar.href}">${ontsnap(terugNaar.label)}</a>
        <button class="knop" id="opslaan">${isNieuw ? "Aanmaken" : "Opslaan"}</button>
      </span>
    </div>
    ${procesHtml}
    <div class="formulier">${sectieHtml}</div>
    ${relatieHtml}`;

  // ---- gerelateerde lijsten vullen ----
  for (const r of (tabbladen ? relaties.filter((x) => x.tabel === actiefTab) : relaties)) {
    const vak = inhoud.querySelector(`#relatie-${r.tabel}`);
    if (!vak) continue;
    lijstscherm(vak, { textContent: "" }, r.tabel, meta, {
      q: "", sorteer: null, richting: "asc", offset: 0,
      filters: { [r.kolom]: String(id) },
      ingebed: { ouder: { tabel: tabelnaam, id }, kolom: r.kolom, label: r.label },
    });
  }

  // ---- opslaan ----
  const melding = inhoud.querySelector("#opslagmelding");
  const knop = inhoud.querySelector("#opslaan");

  inhoud.querySelector("#bijlage").addEventListener("click", () => {
    melding.textContent = "Bijlagen komen bij de chartanalyses (etappe 11).";
    melding.className = "recordmelding";
    setTimeout(() => { melding.textContent = ""; }, 3000);
  });

  function verzamel() {
    const v = {};
    inhoud.querySelectorAll(".veldwaarde [data-kolom]").forEach((el) => {
      v[el.dataset.kolom] = el.value === "" ? null : el.value;
    });
    return v;
  }

  knop.addEventListener("click", async () => {
    knop.disabled = true;
    melding.textContent = "Bezig met opslaan…";
    melding.className = "recordmelding";
    try {
      if (isNieuw) {
        const velden = verzamel();
        if (data.ouderkolom) velden[data.ouderkolom] = data.waarden[data.ouderkolom];
        const gemaakt = await maakAan(tabelnaam, velden, data.ouderkolom);
        location.hash = `/t/${tabelnaam}/${gemaakt.id}`;
      } else {
        const uitkomst = await bewaar(tabelnaam, id, verzamel(), data.waarden.revisie);
        data.waarden.revisie = uitkomst.revisie ?? data.waarden.revisie;
        melding.textContent = uitkomst.ongewijzigd ? "Niets gewijzigd" : "Opgeslagen";
        if (uitkomst.waarschuwingen && uitkomst.waarschuwingen.length) {
          melding.textContent = `Opgeslagen — ${uitkomst.waarschuwingen[0].melding}`;
          melding.className = "recordmelding waarschuwing";
        }
        // Verandert het procesveld, dan klopt de chevronbalk niet meer.
        if (data.proces && verzamel()[data.proces.veld] !== data.proces.nu) {
          recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties);
          return;
        }
        setTimeout(() => { melding.textContent = ""; melding.className = "recordmelding"; }, 4000);
      }
    } catch (fout) {
      melding.textContent = fout.message;
      melding.className = "recordmelding fouttekst";
    } finally {
      knop.disabled = false;
    }
  });

  if (!isNieuw) {
    const loopt = ["go-nogo", "uitvoering ophalen", "in positie"].includes(data.waarden.status);
    volgLive(() => recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties), loopt);
  }
}
