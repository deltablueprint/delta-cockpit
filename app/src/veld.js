// De veldrenderer: één plek waar een veldtype bepaalt hoe het eruitziet en
// wat je ermee kunt. Elk nieuw type is hier één regel, niet een scherm.

import { avatar, avatarMetNaam } from "./avatar.js";
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
export function lees(veld, waarde, meta, verwijzingen = {}, rij = {}, vorm = "lijst") {
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
    // Een vlag telt, maar wat je wilt zien is niet het getal: het is of er
    // iets ligt. Eén bolletje — groen als het stil is, oranje en pulserend als
    // er iets op je wacht. Het getal staat in de tooltip, voor wie het vraagt.
    case "vlag": {
      const n = Number(waarde) || 0;
      return `<span class="bolletje ${n ? "beweegt" : "stil"}" role="img"
        title="${n ? `${n} ${n === 1 ? "tranche vraagt" : "tranches vragen"} om duiding` : "niets veranderd"}"
        aria-label="${n ? `${n} om duiding` : "niets veranderd"}"></span>`;
    }
    // De keerzijde van 'archief': 0 betekent dat het record nog meedoet. Geen
    // badge — dit is een waarde, geen stand waar je op moet letten.
    case "actief":
      return `<span class="${Number(waarde) ? "faint" : ""}">${Number(waarde) ? "false" : "true"}</span>`;
    case "keuze": {
      const k = keuzesVoor(meta, veld).find((x) => x.waarde === waarde);
      const [fg, bg] = KLEUR[k ? k.kleur : "grijs"] || KLEUR.grijs;
      return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(k ? k.label : waarde)}</span>`;
    }
    case "verwijzing": {
      if (veld.verwijst_naar === "gebruiker" && meta.gebruikers && meta.gebruikers[waarde]) {
        const g = meta.gebruikers[waarde];
        // Op een formulier staat de volledige naam in een vakje van dezelfde
        // breedte als elk ander veld; in een lijst is er weinig plaats en zegt
        // een gezicht met een voornaam meer dan een lange naam die afbreekt.
        return vorm === "formulier"
          ? `<span class="persoonveld vast">${ontsnap(g.naam)}</span>`
          : avatarMetNaam(g);
      }
      return ontsnap(verwijzingen[veld.kolom] ?? waarde);
    }
    case "datum":
      return toonDatum(waarde);
    case "tijdstip":
      return `${toonDatum(waarde)} ${String(waarde).slice(11, 16)}`;
    case "procent": {
      const n = Number(waarde);
      return Number.isFinite(n) ? `${n.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} %` : ontsnap(waarde);
    }
    case "bedrag": {
      const n = Number(waarde);
      return Number.isFinite(n)
        ? `€ ${n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : ontsnap(waarde);
    }
    case "ja_nee":
      return Number(waarde) ? "ja" : "nee";
    case "bestand":
      return String(waarde).startsWith("data:image/")
        ? `<img class="duimnagel" src="${ontsnap(waarde)}" alt="">`
        : `<span class="faint">bestand</span>`;
    default:
      if (veld.kolom.endsWith("_pt")) {
        const n = Number(waarde);
        const kleur = n > 0 ? "var(--grn)" : n < 0 ? "var(--red)" : "var(--ink2)";
        return `<span style="color:${kleur};font-weight:600">${n > 0 ? "+" : n < 0 ? "−" : ""} ${Math.abs(n).toFixed(1).replace(".", ",")} pt</span>`;
      }
      return ontsnap(waarde);
  }
}

