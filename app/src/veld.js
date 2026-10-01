// De veldrenderer: één plek waar een veldtype bepaalt hoe het eruitziet en
// wat je ermee kunt. Elk nieuw type is hier één regel, niet een scherm.

import { avatarMetNaam } from "./avatar.js";
import { inBrussel } from "./tijdzone.js";

const MAANDEN = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

export const ontsnap = (t) =>
  String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function toonDatum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  return m ? `${Number(m[3])} ${MAANDEN[Number(m[2]) - 1]} ${m[1]}` : ontsnap(s);
}

export const KLEUR = {
  groen:  ["var(--grn)",  "var(--grnbg)"],
  oranje: ["var(--amb)",  "var(--ambbg)"],
  rood:   ["var(--red)",  "var(--redbg)"],
  blauw:  ["var(--blue)", "var(--bluebg)"],
  grijs:  ["var(--mut)",  "var(--head)"],
};

export function keuzesVoor(meta, veld) {
  return meta.keuzes[`${veld.tabel}.${veld.kolom}`] || [];
}

// Lezen: wat er op het scherm staat als je niet aan het bewerken bent.
export function lees(veld, waarde, meta, verwijzingen = {}, rij = {}) {
  if (waarde === null || waarde === undefined || waarde === "") {
    return `<span class="faint">&mdash;</span>`;
  }
  if (veld.type === "tijd") {
    const om = inBrussel(rij.datum, waarde, rij.tijdzone || "Europe/Brussels");
    if (!om) return ontsnap(waarde);
    const tip = om.zelfde ? "" : ` title="${ontsnap(waarde)} in ${ontsnap(rij.tijdzone)}"`;
    return `<span${tip}>${om.tijd} <span class="zonetekst">${om.afkorting}</span>${
      om.zelfde ? "" : `<span class="zoneherkomst">${ontsnap(waarde)} lokaal</span>`}</span>`;
  }

  switch (veld.type) {
    case "keuze": {
      const k = keuzesVoor(meta, veld).find((x) => x.waarde === waarde);
      const [fg, bg] = KLEUR[k ? k.kleur : "grijs"] || KLEUR.grijs;
      return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(k ? k.label : waarde)}</span>`;
    }
    case "verwijzing": {
      if (veld.verwijst_naar === "gebruiker" && meta.gebruikers && meta.gebruikers[waarde]) {
        return avatarMetNaam(meta.gebruikers[waarde]);
      }
      return ontsnap(verwijzingen[veld.kolom] ?? waarde);
    }
    case "datum":
      return toonDatum(waarde);
    case "tijdstip":
      return `${toonDatum(waarde)} ${String(waarde).slice(11, 16)}`;
    case "ja_nee":
      return Number(waarde) ? "ja" : "nee";
    default:
      if (veld.kolom.endsWith("_pt")) {
        const n = Number(waarde);
        const kleur = n > 0 ? "var(--grn)" : n < 0 ? "var(--red)" : "var(--ink2)";
        return `<span style="color:${kleur};font-weight:600">${n > 0 ? "+" : n < 0 ? "−" : ""} ${Math.abs(n).toFixed(1).replace(".", ",")} pt</span>`;
      }
      return ontsnap(waarde);
  }
}

// Bewerken: het invoerelement voor dit veldtype.
export function invoer(veld, waarde, meta, extra = "", naam = null, keuzelijst = null) {
  const w = waarde ?? "";
  const id = `veld-${veld.kolom}`;

  // Een verwijzing is een record, geen getal. Naar een persoon kies je uit de
  // deelnemers; naar iets anders is er in fase 1 nog geen kiezer, en dan toont
  // het formulier de naam in plaats van het nummer. Zo'n veld stuurt niets
  // mee bij het opslaan: het verandert niet per ongeluk.
  if (veld.type === "verwijzing") {
    // Een keuzelijst uit de definitielaag (db_field.keuzelijst): de worker
    // geeft de records mee die hier gekozen mogen worden.
    if (Array.isArray(keuzelijst)) {
      return `<select id="${id}" data-kolom="${veld.kolom}" ${extra}>
        ${veld.verplicht ? "" : `<option value=""${w === "" ? " selected" : ""}>&mdash;</option>`}
        ${keuzelijst.map((k) => `<option value="${ontsnap(k.id)}"${String(k.id) === String(w) ? " selected" : ""}>${ontsnap(k.titel)}</option>`).join("")}
      </select>`;
    }
    if (veld.verwijst_naar === "gebruiker" && meta.gebruikers) {
      const mensen = Object.values(meta.gebruikers);
      return `<select id="${id}" data-kolom="${veld.kolom}" ${extra}>
        ${veld.verplicht ? "" : `<option value=""${w === "" ? " selected" : ""}>&mdash;</option>`}
        ${mensen.map((g) => `<option value="${ontsnap(g.id)}"${g.id === w ? " selected" : ""}>${ontsnap(g.naam)}</option>`).join("")}
      </select>`;
    }
    return `<input id="${id}" type="text" readonly value="${ontsnap(naam ?? w)}"
                   title="Deze verwijzing ligt vast zodra het record bestaat." ${extra}>`;
  }
  if (veld.type === "keuze") {
    const keuzes = keuzesVoor(meta, veld);
    return `<select id="${id}" data-kolom="${veld.kolom}" ${extra}>
      ${veld.verplicht ? "" : `<option value="" ${w === "" ? "selected" : ""}>&mdash;</option>`}
      ${keuzes.map((k) => `<option value="${ontsnap(k.waarde)}"${k.waarde === w ? " selected" : ""}>${ontsnap(k.label)}</option>`).join("")}
    </select>`;
  }
  if (veld.type === "lang") {
    return `<textarea id="${id}" data-kolom="${veld.kolom}" rows="3" ${extra}>${ontsnap(w)}</textarea>`;
  }
  if (veld.type === "ja_nee") {
    return `<select id="${id}" data-kolom="${veld.kolom}" ${extra}>
      <option value="0"${!Number(w) ? " selected" : ""}>nee</option>
      <option value="1"${Number(w) ? " selected" : ""}>ja</option></select>`;
  }
  const soort = veld.type === "datum" ? "date" : veld.type === "tijd" ? "time" : veld.type === "getal" ? "number" : "text";
  const stap = veld.type === "getal" ? ' step="any"' : "";
  return `<input id="${id}" data-kolom="${veld.kolom}" type="${soort}"${stap} value="${ontsnap(w)}" ${extra}>`;
}
