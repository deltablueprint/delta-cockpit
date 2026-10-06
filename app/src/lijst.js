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

import { lijst as haalLijst, bewaar, bewaarSamen, maakAan, archiveer, leesVoorkeur, zetVoorkeur } from "./api.js";
import { favorietenKaart, wisselFavoriet, STERTJE } from "./navtabs.js";
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
let nieuwFocus = null;     // in welke kolom van de toevoegregel de cursor stond

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
  // Nul is bij een vlag en bij 'actief' een antwoord, geen leegte.
  if ((w === null || w === undefined || w === "") && !["vlag", "actief"].includes(veld.type)) {
    return `<span class="faint">&mdash;</span>`;
  }
  if (veld.type === "vlag" || veld.type === "actief") return lees(veld, w, meta, {}, rij);
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
  if (veld.type === "procent") return `${Number(w).toLocaleString("nl-BE", { maximumFractionDigits: 2 })} %`;
  if (veld.type === "bedrag") return `€ ${Number(w).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (veld.type === "datum") return datum(w);
  if (veld.type === "tijdstip") return `${datum(w)} ${String(w).slice(11, 16)}`;
  return ontsnap(w);
}

const rechtsUit = (veld) =>
  ["getal", "datum", "tijdstip", "procent", "bedrag"].includes(veld.type) || veld.kolom.endsWith("_pt");

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
    archief: p.get("archief") === "alles" ? "alles" : "actief",
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
  if (t.archief === "alles") p.set("archief", "alles");
  const vraag = p.toString();
  return `#/t/${tabelnaam}${vraag ? "?" + vraag : ""}`;
}

// ------------------------------------------------------------------- tekenen
// ------------------------------------------------------------ zelf verversen
// Een gerelateerde lijst onder een record is een venster op wat er elders
// gebeurt: de brug meldt een tranche, iemand anders vult een exitregel aan.
// Dat hoort te verschijnen zonder dat je het scherm herlaadt. Daarom kijkt de
// lijst elke tien seconden opnieuw, en hertekent ze alleen als de rijen écht
// anders zijn — anders knippert ze onder je handen weg terwijl je leest.
const KLOKJE = new WeakMap();      // per vak: de lopende klok
let stilleData = null;             // rijen die al binnen zijn, voor een stille verversing

// Wat de lijst nu toont, in één reeks tekens. Verandert die niet, dan is er
// niets te hertekenen: één vergelijking in plaats van een scherm vol werk.
function vingerafdruk(data) {
  return JSON.stringify([data.totaal, (data.rijen || []).map((r) => Object.values(r))]);
}

function paramsVoor(tabelnaam, toestand) {
  const params = new URLSearchParams();
  if (toestand.q) params.set("q", toestand.q);
  if (toestand.sorteer) { params.set("sorteer", toestand.sorteer); params.set("richting", toestand.richting); }
  if (toestand.offset) params.set("offset", String(toestand.offset));
  params.set("limiet", String(PAGINA));
  for (const [k, v] of Object.entries(toestand.filters || {})) if (v) params.set(`f.${k}`, v);
  for (const [k, v] of Object.entries(toestand.idfilters || {})) if (v) params.set(`fid.${k}`, v);
  // Een lijstscherm uit het menu staat standaard op wat actief is, met de kolom
  // erbij die dat zegt. Klik je dat filter weg, dan zie je ook het archief. Een
  // gerelateerde lijst onder een record kent die keuze niet: daar hoort wat er
  // nú hangt.
  if (!toestand.ingebed) params.set("archief", toestand.archief === "alles" ? "alles" : "actief");
  return params;
}

