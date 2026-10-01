// ============================================================================
// De lijst — één component voor élke tabel in de applicatie.
//
// Alles wat per tabel verschilt komt uit de definitielaag: welke kolommen,
// hun labels, hun type, hun breedte, hun keuzelijsten (BOUWSPEC 10.0c).
// Geen enkel scherm verzint hier iets bij.
//
// Wat deze component kan:
//   · zoeken over alle tekstkolommen, en per kolom apart
//   · sorteren op elke kolom, klikken wisselt de richting
//   · bladeren, met het aantal erbij
//   · actieve filters als chips, met een kruisje om ze weg te halen
//   · de toestand staat in de URL, dus een link is deelbaar en terug werkt
//
// Eén echte <table> met een colgroup: de kolommen lijnen zich dan zelf uit.
// Rijen die elk hun eigen raster zijn vallen per rij anders uit — dat was fout.
// ============================================================================

import { lijst as haalLijst, bewaar } from "./api.js";
import { lees, invoer, keuzesVoor } from "./veld.js";
import { volgLive } from "./live.js";

const KLEUR = {
  groen:  ["var(--grn)",  "var(--grnbg)"],
  oranje: ["var(--amb)",  "var(--ambbg)"],
  rood:   ["var(--red)",  "var(--redbg)"],
  blauw:  ["var(--blue)", "var(--bluebg)"],
  grijs:  ["var(--mut)",  "var(--head)"],
};

const ICOON = {
  hamburger: `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="#B6B3AC" stroke-width="2.6" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  zoek:      `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#8A8884" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`,
  trechter:  `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#136289" stroke-width="2" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>`,
  info:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#136289" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".7" fill="#136289"/></svg>`,
  menu:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#6E6C68" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  vorige:    `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
  volgende:  `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  eerste:    `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M18 6l-6 6 6 6M8 6v12"/></svg>`,
  laatste:   `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M6 6l6 6-6 6M16 6v12"/></svg>`,
};

let laatsteFocus = null;   // welk veld de cursor had vóór het opnieuw tekenen

// Welke lijst er nu staat. De router gebruikt dit om te zien of een
// hashwijziging van onszelf komt — dan hoeft er niets opnieuw getekend.
export const huidigeLijst = { tabelnaam: null, url: null };

const MAANDEN = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
const PAGINA = 50;

// ---------------------------------------------------------------- hulpdingen
const ontsnap = (t) =>
  String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function datum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? `${Number(m[3])} ${MAANDEN[Number(m[2]) - 1]} ${m[1]}` : ontsnap(s);
}

