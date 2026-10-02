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

import { lijst as haalLijst, bewaar, archiveer, leesVoorkeur, zetVoorkeur } from "./api.js";
import { lees, invoer, keuzesVoor } from "./veld.js";

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
  trechter:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#136289" stroke-width="1.8" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>`,
  info:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#136289" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".7" fill="#136289"/></svg>`,
  menu:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#6E6C68" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  prullenbak:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>`,
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

function waarde(veld, w, meta, rij = {}, namen = {}) {
  if (w === null || w === undefined || w === "") return `<span class="faint">&mdash;</span>`;
  if (veld.type === "keuze" || veld.type === "tijd" || veld.type === "verwijzing") {
    const vertaald = namen[veld.kolom] && namen[veld.kolom][w] !== undefined
      ? { [veld.kolom]: namen[veld.kolom][w] } : {};
    return lees(veld, w, meta, vertaald, rij);
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

// ----------------------------------------------------------- kolombreedte
// Tekst meten doe je niet op gevoel. Het werkblad hieronder rekent dezelfde
// letters na die de browser straks tekent, zodat een kop als "Aangemaakt door"
// niet halverwege afbreekt.
const WERKBLAD = document.createElement("canvas").getContext("2d");

function tekstbreedte(tekst, font, letterspatie = 0) {
  if (!tekst) return 0;
  WERKBLAD.font = font;
  return WERKBLAD.measureText(tekst).width + letterspatie * tekst.length;
}

// Ruimte naast de tekst: de binnenmarge van de cel, het hamburgertje in de
// kop, de sorteerpijl en de sleepgreep ernaast.
const KOPRUIMTE = 52;
const CELRUIMTE = 22;
const SMALST = 92;
const BREEDST = 360;

function gemetenBreedte(kolom, index, rijen, meta, namen = {}) {
  const familie = getComputedStyle(document.body).fontFamily || "sans-serif";
  const kopfont = `700 10px ${familie}`;
  const celfont = `${index === 0 ? "600 " : ""}12px ${familie}`;

  // De kop staat in kapitalen en met wat letterruimte; zo wordt hij ook gemeten.
  let breed = tekstbreedte(kolom.label.toUpperCase(), kopfont, 0.9) + KOPRUIMTE;

  for (const rij of rijen) {
    const tekst = platteTekst(kolom, rij[kolom.kolom], meta, namen);
    if (!tekst) continue;
    let w = tekstbreedte(tekst, celfont) + CELRUIMTE;
    if (kolom.type === "keuze") w += 16;                    // het randje om de badge
    if (kolom.type === "verwijzing" && kolom.verwijst_naar === "gebruiker") w += 28; // de avatar
    if (kolom.type === "tijd") w += 34;                     // de zoneafkorting erachter
    if (w > breed) breed = w;
  }

  const bodem = parseInt(kolom.breedte, 10) || 0;
  return Math.round(Math.min(Math.max(breed, bodem, SMALST), BREEDST));
}

// Platte tekst voor het title-attribuut, zodat afgeknotte cellen leesbaar blijven.
function platteTekst(veld, w, meta, namen = {}) {
  if (w === null || w === undefined || w === "") return "";
  if (veld.type === "verwijzing") {
    if (namen[veld.kolom] && namen[veld.kolom][w] !== undefined) return String(namen[veld.kolom][w]);
    if (veld.verwijst_naar === "gebruiker" && meta.gebruikers[w]) return meta.gebruikers[w].naam;
    return String(w);
  }
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
  const idfilters = {};
  for (const [k, v] of p) {
    if (k.startsWith("fid.")) idfilters[k.slice(4)] = v;
    else if (k.startsWith("f.")) filters[k.slice(2)] = v;
  }
  return {
    idfilters,
    q: p.get("q") || "",
    zoekkolom: p.get("zk") || null,
    sorteer: p.get("sorteer") || null,
    richting: p.get("richting") === "desc" ? "desc" : "asc",
    offset: Math.max(parseInt(p.get("offset") || "0", 10) || 0, 0),
    filters,
  };
}

function urlVoor(tabelnaam, t) {
  const p = new URLSearchParams();
  if (t.q) p.set("q", t.q);
  if (t.zoekkolom) p.set("zk", t.zoekkolom);
  if (t.sorteer) { p.set("sorteer", t.sorteer); p.set("richting", t.richting); }
  if (t.offset) p.set("offset", String(t.offset));
  for (const [k, v] of Object.entries(t.filters)) if (v) p.set(`f.${k}`, v);
  for (const [k, v] of Object.entries(t.idfilters || {})) if (v) p.set(`fid.${k}`, v);
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
  for (const [k, v] of Object.entries(toestand.idfilters || {})) if (v) params.set(`fid.${k}`, v);

  // Alleen een lijst die rechtstreeks in dit vak staat telt als 'dezelfde
  // lijst'. Stond er een recordscherm met een gerelateerde lijst erin, dan
  // werd díé even grijs gemaakt voordat het scherm verwisselde — dat zag je
  // als een flikkering bij het klikken op Cycli.
  const bestaand = inhoud.querySelector(":scope > .lijst");
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
      ${data.tabel.nieuw_vanuit_lijst ? `<a class="knop klein" href="#/t/${tabelnaam}/nieuw">Nieuw</a>` : ""}
      ${data.tabel.import_toegestaan ? `<a class="knop klein tweede" href="#/import/${tabelnaam}">Inlezen uit document</a>` : ""}
      <span class="zoeklabel">Zoeken</span>
      <select class="zoekveld" aria-label="Zoekveld"><option>Alle velden</option>${
        kolommen.map((k) => `<option value="${k.kolom}"${toestand.zoekkolom === k.kolom ? " selected" : ""}>${ontsnap(k.label)}</option>`).join("")
      }</select>
      <input id="zoek" class="zoek" type="text" aria-label="Zoeken" value="${
        ontsnap(toestand.zoekkolom ? (toestand.filters[toestand.zoekkolom] || "") : toestand.q)
      }" placeholder="Zoeken">
      <span class="pagina">
        ${knop(ICOON.eerste, 0, toestand.offset === 0, "Eerste pagina")}
        ${knop(ICOON.vorige, Math.max(toestand.offset - PAGINA, 0), toestand.offset === 0, "Vorige pagina")}
        <span class="paginanummer">${paginaNu}</span>
        <span class="paginatekst">${tot === 0 ? "geen regels" : `${van} tot ${totRegel} van ${tot}`}</span>
        ${knop(ICOON.volgende, toestand.offset + PAGINA, totRegel >= tot, "Volgende pagina")}
        ${knop(ICOON.laatste, (paginas - 1) * PAGINA, totRegel >= tot, "Laatste pagina")}
      </span>
    </div>`;

  // De chips: wat er nu gefilterd wordt. Een vast filter op een verwijzing
  // toont de naam van dat record — 'Cyclus = 2026-10', niet 'Cyclus = 3'.
  // In een gerelateerde lijst blijft het ouderfilter buiten beeld: dat ís de
  // lijst, en wie het weghaalt zou de lijst van een ander record zien.
  const vasteChips = Object.entries(data.idfilters || {})
    .filter(([k]) => !(toestand.ingebed && k === toestand.ingebed.kolom))
    .map(([k, f]) => `<span class="chip">${ontsnap(f.veldlabel || k)} = ${ontsnap(f.label)}
        <button class="chipweg" data-vast="${k}" aria-label="Filter weghalen">&times;</button></span>`)
    .join("");

  const chips = vasteChips + Object.entries(toestand.filters)
    .filter(([k, v]) => v && !(toestand.ingebed && k === toestand.ingebed.kolom))
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

  // Een kolom is zo breed als wat erin staat. De kop telt mee — een kop die
  // halverwege afbreekt is onleesbaar — en de getoonde regels tellen mee. Wat
  // in de definitielaag staat is de ondergrens, en heeft deze gebruiker de
  // kolom zelf versleept, dan wint zijn breedte: die is van hem.
  const eigen = await eigenBreedtes(tabelnaam);
  const breedtes = kolommen.map(
    (k, i) => `${eigen[k.kolom] || gemetenBreedte(k, i, data.rijen, meta, data.verwijzingen || {})}px`
  );
  const minBreedte = breedtes.reduce((n, b) => n + (parseInt(b, 10) || 180), 0)
    + (toestand.ingebed ? 34 : 0);

  // In een gerelateerde lijst kun je regels aanvinken en archiveren: daar maak
  // je ze aan, dus daar ruim je een vergissing ook op. Verwijderen bestaat
  // niet — een gearchiveerde regel verdwijnt uit beeld maar blijft bestaan,
  // met wie hem weghaalde in de audit trail (hard uitgangspunt 1).
  const metVinkjes = Boolean(toestand.ingebed);

  const colgroup = `<colgroup>
      ${metVinkjes ? `<col style="width:34px">` : ""}
      ${breedtes.map((b) => `<col style="width:${ontsnap(b)}">`).join("")}
      <col>
    </colgroup>`;

  const thead = `
    <thead>
      <tr class="kopregel">
        ${metVinkjes ? `<th class="vink"><input type="checkbox" class="vinkalles" aria-label="Alles aanvinken"></th>` : ""}
        ${kolommen.map((k) => `
          <th class="${rechtsUit(k) ? "rechts " : ""}${toestand.sorteer === k.kolom ? "gesorteerd" : ""}" data-kolom="${k.kolom}"
              aria-sort="${toestand.sorteer === k.kolom ? (toestand.richting === "desc" ? "descending" : "ascending") : "none"}">
            <span class="kolomkop">${ICOON.hamburger}<span>${ontsnap(k.label)}</span>${
              toestand.sorteer === k.kolom ? `<span class="pijl">${toestand.richting === "desc" ? "▾" : "▴"}</span>` : ""
            }</span><span class="sleepgreep" data-sleep="${k.kolom}" title="Sleep om de kolom breder of smaller te maken"></span>
          </th>`).join("")}
        <th class="vuller"></th>
      </tr>
      <tr class="zoekregel">
        ${metVinkjes ? `<td class="vink"><button class="ikoonknop rlweg onzichtbaar" id="rlweg"
            title="Aangevinkte regels archiveren" aria-label="Aangevinkte regels archiveren">${ICOON.prullenbak}</button></td>` : ""}
        ${kolommen.map((k) => `<td><input type="text" data-kolom="${k.kolom}"
            aria-label="Zoeken in ${ontsnap(k.label)}" value="${ontsnap(toestand.filters[k.kolom] || "")}"
            placeholder="Zoeken"${k.type === "datum" || k.type === "tijdstip" ? ' title="Bijvoorbeeld: 2026 · jul · jul 2026 · 6 jul 2026 · 202607 · 6/7/2026"' : ""}></td>`).join("")}
        <td></td>
      </tr>
    </thead>`;

  // Meldingen horen in het scherm, niet in een venster van de browser dat je
  // moet wegklikken voor je verder kunt.
  const meld = (tekst, soort = "waarschuwing") => {
    const vak = inhoud.querySelector("#lijstmelding");
    if (!vak) return;
    vak.textContent = tekst;
    vak.className = `lijstmelding ${soort}`;
    vak.hidden = false;
    clearTimeout(meld.klok);
    meld.klok = setTimeout(() => { vak.hidden = true; }, 6000);
  };

  const tbody = tot === 0
    ? `<tbody><tr><td colspan="${kolommen.length + (metVinkjes ? 2 : 1)}" class="geenregels">
         ${(toestand.ingebed ? toestand.q : toestand.q || chips) ? "Geen regels die hieraan voldoen." : `Nog geen ${ontsnap(data.tabel.label_mv.toLowerCase())}.`}
       </td></tr></tbody>`
    : `<tbody>${data.rijen.map((r) => `
        <tr data-id="${r.id}">
          ${metVinkjes ? `<td class="vink"><input type="checkbox" class="vinkrij" data-id="${r.id}" aria-label="Deze regel aanvinken"></td>` : ""}
          ${kolommen.map((k, i) => {
            const tip = platteTekst(k, r[k.kolom], meta, data.verwijzingen || {});
            return `<td data-kolom="${k.kolom}" class="${rechtsUit(k) ? "rechts " : ""}${toestand.sorteer === k.kolom ? "gesorteerd" : ""}"${tip ? ` title="${ontsnap(tip)}"` : ""}>${
              i === 0
                ? `<a href="#/t/${tabelnaam}/${r.id}" class="recordlink">${waarde(k, r[k.kolom], meta, r, data.verwijzingen || {})}</a>`
                : waarde(k, r[k.kolom], meta, r, data.verwijzingen || {})
            }</td>`;
          }).join("")}
          <td class="vuller"></td>
        </tr>`).join("")}</tbody>`;

  const ingebed = toestand.ingebed;

  const relatiekop = !ingebed ? "" : `
    <div class="rlkop">
      <span class="rltitel">${ontsnap(ingebed.label || data.tabel.label_mv)}</span>
      ${ingebed.toonTelling ? `<span class="rlmeta">${tot} ${tot === 1 ? ontsnap(data.tabel.label.toLowerCase()) : ontsnap(data.tabel.label_mv.toLowerCase())}</span>` : ""}
      ${ingebed.magNieuw === false
        ? (ingebed.inPlaatsVan ? `<span class="rluitleg">${ontsnap(ingebed.inPlaatsVan)}</span>` : "")
        : `<a class="knop" href="#/t/${tabelnaam}/nieuw?ouder=${ingebed.ouder.tabel}:${ingebed.ouder.id}">Nieuw</a>`}
      ${ingebed.overnemen ? `<button class="knop tweede klein" id="rlovernemen">Overnemen uit een eerdere cyclus</button>` : ""}
      <span class="rlselectie" id="rlselectie"></span>
    </div>`;

  inhoud.innerHTML = (ingebed ? "" : `
    <div class="titelrij">
      <h1>${ontsnap(data.tabel.label_mv)}</h1>
      <span class="sub">${tot} ${tot === 1 ? "regel" : "regels"}</span>
    </div>`) + `
    <div class="lijst${ingebed ? " ingebed" : ""}">${relatiekop}${ingebed ? (chips || toestand.q ? filterrij : "") : toolbar + filterrij}
      <div class="lijstmelding" id="lijstmelding" hidden></div>
      <div class="tabelomhulsel"><table class="lijsttabel" style="min-width:${minBreedte}px">${colgroup}${thead}${tbody}</table></div>
    </div>`;

  // De teller op het tabblad hoort te kloppen met wat eronder staat: archiveer
  // je een regel, dan verandert het cijfer meteen in plaats van bij de
  // volgende keer dat het scherm geladen wordt. Alleen bij een ongefilterde
  // lijst, anders zou de teller het aantal zoekresultaten gaan tonen.
  if (ingebed && !toestand.q && !Object.values(toestand.filters || {}).some(Boolean)) {
    const teller = document.querySelector(`.tab[data-tabel="${tabelnaam}"] .tabtelling`);
    if (teller) teller.textContent = tot;
  }

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

  // Een ingebedde lijst heeft geen werkbalk en dus geen algemeen zoekveld.
  // Zonder deze controle struikelde alles wat hierna wordt aangesloten —
  // zoeken per kolom, sorteren, bewerken — op een element dat er niet is.
  const zoek = inhoud.querySelector("#zoek");
  if (zoek) {
    // Het rolmenu ernaast zegt wáár gezocht wordt. Staat er een kolom, dan
    // gaat de tekst als filter naar die kolom; staat er 'Alle velden', dan
    // gaat ze als vrije zoekterm naar de hele rij.
    const zoekGa = () => {
      const tekst = zoek.value.trim();
      if (toestand.zoekkolom) {
        const filters = { ...toestand.filters };
        if (tekst) filters[toestand.zoekkolom] = tekst; else delete filters[toestand.zoekkolom];
        ga({ filters, offset: 0 });
      } else {
        ga({ q: tekst, offset: 0 });
      }
    };

    let klok;
    zoek.addEventListener("input", () => { clearTimeout(klok); klok = setTimeout(zoekGa, 300); });
    zoek.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(klok); zoekGa(); } });

    const zoekveld = inhoud.querySelector(".zoekveld");
    if (zoekveld) {
      zoekveld.addEventListener("change", () => {
        const kolom = zoekveld.selectedIndex === 0 ? null : zoekveld.value;
        const tekst = zoek.value.trim();
        const filters = { ...toestand.filters };
        if (toestand.zoekkolom) delete filters[toestand.zoekkolom];
        if (kolom && tekst) filters[kolom] = tekst;
        ga({ zoekkolom: kolom, q: kolom ? "" : tekst, filters, offset: 0 });
      });
    }
  }

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

  // ---- aanvinken en archiveren in een gerelateerde lijst ----
  if (metVinkjes) {
    const alles = inhoud.querySelector(".vinkalles");
    const vinkjes = [...inhoud.querySelectorAll(".vinkrij")];
    const wegknop = inhoud.querySelector("#rlweg");
    const telling = inhoud.querySelector("#rlselectie");

    const gekozen = () => vinkjes.filter((v) => v.checked).map((v) => Number(v.dataset.id));

    const bijwerken = () => {
      const n = gekozen().length;
      if (wegknop) wegknop.classList.toggle("onzichtbaar", n === 0);
      if (telling) telling.textContent = n === 0 ? "" : `${n} aangevinkt`;
      if (alles) alles.checked = n > 0 && n === vinkjes.length;
      vinkjes.forEach((v) => v.closest("tr").classList.toggle("gekozen", v.checked));
    };

    vinkjes.forEach((v) => v.addEventListener("change", bijwerken));
    if (alles) {
      alles.addEventListener("change", () => {
        vinkjes.forEach((v) => { v.checked = alles.checked; });
        bijwerken();
      });
    }

    if (wegknop) {
      // Geen tussenvraag: je hebt al aangevinkt en op de prullenbak geklikt.
      // Archiveren is ook niet onomkeerbaar — de regels blijven bestaan en
      // staan met wie ze weghaalde in de audit trail.
      wegknop.addEventListener("click", async () => {
        const ids = gekozen();
        if (!ids.length) return;
        wegknop.disabled = true;
        try {
          await archiveer(tabelnaam, ids);
          lijstscherm(inhoud, kruimel, tabelnaam, meta, { ...toestand, offset: 0 });
        } catch (fout) {
          wegknop.disabled = false;
          meld(fout.message, "fouttekst");
        }
      });
    }
  }

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
      if (el.dataset.vast) {
        const idfilters = { ...(toestand.idfilters || {}) };
        delete idfilters[el.dataset.vast];
        return ga({ idfilters, offset: 0 });
      }
      if (el.dataset.kolom === "__q") return ga({ q: "", offset: 0 });
      const filters = { ...toestand.filters };
      delete filters[el.dataset.kolom];
      ga({ filters, offset: 0 });
    });
  });

  // ---- kolombreedte verslepen ----
  // De breedte wordt per gebruiker onthouden, niet per tabel: het is een
  // voorkeur, geen eigenschap van de gegevens.
  const tabel = inhoud.querySelector(".lijsttabel");
  inhoud.querySelectorAll(".sleepgreep").forEach((greep) => {
    greep.addEventListener("click", (e) => e.stopPropagation());   // niet sorteren
    greep.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const kolom = greep.dataset.sleep;
      // De kolom met de vinkjes staat vooraan in de colgroup maar niet in de
      // kolomlijst. Zonder die verschuiving versleep je de buurman.
      const index = kolommen.findIndex((k) => k.kolom === kolom) + (metVinkjes ? 1 : 0);
      const col = tabel.querySelectorAll("col")[index];
      const beginX = e.clientX;
      const beginBreedte = col.getBoundingClientRect().width;
      document.body.classList.add("sleept");

      const beweeg = (ev) => {
        const nieuw = Math.max(70, Math.round(beginBreedte + ev.clientX - beginX));
        col.style.width = `${nieuw}px`;
      };
      const los = async () => {
        document.removeEventListener("mousemove", beweeg);
        document.removeEventListener("mouseup", los);
        document.body.classList.remove("sleept");
        const breedte = Math.round(col.getBoundingClientRect().width);
        onthoudBreedte(tabelnaam, kolom, breedte);
      };
      document.addEventListener("mousemove", beweeg);
      document.addEventListener("mouseup", los);
    });
  });

  // ---- bewerken in de lijst ----
  // Dubbelklikken opent de hele regel, niet één cel: je verandert zelden maar
  // één ding. Tab loopt door de velden, Enter slaat alles in één keer op,
  // Escape zet de regel terug. Het opslaan draagt de revisie mee — heeft
  // iemand anders intussen opgeslagen, dan zie je dat in plaats van zijn werk
  // te overschrijven.
  const bewerkbaar = kolommen.filter((k) => !k.alleen_lezen);
  let regelInBewerking = null;

  function openRegel(rij, beginKolom) {
    if (regelInBewerking) return;
    const id = Number(rij.dataset.id);
    const rijgegevens = data.rijen.find((r) => r.id === id);
    if (!rijgegevens) return;

    const cellen = [];
    for (const cel of rij.querySelectorAll("td[data-kolom]")) {
      const veld = kolommen.find((k) => k.kolom === cel.dataset.kolom);
      if (!veld || veld.alleen_lezen) continue;
      cellen.push({ cel, veld, oudeHtml: cel.innerHTML, oudeWaarde: rijgegevens[veld.kolom] ?? null });
      cel.classList.add("bewerkt");
      cel.innerHTML = invoer(veld, rijgegevens[veld.kolom] ?? null, meta, 'class="celinvoer"');
    }
    if (!cellen.length) return;

    rij.classList.add("regelbewerkt");
    regelInBewerking = { rij, id, rijgegevens, cellen, klaar: false };

    const eerste = cellen.find((c) => c.veld.kolom === beginKolom) || cellen[0];
    const el = eerste.cel.querySelector("[data-kolom]");
    if (el) { el.focus(); if (el.select) el.select(); }

    rij.addEventListener("keydown", opKeydown);
    setTimeout(() => document.addEventListener("mousedown", opKlikBuiten), 0);
  }

  function herstelRegel() {
    if (!regelInBewerking) return;
    const { rij, cellen } = regelInBewerking;
    for (const c of cellen) {
      c.cel.classList.remove("bewerkt", "bezigcel");
      c.cel.innerHTML = c.oudeHtml;
    }
    rij.classList.remove("regelbewerkt");
    sluitAf();
  }

  function sluitAf() {
    if (!regelInBewerking) return;
    regelInBewerking.rij.removeEventListener("keydown", opKeydown);
    document.removeEventListener("mousedown", opKlikBuiten);
    regelInBewerking = null;
  }

  function opKlikBuiten(e) {
    if (!regelInBewerking) return;
    if (regelInBewerking.rij.contains(e.target)) return;
    bewaarRegel();
  }

  function opKeydown(e) {
    if (!regelInBewerking) return;
    if (e.key === "Escape") { e.preventDefault(); herstelRegel(); return; }
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); bewaarRegel(); }
  }

  async function bewaarRegel() {
    if (!regelInBewerking || regelInBewerking.klaar) return;
    regelInBewerking.klaar = true;
    const { rij, id, rijgegevens, cellen } = regelInBewerking;

    const gewijzigd = {};
    for (const c of cellen) {
      const el = c.cel.querySelector("[data-kolom]");
      if (!el) continue;
      const nieuweWaarde = el.value === "" ? null : el.value;
      if (String(nieuweWaarde ?? "") !== String(c.oudeWaarde ?? "")) gewijzigd[c.veld.kolom] = nieuweWaarde;
      c.nieuweWaarde = nieuweWaarde;
    }

    if (!Object.keys(gewijzigd).length) return herstelRegel();

    cellen.forEach((c) => c.cel.classList.add("bezigcel"));
    try {
      const uitkomst = await bewaar(tabelnaam, id, gewijzigd, rijgegevens.revisie);
      rijgegevens.revisie = uitkomst.revisie ?? rijgegevens.revisie;

      for (const c of cellen) {
        rijgegevens[c.veld.kolom] = c.nieuweWaarde;
        c.cel.classList.remove("bewerkt", "bezigcel");
        const getoond = waarde(c.veld, c.nieuweWaarde, meta, rijgegevens, data.verwijzingen || {});
        // De eerste kolom blijft de ingang naar het record; na het bewerken
        // moet die link er dus weer omheen.
        c.cel.innerHTML = c.cel.cellIndex === (metVinkjes ? 1 : 0)
          ? `<a href="#/t/${tabelnaam}/${id}" class="recordlink">${getoond}</a>`
          : getoond;
        if (c.veld.kolom in gewijzigd) {
          c.cel.classList.add("zojuist");
          setTimeout(() => c.cel.classList.remove("zojuist"), 1200);
        }
      }
      rij.classList.remove("regelbewerkt");
      sluitAf();

      if (uitkomst.waarschuwingen && uitkomst.waarschuwingen.length) {
        meld(uitkomst.waarschuwingen[0].melding, "waarschuwing");
      }
      // Een wijziging kan de fase laten opschuiven of een andere regel raken;
      // dan klopt de lijst alleen nog als hij opnieuw kijkt.
      if (uitkomst.gewijzigd && uitkomst.gewijzigd.includes("status")) {
        lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand);
      }
    } catch (fout) {
      cellen.forEach((c) => c.cel.classList.remove("bezigcel"));
      herstelRegel();
      meld(fout.message, "fouttekst");
      if (String(fout.message).includes("intussen")) {
        lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand);
      }
    }
  }

  if (bewerkbaar.length) {
    inhoud.querySelectorAll("tbody tr[data-id]").forEach((rij) => {
      rij.addEventListener("dblclick", (e) => {
        const cel = e.target.closest("td[data-kolom]");
        openRegel(rij, cel ? cel.dataset.kolom : null);
      });
    });
  }

  // De cursor terug in het veld waar hij stond, anders is typen onmogelijk.
  if (laatsteFocus === "q" && zoek) {
    zoek.focus();
    zoek.setSelectionRange(zoek.value.length, zoek.value.length);
  } else if (laatsteFocus) {
    const el = inhoud.querySelector(`.zoekregel input[data-kolom="${laatsteFocus}"]`);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  laatsteFocus = null;
}


// ---------------------------------------------------------- kolombreedtes
// Eén keer per tabel ophalen en daarna in het geheugen houden, zodat het
// slepen niet bij elke rij opnieuw een verzoek doet.
const breedteCache = {};

async function eigenBreedtes(tabelnaam) {
  if (breedteCache[tabelnaam]) return breedteCache[tabelnaam];
  try {
    const { waarde } = await leesVoorkeur(`lijst.${tabelnaam}.breedtes`);
    breedteCache[tabelnaam] = waarde || {};
  } catch {
    breedteCache[tabelnaam] = {};
  }
  return breedteCache[tabelnaam];
}

let bewaarKlok = null;
function onthoudBreedte(tabelnaam, kolom, breedte) {
  breedteCache[tabelnaam] = { ...(breedteCache[tabelnaam] || {}), [kolom]: breedte };
  clearTimeout(bewaarKlok);
  bewaarKlok = setTimeout(() => {
    zetVoorkeur(`lijst.${tabelnaam}.breedtes`, breedteCache[tabelnaam]).catch(() => {});
  }, 400);
}