function versKlokje(inhoud, tabelnaam, meta, toestand, afdruk) {
  clearInterval(KLOKJE.get(inhoud));
  const klok = setInterval(async () => {
    // Het scherm is weg: dan is er niets meer om bij te werken.
    if (!inhoud.isConnected) { clearInterval(klok); KLOKJE.delete(inhoud); return; }
    // Staat het tabblad op de achtergrond, of staat je cursor in deze lijst —
    // in de toevoegregel, in een cel die je aan het bewerken bent — dan wacht
    // de verversing. Wegklikken waar iemand in typt is het ergste wat een
    // zelfverversend scherm kan doen.
    if (document.hidden) return;
    if (inhoud.contains(document.activeElement)) return;
    let verse;
    try { verse = await haalLijst(tabelnaam, paramsVoor(tabelnaam, toestand)); } catch { return; }
    if (vingerafdruk(verse) === afdruk) return;
    if (!inhoud.isConnected || inhoud.contains(document.activeElement)) return;
    clearInterval(klok);
    KLOKJE.delete(inhoud);
    // De rijen zijn al binnen; ze nog een keer ophalen zou de lijst even grijs
    // maken voor niets.
    stilleData = { vak: inhoud, data: verse };
    lijstscherm(inhoud, { textContent: "" }, tabelnaam, meta, toestand);
    // Een nieuwe regel kan de stand van het proces verzetten; de checklist
    // erboven hoort dat mee te krijgen.
    if (toestand.ingebed && typeof toestand.ingebed.naWijziging === "function") toestand.ingebed.naWijziging();
  }, 10000);
  KLOKJE.set(inhoud, klok);
}