function waarde(veld, w, meta) {
  if (w === null || w === undefined || w === "") return `<span class="faint">&mdash;</span>`;
  if (veld.type === "keuze") {
    const keuzes = meta.keuzes[`${veld.tabel}.${veld.kolom}`] || [];
    const k = keuzes.find((x) => x.waarde === w);
    const [fg, bg] = KLEUR[k ? k.kleur : "grijs"] || KLEUR.grijs;
    return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(k ? k.label : w)}</span>`;
  }
  if (veld.kolom.endsWith("_pt")) {
    const n = Number(w);
    const kleur = n > 0 ? "var(--grn)" : n < 0 ? "var(--red)" : "var(--ink2)";
    return `<span style="color:${kleur};font-weight:600">${n > 0 ? "+" : n < 0 ? "−" : ""} ${Math.abs(n).toFixed(1).replace(".", ",")} pt</span>`;
  }
  if (veld.type === "datum") return datum(w);
  if (veld.type === "tijdstip") return `${datum(w)} ${String(w).slice(11, 16)}`;
  return ontsnap(w);
}

const rechtsUit = (veld) =>
  ["getal", "datum", "tijdstip"].includes(veld.type) || veld.kolom.endsWith("_pt");

// Platte tekst voor het title-attribuut, zodat afgeknotte cellen leesbaar blijven.
function platteTekst(veld, w, meta) {
  if (w === null || w === undefined || w === "") return "";
  if (veld.type === "keuze") {
    const k = (meta.keuzes[`${veld.tabel}.${veld.kolom}`] || []).find((x) => x.waarde === w);
    return k ? k.label : String(w);
  }
  return String(w);
}

// ------------------------------------------------------------- toestand ↔ URL
// De toestand van een lijst hoort in de URL: dan is een gefilterde lijst een
// link die je kunt delen, en werkt de terugknop van de browser.
export function toestandUitUrl(zoekdeel) {
  const p = new URLSearchParams(zoekdeel || "");
  const filters = {};
  for (const [k, v] of p) if (k.startsWith("f.")) filters[k.slice(2)] = v;
  return {
    q: p.get("q") || "",
    sorteer: p.get("sorteer") || null,
    richting: p.get("richting") === "desc" ? "desc" : "asc",
    offset: Math.max(parseInt(p.get("offset") || "0", 10) || 0, 0),
    filters,
  };
}

function urlVoor(tabelnaam, t) {
  const p = new URLSearchParams();
  if (t.q) p.set("q", t.q);
  if (t.sorteer) { p.set("sorteer", t.sorteer); p.set("richting", t.richting); }
  if (t.offset) p.set("offset", String(t.offset));
  for (const [k, v] of Object.entries(t.filters)) if (v) p.set(`f.${k}`, v);
  const vraag = p.toString();
  return `#/t/${tabelnaam}${vraag ? "?" + vraag : ""}`;
}