const LOEP = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/></svg>`;

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
    // Een verwijzing is geen keuzelijst. Je kiest geen besluit uit een rolletje
    // zoals je een status kiest: je zoekt een record op, je ziet welk record
    // er nu staat, en je kunt het bekijken zonder weg te gaan. Het vak toont
    // dus de titel, de loep zoekt op, en de waarde zelf reist verborgen mee —
    // zo blijft opslaan werken zoals bij elk ander veld.
    if (Array.isArray(keuzelijst)) {
      const gekozen = keuzelijst.find((k) => String(k.id) === String(w));
      return `<span class="refveld">
        <input type="hidden" id="${id}" data-kolom="${veld.kolom}" value="${ontsnap(w)}">
        <input type="text" class="reftitel" readonly ${extra}
               value="${ontsnap(gekozen ? gekozen.titel : "")}"
               placeholder="niets gekozen">
        <button type="button" class="refknop refkies" data-kies="${veld.kolom}"
                title="Opzoeken" aria-label="Opzoeken">${LOEP}</button>
      </span>`;
    }
    if (veld.verwijst_naar === "gebruiker" && meta.gebruikers) {
      const mensen = Object.values(meta.gebruikers);
      return `<span class="persoonveld">
        <select id="${id}" data-kolom="${veld.kolom}" ${extra}>
          ${veld.verplicht ? "" : `<option value=""${w === "" ? " selected" : ""}>&mdash;</option>`}
          ${mensen.map((g) => `<option value="${ontsnap(g.id)}"${g.id === w ? " selected" : ""}>${ontsnap(g.naam)}</option>`).join("")}
        </select></span>`;
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
  // Een afbeelding: wat er staat zie je, en je vervangt het door te plakken of
  // een bestand te kiezen. De waarde zelf — een data-URL — staat verborgen
  // mee, zodat het opslaan gewoon via data-kolom loopt.
  if (veld.type === "bestand") {
    const heeft = String(w).startsWith("data:image/");
    return `<span class="beeldveld">
      <input type="hidden" id="${id}" data-kolom="${veld.kolom}" value="${ontsnap(w)}">
      <span class="beeldvak${heeft ? " gevuld" : ""}" tabindex="0">${
        heeft ? `<img src="${ontsnap(w)}" alt="">`
              : `<span class="beeldleeg">Plak hier een afbeelding, of <b>kies een bestand</b></span>`}</span>
      <input type="file" class="beeldkiezer" accept="image/*" hidden>
    </span>`;
  }
  if (veld.type === "ja_nee") {
    return `<select id="${id}" data-kolom="${veld.kolom}" ${extra}>
      <option value="0"${!Number(w) ? " selected" : ""}>nee</option>
      <option value="1"${Number(w) ? " selected" : ""}>ja</option></select>`;
  }
  if (veld.type === "procent" || veld.type === "bedrag") {
    const teken = veld.type === "procent" ? "%" : "€";
    return `<span class="metteken${veld.type === "bedrag" ? " voor" : ""}">
      <input id="${id}" data-kolom="${veld.kolom}" type="number" step="any" value="${ontsnap(w)}" ${extra}>
      <span class="teken">${teken}</span></span>`;
  }

  const soort = veld.type === "datum" ? "date" : veld.type === "tijd" ? "time" : veld.type === "getal" ? "number" : "text";
  const stap = veld.type === "getal" ? ' step="any"' : "";
  return `<input id="${id}" data-kolom="${veld.kolom}" type="${soort}"${stap} value="${ontsnap(w)}" ${extra}>`;
}

// Een veld dat vastligt, als vak in plaats van als losse tekst.
//
// Een formulier dat wisselt tussen invoervakken en kale tekst leest als
// rommel: de regels liggen niet meer op één lijn en je ziet niet waarom het ene
// wel en het andere niet te wijzigen is. Daarom draagt ook een vast veld zijn
// eigen vak — grijs en uitgeschakeld. Bij een keuzeveld blijft het een
// keuzelijst, zodat je ziet welke standen er bestaan en waar deze staat, ook
// als het proces en niet jij bepaalt wat erin komt.
export function vastVeld(veld, waarde, meta, verwijzingen = {}, rij = {}) {
  const extra = `disabled data-toon="${veld.kolom}"`;
  const alsLijst =
    veld.type === "keuze" ||
    veld.type === "ja_nee" ||
    (veld.type === "verwijzing" && veld.verwijst_naar === "gebruiker" && meta.gebruikers);
  if (alsLijst) return invoer(veld, waarde, meta, extra);
  if (veld.type === "lang") return invoer(veld, waarde, meta, extra);
  const tekst = plat(veld, waarde, meta, verwijzingen, rij);
  return `<input id="veld-${veld.kolom}" data-kolom="${veld.kolom}" type="text"
                 value="${ontsnap(tekst)}" ${extra}>`;
}

// Dezelfde opmaak als in een lijst, maar als kale tekst: een waarde die in een
// invoervak staat, kan geen opmaak dragen.
export function plat(veld, waarde, meta, verwijzingen = {}, rij = {}) {
  if (waarde === null || waarde === undefined || waarde === "") return "";
  switch (veld.type) {
    case "vlag": return Number(waarde) ? `${Number(waarde)} vragen om duiding` : "rustig";
    case "actief": return Number(waarde) ? "false" : "true";
    case "keuze": {
      const k = keuzesVoor(meta, veld).find((x) => x.waarde === waarde);
      return k ? k.label : String(waarde);
    }
    case "verwijzing": {
      if (veld.verwijst_naar === "gebruiker" && meta.gebruikers && meta.gebruikers[waarde]) {
        return meta.gebruikers[waarde].naam;
      }
      return String(verwijzingen[veld.kolom] ?? waarde);
    }
    case "datum": return toonDatum(waarde);
    case "tijdstip": return `${toonDatum(waarde)} ${String(waarde).slice(11, 16)}`;
    case "ja_nee": return Number(waarde) ? "ja" : "nee";
    case "procent": {
      const n = Number(waarde);
      return Number.isFinite(n) ? `${n.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} %` : String(waarde);
    }
    case "bedrag": {
      const n = Number(waarde);
      return Number.isFinite(n)
        ? `€ ${n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(waarde);
    }
    default:
      if (veld.kolom.endsWith("_pt")) {
        const n = Number(waarde);
        return `${n > 0 ? "+" : n < 0 ? "−" : ""} ${Math.abs(n).toFixed(1).replace(".", ",")} pt`;
      }
      return String(waarde);
  }
}