export async function lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand) {
  const params = paramsVoor(tabelnaam, toestand);
  // Komen de rijen van de stille verversing, dan staan ze er al.
  const stil = stilleData && stilleData.vak === inhoud ? stilleData : null;
  stilleData = null;
  // Alleen een lijst die rechtstreeks in dit vak staat telt als 'dezelfde
  // lijst'. Stond er een recordscherm met een gerelateerde lijst erin, dan
  // werd díé even grijs gemaakt voordat het scherm verwisselde — dat zag je
  // als een flikkering bij het klikken op Cycli.
  // Een gerelateerde lijst krijgt geen kaartje 'Bezig met laden' dat even later
  // door de tabel vervangen wordt: dat is de flikkering die je ziet als je een
  // record opent. In plaats daarvan staat er meteen een leeg lijstvak van de
  // juiste hoogte, met het dunne lijntje erboven dat zegt dat er iets onderweg
  // is. Er verschijnt dus één ding, en dat vult zich.
  // Er mag maar één ding in dit vak verschijnen: de lijst zelf. Zette je er
  // eerst een kaartje of een leeg omlijnd vak neer, dan zag je dat als een
  // flikkering zodra de tabel het verving. Tijdens het wachten blijft het vak
  // dus leeg; alleen het dunne lijntje bovenaan zegt dat er iets onderweg is.
  // Er mag maar één ding in dit vak verschijnen: de lijst zelf.
  //
  // Staat er al een lijst, dan blijft die staan en zegt een dun lijntje erboven
  // dat er iets onderweg is — dat is sorteren of filteren, en dan wil je zien
  // waar je vandaan komt. Is het vak nog leeg, dan komt er tijdens het wachten
  // ook niets in: een laadkaartje, een omlijnd vak of een lopend lijntje dat
  // even later verdwijnt, lees je allemaal als een flikkering. Het vak houdt
  // zijn hoogte vast en vult zich in één keer.
  const bestaand = inhoud.querySelector(":scope > .lijst");
  if (!stil) {
    if (bestaand) bestaand.classList.add("bezig");
    else { inhoud.innerHTML = ""; inhoud.classList.add("wachtlijst"); }
  }

  let data = stil ? stil.data : null;
  if (!data) {
    try {
      data = await haalLijst(tabelnaam, params);
    } catch (fout) {
      inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
      return;
    }
  }

  inhoud.classList.remove("wachtlijst");

  if (!toestand.ingebed) {
    kruimel.textContent = data.tabel.label_mv;
    document.title = `${data.tabel.label_mv} · Delta Wave Cockpit`;
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
      ${data.tabel.nieuw_vanuit_lijst ? `<a class="knop" href="#/t/${tabelnaam}/nieuw">Nieuw</a>` : ""}
      ${data.tabel.import_toegestaan ? `<a class="knop tweede" href="#/import/${tabelnaam}">Inlezen uit document</a>` : ""}
      <span class="lijstselectie" id="rlselectie"></span>
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

  // Het standaardfilter draagt zijn eigen chip: zo zie je dát er gefilterd
  // wordt, en haal je het archief erbij met één klik.
  const archiefChip = toestand.ingebed || toestand.archief === "alles" ? "" :
    `<span class="chip">Actief = true
       <button class="chipweg" data-archief aria-label="Ook het archief tonen">&times;</button></span>`;

  const chips = archiefChip + vasteChips + Object.entries(toestand.filters)
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
  const minBreedte = breedtes.reduce((n, b) => n + (parseInt(b, 10) || 180), 0) + 34 + 30;

  // In elke lijst kun je regels aanvinken en archiveren — in een gerelateerde
  // lijst en in het volledige bestand. Verwijderen bestaat niet: een
  // gearchiveerde regel verdwijnt uit beeld maar blijft bestaan, met wie hem
  // weghaalde in de audit trail (hard uitgangspunt 1).
  const metVinkjes = true;
  // Twee kolommen staan vooraan in de tabel maar niet in de kolomlijst: het
  // vinkje en het sterretje. Alles wat met kolomnummers rekent, rekent daarmee.
  const VOORAAN = 2;

  const colgroup = `<colgroup>
      ${metVinkjes ? `<col style="width:34px"><col style="width:30px">` : ""}
      ${breedtes.map((b) => `<col style="width:${ontsnap(b)}">`).join("")}
      <col>
    </colgroup>`;

  // Een kolom met maar twee waarden filter je niet door te typen: je kiest.
  // 'Zoeken' als lege stand betekent 'allebei', net als een leeg zoekvak.
  const zoekvak = (k, waarde) => {
    const keuzes = k.type === "actief" ? [["true", "true"], ["false", "false"]]
                 : k.type === "ja_nee" ? [["ja", "ja"], ["nee", "nee"]]
                 : null;
    if (keuzes) {
      return `<select data-kolom="${k.kolom}" class="${waarde ? "" : "leeg"}"
        aria-label="Filteren op ${ontsnap(k.label)}">
        <option value="">Zoeken</option>
        ${keuzes.map(([w, l]) => `<option value="${w}"${waarde.toLowerCase() === w ? " selected" : ""}>${l}</option>`).join("")}
      </select>`;
    }
    const tip = k.type === "datum" || k.type === "tijdstip"
      ? ' title="Bijvoorbeeld: 2026 · jul · jul 2026 · 6 jul 2026 · 202607 · 6/7/2026"' : "";
    return `<input type="text" data-kolom="${k.kolom}"
      aria-label="Zoeken in ${ontsnap(k.label)}" value="${ontsnap(waarde)}" placeholder="Zoeken"${tip}>`;
  };

  const thead = `
    <thead>
      <tr class="kopregel">
        ${metVinkjes ? `<th class="vink"><input type="checkbox" class="vinkalles" aria-label="Alles aanvinken"></th>
        <th class="sterkol"></th>` : ""}
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
            title="Aangevinkte regels archiveren" aria-label="Aangevinkte regels archiveren">${ICOON.prullenbak}</button></td>
        <td class="sterkol"></td>` : ""}
        ${kolommen.map((k) => `<td>${zoekvak(k, toestand.filters[k.kolom] || "")}</td>`).join("")}
        <td></td>
      </tr>
    </thead>`;

  // Meldingen horen in het scherm, niet in een venster van de browser dat je
  // moet wegklikken voor je verder kunt.
  // Een wijziging hier kan de stand van het proces veranderen; het record
  // waaronder deze lijst hangt, mag dat weten.
  const gewijzigd = () => {
    if (toestand.ingebed && typeof toestand.ingebed.naWijziging === "function") {
      toestand.ingebed.naWijziging();
    }
  };

  const meld = (tekst, soort = "waarschuwing") => {
    const vak = inhoud.querySelector("#lijstmelding");
    if (!vak) return;
    vak.textContent = tekst;
    vak.className = `lijstmelding ${soort}`;
    vak.hidden = false;
    clearTimeout(meld.klok);
    meld.klok = setTimeout(() => { vak.hidden = true; }, 6000);
  };

  // Waar de link naar het record op zit, en waar een favoriet van dit record
  // naar heet: allebei het titelveld, want dát is de naam van de regel. De
  // eerste kolom nemen ging goed zolang die altijd de naam was — tot er een
  // vlag vóór kwam te staan, en een favoriet ineens 'Cyclus: 0' heette.
  const linkkolom = kolommen.some((k) => k.kolom === data.tabel.titel_veld)
    ? data.tabel.titel_veld
    : (kolommen[0] && kolommen[0].kolom);

  const rijnaam = (r) => {
    const veld = kolommen.find((k) => k.kolom === linkkolom);
    const w = veld ? platteTekst(veld, r[veld.kolom], meta, data.verwijzingen || {}) : "";
    return `${data.tabel.label}: ${w || `#${r.id}`}`;
  };

  const ingebed = toestand.ingebed;

  // ---- de toevoegregel ----------------------------------------------------
  // Onderaan elke lijst staat een lege regel. Je typt erin en drukt op Enter,
  // en het record bestaat. De knop *Nieuw* blijft staan voor wie het hele
  // formulier wil, maar voor een voorwaarde of een event is dat een scherm
  // openen, drie velden invullen en terugkomen — terwijl de lijst er al staat.
  // Niet elke tabel leent zich ervoor. Een besluit draagt een datum, een
  // uitkomst, een strike en een inzet, en opent een beoordelingsronde: dat vul
  // je op het formulier in. db_table.inline_nieuw zegt het per tabel (0140).
  const magInline = data.tabel.inline_nieuw === 0 ? false
    : ingebed
      ? ingebed.magNieuw !== false
      : !!data.tabel.nieuw_vanuit_lijst;

  // Wat je in een cel kunt typen. Een verwijzing naar een record kiest je met
  // de loep op het formulier; hier is er niets om in te vullen. Een afbeelding
  // evenmin, en de systeemkolommen al helemaal niet.
  const inlineVeld = (k) => !k.alleen_lezen
    && !["bestand", "vlag", "actief"].includes(k.type)
    && !(k.type === "verwijzing" && k.verwijst_naar !== "gebruiker");

  const eersteInvulbaar = (kolommen.find(inlineVeld) || {}).kolom || null;

  // Een datum typ je hier, je kiest hem niet. Een kalenderknop in elke
  // datumcel maakt van een lege regel een rij knoppen; dd/mm/jjjj is korter
  // getypt dan de kalender open te klikken. Een verplichte datum — 'geopend
  // op' — staat er meteen in: dat is toch vandaag.
  const vandaagNL = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const nieuwcel = (k) => {
    if (!inlineVeld(k)) return "";
    const eerste = k.kolom === eersteInvulbaar;
    if (k.type === "datum") {
      return `<input type="text" data-kolom="${k.kolom}" data-datum="1"
        class="celinvoer${eerste ? " eerste" : ""}" value="${k.verplicht ? vandaagNL() : ""}"
        placeholder="${eerste ? "Nieuw — typ en druk op Enter" : "dd/mm/jjjj"}">`;
    }
    // Een lang veld krijgt hier één regel: de toevoegregel is een regel, geen
    // formulier. Enter slaat op, shift-Enter zet een witregel — anders zou
    // Enter in deze ene cel iets anders doen dan in alle andere.
    if (k.type === "lang") {
      return `<textarea data-kolom="${k.kolom}" rows="1" class="celinvoer${eerste ? " eerste" : ""}"
        placeholder="${eerste ? "Nieuw — typ en druk op Enter" : ""}"></textarea>`;
    }
    const hint = eerste ? ` placeholder="Nieuw — typ en druk op Enter"` : "";
    // De id's uit invoer() zijn bedoeld voor één formulier. Hier staat een hele
    // regel tegelijk, dus krijgen ze een eigen voorvoegsel.
    return invoer(k, null, meta, `class="celinvoer${eerste ? " eerste" : ""}"${hint}`)
      .replace(/id="veld-/g, 'id="nieuwveld-');
  };

  const nieuwregel = !magInline ? "" : `
    <tr class="nieuwregel rust">
      ${metVinkjes ? `<td class="vink"></td><td class="sterkol"></td>` : ""}
      ${kolommen.map((k) => `<td data-kolom="${k.kolom}" class="${rechtsUit(k) ? "rechts" : ""}">${nieuwcel(k)}</td>`).join("")}
      <td class="vuller"></td>
    </tr>`;

  const tbody = tot === 0
    ? `<tbody><tr><td colspan="${kolommen.length + (metVinkjes ? 3 : 1)}" class="geenregels">
         ${(toestand.ingebed ? toestand.q : toestand.q || chips) ? "Geen regels die hieraan voldoen." : `Nog geen ${ontsnap(data.tabel.label_mv.toLowerCase())}.`}
       </td></tr>${nieuwregel}</tbody>`
    : `<tbody>${data.rijen.map((r) => `
        <tr data-id="${r.id}">
          ${metVinkjes ? `<td class="vink"><input type="checkbox" class="vinkrij" data-id="${r.id}" aria-label="Deze regel aanvinken"></td>
          <td class="sterkol"><button class="rijster" type="button" data-id="${r.id}"
            data-naam="${ontsnap(rijnaam(r))}"
            title="Toevoegen aan favorieten" aria-label="Toevoegen aan favorieten">${STERTJE}</button></td>` : ""}
          ${kolommen.map((k, i) => {
            const tip = platteTekst(k, r[k.kolom], meta, data.verwijzingen || {});
            return `<td data-kolom="${k.kolom}" class="${rechtsUit(k) ? "rechts " : ""}${toestand.sorteer === k.kolom ? "gesorteerd" : ""}"${tip ? ` title="${ontsnap(tip)}"` : ""}>${
              k.kolom === linkkolom
                // Uit de volledige lijst draagt de link mee waar je vandaan komt, zodat
              // de kruimelbalk op het record jouw weg toont en niet de ouderketen.
              ? `<a href="#/t/${tabelnaam}/${r.id}${ingebed ? "" : `?van=${tabelnaam}`}" class="recordlink">${
                  waarde(k, r[k.kolom], meta, r, data.verwijzingen || {})}</a>`
                : waarde(k, r[k.kolom], meta, r, data.verwijzingen || {})
            }</td>`;
          }).join("")}
          <td class="vuller"></td>
        </tr>`).join("")}${nieuwregel}</tbody>`;

  // De kop van een gerelateerde lijst draagt de naam en de knop, verder niets.
  // Een teller ('4 voorwaarden') herhaalt wat je ziet, en een zinnetje waarom
  // er geen knop staat leest niemand twee keer.
  const relatiekop = !ingebed ? "" : `
    <div class="rlkop">
      <span class="rltitel">${ontsnap(ingebed.label || data.tabel.label_mv)}</span>
      ${ingebed.magNieuw === false ? ""
        : ingebed.direct
          ? `<button class="knop" id="rldirect">Nieuw</button>`
          : `<a class="knop" href="#/t/${tabelnaam}/nieuw?ouder=${ingebed.ouder.tabel}:${ingebed.ouder.id}">Nieuw</a>`}
      ${ingebed.overnemen ? `<button class="knop tweede" id="rlovernemen">Overnemen uit een eerdere cyclus</button>` : ""}
      <span class="rlselectie" id="rlselectie"></span>
    </div>`;

  inhoud.innerHTML = (ingebed ? "" : `
    <div class="titelrij">
      <h1>${ontsnap(data.tabel.label_mv)}</h1>
      <span class="sub">${tot} ${tot === 1 ? "regel" : "regels"}</span>
    </div>`) + `
    <div class="lijst${ingebed ? " ingebed" : ""}">${relatiekop}${ingebed ? "" : toolbar}${filterrij}
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

  // Vanaf hier kijkt deze lijst zelf of er iets bijgekomen is. Alleen onder een
  // record: een lijstscherm uit het menu heeft een werkbalk waarin je zit te
  // zoeken en te bladeren, en dat hoort niemand onder je handen te verzetten.
  if (ingebed) versKlokje(inhoud, tabelnaam, meta, toestand, vingerafdruk(data));
  else { clearInterval(KLOKJE.get(inhoud)); KLOKJE.delete(inhoud); }

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

  inhoud.querySelectorAll(".zoekregel select").forEach((el) => {
    el.addEventListener("change", () => {
      const filters = { ...toestand.filters };
      const v = el.value.trim();
      if (v) filters[el.dataset.kolom] = v; else delete filters[el.dataset.kolom];
      ga({ filters, offset: 0 });
    });
  });

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

  // ---- het sterretje per regel ----
  // Een record dat je vaker nodig hebt, zet je hier bij je favorieten. De route
  // is die van het record zelf, dus de favoriet brengt je er rechtstreeks heen.
  const sterren = [...inhoud.querySelectorAll(".rijster")];
  if (sterren.length) {
    const route = (id) => `/t/${tabelnaam}/${id}`;
    favorietenKaart().then((kaart) => {
      sterren.forEach((s) => s.classList.toggle("vast", kaart.has(route(s.dataset.id))));
    }).catch(() => {});

    sterren.forEach((ster) => {
      ster.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        ster.disabled = true;
        try {
          const nu = await wisselFavoriet(route(ster.dataset.id), ster.dataset.naam);
          ster.classList.toggle("vast", nu);
          ster.title = nu ? "Weghalen uit favorieten" : "Toevoegen aan favorieten";
        } catch (fout) {
          meld(fout.message, "fouttekst");
        }
        ster.disabled = false;
      });
    });
  }

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
          gewijzigd();
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
      // Het standaardfilter weghalen betekent: ook het archief erbij.
      if (el.dataset.archief !== undefined) return ga({ archief: "alles", offset: 0 });
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
      const index = kolommen.findIndex((k) => k.kolom === kolom) + (metVinkjes ? VOORAAN : 0);
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

  // Een tabel die niets vooraf nodig heeft, maakt het record meteen aan en
  // opent het: een leeg formulier met een knop *Aanmaken* is dan een extra
  // handeling zonder inhoud.
  const direct = inhoud.querySelector("#rldirect");
  if (direct && ingebed) {
    direct.addEventListener("click", async () => {
      direct.disabled = true;
      try {
        const gemaakt = await maakAan(tabelnaam, { [ingebed.kolom]: String(ingebed.ouder.id) }, ingebed.kolom);
        location.hash = `/t/${tabelnaam}/${gemaakt.id}`;
      } catch (fout) {
        direct.disabled = false;
        meld(fout.message, "fouttekst");
      }
    });
  }

  // ---- de toevoegregel: typen en Enter ----
  const toevoeg = inhoud.querySelector("tr.nieuwregel");
  if (toevoeg) {
    const vakken = () => [...toevoeg.querySelectorAll("[data-kolom]")];

    // dd/mm/jjjj is wat je typt; de database wil jjjj-mm-dd. Een datum die er
    // niet als een datum uitziet gaat door zoals getypt — dan zegt de worker
    // wat er mis is, in plaats van dat de lijst stilletjes iets anders opslaat.
    const naarISO = (w) => {
      const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(w);
      if (!m) return w;
      const jaar = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${jaar}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    };

    const ingevuld = () => {
      const velden = {};
      for (const el of vakken()) {
        const w = String(el.value ?? "").trim();
        if (w === "") continue;
        velden[el.dataset.kolom] = el.dataset.datum ? naarISO(w) : w;
      }
      return velden;
    };

    // De regel ligt te rusten tot je begint te typen: dan is hij één
    // uitnodiging in plaats van een rij lege vakken onder elke lijst. Zodra er
    // iets staat, komen de andere kolommen erbij.
    const anderen = () => vakken().filter((el) => !el.classList.contains("eerste"));
    const rusten = (ja) => {
      toevoeg.classList.toggle("rust", ja);
      for (const el of anderen()) el.tabIndex = ja ? -1 : 0;
    };
    rusten(true);
    const eerste = toevoeg.querySelector(".eerste");
    if (eerste) eerste.addEventListener("input", () => rusten(eerste.value.trim() === ""));

    const leegmaken = () => {
      for (const el of vakken()) {
        if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
      }
      rusten(true);
    };

    let bezig = false;
    const aanmaken = async (vanuit) => {
      if (bezig) return;
      const velden = ingevuld();
      // Een regel die nergens uit bestaat is geen regel. Enter in een lege
      // toevoegregel doet dus niets, in plaats van een leeg record te maken.
      if (!Object.keys(velden).length) return;
      bezig = true;
      toevoeg.classList.add("bezigrij");
      try {
        if (ingebed) velden[ingebed.kolom] = String(ingebed.ouder.id);
        await maakAan(tabelnaam, velden, ingebed ? ingebed.kolom : undefined);
        leegmaken();
        gewijzigd();
        // De cursor blijft staan waar je typte, zodat je regel na regel kunt
        // doorgaan zonder opnieuw te mikken.
        nieuwFocus = vanuit || eersteInvulbaar;
        await lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand);
      } catch (fout) {
        bezig = false;
        toevoeg.classList.remove("bezigrij");
        meld(fout.message, "fouttekst");
      }
    };

    toevoeg.addEventListener("keydown", (e) => {
      // Enter maakt de regel aan — ook in een tekstvak, want dat is wat je hier
      // verwacht. Een witregel typ je met shift-Enter.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        aanmaken(e.target.dataset ? e.target.dataset.kolom : null);
      }
      if (e.key === "Escape") leegmaken();
    });
  }

  // ---- cellen kiezen en in één keer zetten ----
  // Cmd- of ctrl-klik kiest losse cellen, shift-klik een reeks — altijd binnen
  // één kolom, want een waarde hoort bij een kolom. Bewerk je daarna één van
  // die cellen, dan gaat dezelfde waarde naar alle gekozen regels. Zo zet je
  // tien events in één handeling op 'zwaar' in plaats van tien keer hetzelfde
  // te doen.
  const keuze = { kolom: null, ids: new Set(), laatste: null };

  const toonKeuze = () => {
    inhoud.querySelectorAll("tbody td[data-kolom]").forEach((cel) => {
      const rij = cel.closest("tr");
      const gekozen = keuze.kolom === cel.dataset.kolom && keuze.ids.has(Number(rij.dataset.id));
      cel.classList.toggle("celgekozen", gekozen);
    });
  };

  const wisKeuze = () => {
    keuze.kolom = null;
    keuze.ids.clear();
    keuze.laatste = null;
    toonKeuze();
  };

  const rijVolgorde = () => data.rijen.map((r) => r.id);

  inhoud.querySelectorAll("tbody td[data-kolom]").forEach((cel) => {
    cel.addEventListener("click", (e) => {
      const kolom = cel.dataset.kolom;
      const veld = kolommen.find((k) => k.kolom === kolom);
      const id = Number(cel.closest("tr").dataset.id);
      if (!veld || veld.alleen_lezen) return;

      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        if (keuze.kolom !== kolom) { keuze.kolom = kolom; keuze.ids.clear(); }
        if (keuze.ids.has(id)) keuze.ids.delete(id); else keuze.ids.add(id);
        keuze.laatste = id;
        toonKeuze();
        return;
      }

      if (e.shiftKey) {
        e.preventDefault();
        const volgorde = rijVolgorde();
        if (keuze.kolom !== kolom || keuze.laatste === null) {
          keuze.kolom = kolom;
          keuze.ids = new Set([id]);
          keuze.laatste = id;
        } else {
          const van = volgorde.indexOf(keuze.laatste);
          const tot = volgorde.indexOf(id);
          const [a, b] = van < tot ? [van, tot] : [tot, van];
          for (let i = a; i <= b; i++) keuze.ids.add(volgorde[i]);
        }
        toonKeuze();
        return;
      }

      // Een gewone klik op een cel die al gekozen is, laat de keuze staan:
      // dubbelklikken is twee klikken, en anders was de keuze weg vóór het
      // bewerken begon. Klik je ergens anders, dan vervalt ze.
      if (keuze.kolom === kolom && keuze.ids.has(id)) return;
      if (keuze.ids.size) wisKeuze();
    });
  });

  // ---- bewerken in de lijst ----
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

      // Hoort deze cel bij een keuze in dezelfde kolom, dan gaat de waarde naar
      // alle gekozen regels.
      const samenMet = keuze.kolom === kolom && keuze.ids.has(id)
        ? [...keuze.ids]
        : [id];

      cel.classList.add("bewerkt");
      cel.innerHTML = invoer(veld, oudeWaarde, meta, 'class="celinvoer"');
      const el = cel.querySelector("[data-kolom]");
      el.focus();
      if (el.select) el.select();

      let klaar = false;
      const herstel = () => { cel.classList.remove("bewerkt"); cel.innerHTML = oudeHtml; };

      const toonCel = (doelcel, doelrij, nieuweWaarde) => {
        doelcel.classList.remove("bewerkt", "bezigcel", "celgekozen");
        const getoond = waarde(veld, nieuweWaarde, meta, doelrij, data.verwijzingen || {});
        doelcel.innerHTML = doelcel.cellIndex === (metVinkjes ? VOORAAN : 0)
          ? `<a href="#/t/${tabelnaam}/${doelrij.id}" class="recordlink">${getoond}</a>`
          : getoond;
        doelcel.classList.add("zojuist");
        setTimeout(() => doelcel.classList.remove("zojuist"), 1200);
      };

      const opslaan = async () => {
        if (klaar) return;
        klaar = true;
        const nieuweWaarde = el.value === "" ? null : el.value;
        if (samenMet.length === 1 && String(nieuweWaarde ?? "") === String(oudeWaarde ?? "")) return herstel();

        cel.classList.add("bezigcel");
        try {
          if (samenMet.length > 1) {
            const revisies = {};
            for (const d of samenMet) {
              const r = data.rijen.find((x) => x.id === d);
              if (r) revisies[d] = r.revisie;
            }
            const uitkomst = await bewaarSamen(tabelnaam, samenMet, { [kolom]: nieuweWaarde }, revisies);
            for (const g of uitkomst.gelukt) {
              const r = data.rijen.find((x) => x.id === g.id);
              if (!r) continue;
              r[kolom] = nieuweWaarde;
              r.revisie = g.revisie ?? r.revisie;
              const doelcel = inhoud.querySelector(`tr[data-id="${g.id}"] td[data-kolom="${kolom}"]`);
              if (doelcel) toonCel(doelcel, r, nieuweWaarde);
            }
            wisKeuze();
            gewijzigd();
            if (uitkomst.mislukt.length) {
              meld(`${uitkomst.gelukt.length} aangepast, ${uitkomst.mislukt.length} niet: ${uitkomst.mislukt[0].fout}`, "fouttekst");
            } else {
              meld(`${uitkomst.gelukt.length} regels aangepast.`, "waarschuwing");
            }
            return;
          }

          const uitkomst = await bewaar(tabelnaam, id, { [kolom]: nieuweWaarde }, rijgegevens?.revisie);
          if (rijgegevens) {
            rijgegevens[kolom] = nieuweWaarde;
            rijgegevens.revisie = uitkomst.revisie ?? rijgegevens.revisie;
          }
          toonCel(cel, rijgegevens || { id }, nieuweWaarde);
          gewijzigd();
          if (uitkomst.waarschuwingen && uitkomst.waarschuwingen.length) {
            meld(uitkomst.waarschuwingen[0].melding, "waarschuwing");
          }
        } catch (fout) {
          cel.classList.remove("bezigcel");
          herstel();
          meld(fout.message, "fouttekst");
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
      // Een keuze of een datum aanklikken ís de wijziging: daar hoort geen
      // tweede handeling meer achteraan. Bij vrije tekst blijft het bij
      // wegklikken of Enter, anders zou hij bij elke letter opslaan.
      el.addEventListener("change", opslaan);
    });
  });

  // De cursor terug in het veld waar hij stond, anders is typen onmogelijk.
  if (nieuwFocus) {
    const el = inhoud.querySelector(`tr.nieuwregel [data-kolom="${nieuwFocus}"]`);
    nieuwFocus = null;
    if (el) { el.focus(); laatsteFocus = null; return; }
  }
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