// ------------------------------------------------------------------- tekenen
export async function lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand) {
  const params = new URLSearchParams();
  if (toestand.q) params.set("q", toestand.q);
  if (toestand.sorteer) { params.set("sorteer", toestand.sorteer); params.set("richting", toestand.richting); }
  if (toestand.offset) params.set("offset", String(toestand.offset));
  params.set("limiet", String(PAGINA));
  for (const [k, v] of Object.entries(toestand.filters)) if (v) params.set(`f.${k}`, v);

  const bestaand = inhoud.querySelector(".lijst");
  if (bestaand) bestaand.classList.add("bezig");
  else inhoud.innerHTML = `<div class="kaart leeg">Bezig met laden&hellip;</div>`;

  let data;
  try {
    data = await haalLijst(tabelnaam, params);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  if (!toestand.ingebed) {
    kruimel.textContent = data.tabel.label_mv;
    document.title = `${data.tabel.label_mv} · Delta Blueprint Cockpit`;
  }

  const kolommen = data.kolommen;
  const tot = data.totaal;
  const van = tot === 0 ? 0 : toestand.offset + 1;
  const totRegel = Math.min(toestand.offset + PAGINA, tot);
  const paginas = Math.max(Math.ceil(tot / PAGINA), 1);
  const paginaNu = Math.floor(toestand.offset / PAGINA) + 1;

  const knop = (icoon, naar, uit, label) =>
    `<button class="pknop" data-offset="${naar}" ${uit ? "disabled" : ""} aria-label="${label}" title="${label}">${icoon}</button>`;

  const toolbar = `
    <div class="lijstkop">
      ${ICOON.menu}
      <span class="lijsttitel">${ontsnap(data.tabel.label_mv)}</span>
      <span class="zoeklabel">Zoeken</span>
      <select class="zoekveld" aria-label="Zoekveld"><option>Alle velden</option>${
        kolommen.map((k) => `<option value="${k.kolom}"${toestand.zoekkolom === k.kolom ? " selected" : ""}>${ontsnap(k.label)}</option>`).join("")
      }</select>
      <input id="zoek" class="zoek" type="text" aria-label="Zoeken" value="${ontsnap(toestand.q)}" placeholder="Zoeken">
      <span class="pagina">
        ${knop(ICOON.eerste, 0, toestand.offset === 0, "Eerste pagina")}
        ${knop(ICOON.vorige, Math.max(toestand.offset - PAGINA, 0), toestand.offset === 0, "Vorige pagina")}
        <span class="paginanummer">${paginaNu}</span>
        <span class="paginatekst">${tot === 0 ? "geen regels" : `${van} tot ${totRegel} van ${tot}`}</span>
        ${knop(ICOON.volgende, toestand.offset + PAGINA, totRegel >= tot, "Volgende pagina")}
        ${knop(ICOON.laatste, (paginas - 1) * PAGINA, totRegel >= tot, "Laatste pagina")}
      </span>
    </div>`;

  const chips = Object.entries(toestand.filters)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const veld = kolommen.find((x) => x.kolom === k);
      return `<span class="chip">${ontsnap(veld ? veld.label : k)} = ${ontsnap(v)}
        <button class="chipweg" data-kolom="${k}" aria-label="Filter weghalen">&times;</button></span>`;
    }).join("");

  const filterrij = `
    <div class="lijstfilter">
      ${ICOON.trechter}
      <span class="alle">Alle</span>
      ${toestand.q ? `<span class="chip">zoekt op &ldquo;${ontsnap(toestand.q)}&rdquo;
        <button class="chipweg" data-kolom="__q" aria-label="Zoekterm weghalen">&times;</button></span>` : ""}
      ${chips}
      <span class="filternote">${tot === 0 ? "" : `${tot} ${tot === 1 ? "regel" : "regels"}`}</span>
    </div>`;

  // Elke kolom krijgt zijn breedte uit de definitielaag; wat overblijft gaat
  // naar een lege kolom rechts. Zo wordt de titelkolom nooit onnodig breed.
  const standaardBreedte = (k) =>
    k.breedte || ({ keuze: "130px", datum: "120px", tijdstip: "150px", getal: "110px", "ja_nee": "90px" }[k.type] || "180px");

  const breedtes = kolommen.map(standaardBreedte);
  const minBreedte = breedtes.reduce((n, b) => n + (parseInt(b, 10) || 180), 0);

  const colgroup = `<colgroup>
      ${breedtes.map((b) => `<col style="width:${ontsnap(b)}">`).join("")}
      <col>
    </colgroup>`;

  const thead = `
    <thead>
      <tr class="kopregel">
        ${kolommen.map((k) => `
          <th class="${rechtsUit(k) ? "rechts " : ""}${toestand.sorteer === k.kolom ? "gesorteerd" : ""}" data-kolom="${k.kolom}"
              aria-sort="${toestand.sorteer === k.kolom ? (toestand.richting === "desc" ? "descending" : "ascending") : "none"}">
            <span class="kolomkop">${ICOON.hamburger}<span>${ontsnap(k.label)}</span>${
              toestand.sorteer === k.kolom ? `<span class="pijl">${toestand.richting === "desc" ? "▾" : "▴"}</span>` : ""
            }</span>
          </th>`).join("")}
        <th class="vuller"></th>
      </tr>
      <tr class="zoekregel">
        ${kolommen.map((k) => `<td><input type="text" data-kolom="${k.kolom}"
            aria-label="Zoeken in ${ontsnap(k.label)}" value="${ontsnap(toestand.filters[k.kolom] || "")}"
            placeholder="Zoeken"${k.type === "datum" || k.type === "tijdstip" ? ' title="Bijvoorbeeld: 2026 · jul · jul 2026 · 6 jul 2026 · 202607 · 6/7/2026"' : ""}></td>`).join("")}
        <td></td>
      </tr>
    </thead>`;

  const tbody = tot === 0
    ? `<tbody><tr><td colspan="${kolommen.length + 1}" class="geenregels">
         ${toestand.q || chips ? "Geen regels die hieraan voldoen." : `Nog geen ${ontsnap(data.tabel.label_mv.toLowerCase())}.`}
       </td></tr></tbody>`
    : `<tbody>${data.rijen.map((r) => `
        <tr data-id="${r.id}">
          ${kolommen.map((k, i) => {
            const tip = platteTekst(k, r[k.kolom], meta);
            return `<td data-kolom="${k.kolom}" class="${rechtsUit(k) ? "rechts " : ""}${toestand.sorteer === k.kolom ? "gesorteerd" : ""}"${tip ? ` title="${ontsnap(tip)}"` : ""}>${
              i === 0
                ? `<a href="#/t/${tabelnaam}/${r.id}" class="recordlink">${waarde(k, r[k.kolom], meta)}</a>`
                : waarde(k, r[k.kolom], meta)
            }</td>`;
          }).join("")}
          <td class="vuller"></td>
        </tr>`).join("")}</tbody>`;

  const ingebed = toestand.ingebed;

  const relatiekop = !ingebed ? "" : `
    <div class="rlkop">
      <span class="rltitel">${ontsnap(ingebed.label || data.tabel.label_mv)}</span>
      <span class="rlmeta">${tot} ${tot === 1 ? ontsnap(data.tabel.label.toLowerCase()) : ontsnap(data.tabel.label_mv.toLowerCase())}</span>
      <a class="knop klein" href="#/t/${tabelnaam}/nieuw?ouder=${ingebed.ouder.tabel}:${ingebed.ouder.id}">Nieuw</a>
    </div>`;

  inhoud.innerHTML = (ingebed ? "" : `
    <div class="titelrij">
      <h1>${ontsnap(data.tabel.label_mv)}</h1>
      <span class="sub">${tot} ${tot === 1 ? ontsnap(data.tabel.label.toLowerCase()) : ontsnap(data.tabel.label_mv.toLowerCase())}</span>
    </div>`) + `
    <div class="lijst${ingebed ? " ingebed" : ""}">${relatiekop}${ingebed ? "" : toolbar + filterrij}
      <div class="tabelomhulsel"><table class="lijsttabel" style="min-width:${minBreedte}px">${colgroup}${thead}${tbody}</table></div>
    </div>`;

  // ------------------------------------------------------------- gedrag
  const ga = (nieuw) => {
    const actief = document.activeElement;
    laatsteFocus = actief && actief.id === "zoek"
      ? "q"
      : actief && actief.dataset && actief.dataset.kolom && actief.tagName === "INPUT"
        ? actief.dataset.kolom
        : null;

    const volgende = { ...toestand, ...nieuw };
    if (toestand.ingebed) {
      lijstscherm(inhoud, kruimel, tabelnaam, meta, volgende);
      return;
    }
    const url = urlVoor(tabelnaam, volgende);

    // De URL bijwerken zonder navigatie: het adres klopt en de terugknop werkt,
    // maar het scherm wordt niet opnieuw opgebouwd.
    huidigeLijst.tabelnaam = tabelnaam;
    huidigeLijst.url = url;
    history.pushState(null, "", url);

    lijstscherm(inhoud, kruimel, tabelnaam, meta, volgende);
  };

  const zoek = inhoud.querySelector("#zoek");
  let klok;
  zoek.addEventListener("input", () => {
    clearTimeout(klok);
    klok = setTimeout(() => ga({ q: zoek.value.trim(), offset: 0 }), 300);
  });
  zoek.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(klok); ga({ q: zoek.value.trim(), offset: 0 }); } });

  inhoud.querySelectorAll(".zoekregel input").forEach((el) => {
    let k2;
    el.addEventListener("input", () => {
      clearTimeout(k2);
      k2 = setTimeout(() => {
        const filters = { ...toestand.filters };
        const v = el.value.trim();
        if (v) filters[el.dataset.kolom] = v; else delete filters[el.dataset.kolom];
        ga({ filters, offset: 0 });
      }, 300);
    });
  });

  inhoud.querySelectorAll("th[data-kolom]").forEach((el) => {
    el.addEventListener("click", () => {
      const kolom = el.dataset.kolom;
      const richting = toestand.sorteer === kolom && toestand.richting === "asc" ? "desc" : "asc";
      ga({ sorteer: kolom, richting, offset: 0 });
    });
  });

  inhoud.querySelectorAll(".pknop").forEach((el) => {
    el.addEventListener("click", () => { if (!el.disabled) ga({ offset: Number(el.dataset.offset) }); });
  });

  inhoud.querySelectorAll(".chipweg").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.dataset.kolom === "__q") return ga({ q: "", offset: 0 });
      const filters = { ...toestand.filters };
      delete filters[el.dataset.kolom];
      ga({ filters, offset: 0 });
    });
  });

  // Zonder de hele lijst opnieuw op te bouwen opnieuw ophalen: zo zie je de
  // wijzigingen van de anderen binnenkomen terwijl je kijkt.
  if (!toestand.ingebed) {
    volgLive(() => lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand));
  }

  // ---- bewerken in de lijst (etappe 5) ----
  // Dubbelklik op een cel maakt er een invoerveld van. Enter of wegklikken
  // slaat op, Escape maakt ongedaan. Opslaan draagt de revisie mee: heeft
  // iemand anders intussen opgeslagen, dan zie je dat in plaats van zijn
  // werk te overschrijven.
  inhoud.querySelectorAll("tbody td[data-kolom]").forEach((cel) => {
    cel.addEventListener("dblclick", () => {
      if (cel.querySelector("input, select, textarea")) return;
      const kolom = cel.dataset.kolom;
      const veld = kolommen.find((k) => k.kolom === kolom);
      if (!veld || veld.alleen_lezen) return;

      const rij = cel.closest("tr");
      const id = Number(rij.dataset.id);
      const oudeHtml = cel.innerHTML;
      const rijgegevens = data.rijen.find((r) => r.id === id);
      const oudeWaarde = rijgegevens ? rijgegevens[kolom] : null;

      cel.classList.add("bewerkt");
      cel.innerHTML = invoer(veld, oudeWaarde, meta, 'class="celinvoer"');
      const el = cel.querySelector("[data-kolom]");
      el.focus();
      if (el.select) el.select();

      let klaar = false;
      const herstel = () => { cel.classList.remove("bewerkt"); cel.innerHTML = oudeHtml; };

      const opslaan = async () => {
        if (klaar) return;
        klaar = true;
        const nieuweWaarde = el.value === "" ? null : el.value;
        if (String(nieuweWaarde ?? "") === String(oudeWaarde ?? "")) return herstel();
        cel.classList.add("bezigcel");
        try {
          const uitkomst = await bewaar(tabelnaam, id, { [kolom]: nieuweWaarde }, rijgegevens?.revisie);
          if (rijgegevens) {
            rijgegevens[kolom] = nieuweWaarde;
            rijgegevens.revisie = uitkomst.revisie ?? rijgegevens.revisie;
          }
          cel.classList.remove("bewerkt", "bezigcel");
          cel.innerHTML = lees(veld, nieuweWaarde, meta);
          cel.classList.add("zojuist");
          setTimeout(() => cel.classList.remove("zojuist"), 1200);
        } catch (fout) {
          cel.classList.remove("bezigcel");
          herstel();
          alert(fout.message);
          if (String(fout.message).includes("intussen")) {
            lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand);
          }
        }
      };

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && veld.type !== "lang") { e.preventDefault(); opslaan(); }
        if (e.key === "Escape") { klaar = true; herstel(); }
      });
      el.addEventListener("blur", opslaan);
      if (el.tagName === "SELECT") el.addEventListener("change", opslaan);
    });
  });

  // De cursor terug in het veld waar hij stond, anders is typen onmogelijk.
  if (laatsteFocus === "q") {
    zoek.focus();
    zoek.setSelectionRange(zoek.value.length, zoek.value.length);
  } else if (laatsteFocus) {
    const el = inhoud.querySelector(`.zoekregel input[data-kolom="${laatsteFocus}"]`);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  laatsteFocus = null;
}
