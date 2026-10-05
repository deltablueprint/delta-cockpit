// De balk van één tranche, en de cijfers eronder.
//
// Eén renderer, twee schermen: Dispatch tekent hem per positie in de lijst, het
// positierecord tekent hem bovenaan. Twee tekeningen van dezelfde meting zouden
// uit elkaar gaan lopen, en dan staat er op het ene scherm iets anders dan op
// het andere over dezelfde tranche.
//
// Het rekenwerk zit niet hier maar in worker/meting.js: wat hier binnenkomt is
// al gemeten. De balk loopt van verlies links naar winst rechts — de ask daalt
// naar rechts, want een geschreven optie die goedkoper wordt is winst.
export const KLEUR = ["#D7261E", "#F26A21", "#FBC02D", "#8DC63F", "#0A9D4E"];
export const DIEPROOD = "#9A1C16";   // het smalle stuk voorbij de stoploss

const ontsnap = (t) =>
  String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const leeg = (n) => n === null || n === undefined || String(n).trim() === "";
export const getal = (n) =>
  (!leeg(n) && Number.isFinite(Number(n)) ? Number(n).toFixed(1).replace(".", ",") : "—");
export const getalMet = (n, cijfers = 1) => {
  if (leeg(n) || !Number.isFinite(Number(n))) return "—";
  const w = Number(n);
  // Een echt minteken, geen koppelteken: dat laatste leest als een streepje.
  return `${w > 0 ? "+" : w < 0 ? "−" : ""}${Math.abs(w).toFixed(cijfers).replace(".", ",")}`;
};

// De vakken met de markering erop. 'dof' voor een tranche die niet meer loopt.
export function balkHtml(p, vakken = []) {
  const vakjes = vakken.map((v) => {
    const breed = v.tot - v.van;
    const kleur = v.stand === 0 ? DIEPROOD : KLEUR[v.stand - 1];
    return `<span class="z" style="flex:0 0 calc(${breed.toFixed(2)}% - 3px);background:${kleur};opacity:${p.open ? 0.9 : 0.4}"></span>`;
  }).join("");

  const merker = p.plek === null || p.plek === undefined ? ""
    : `<span class="merkerlab" style="left:${Math.max(2, Math.min(98, p.plek))}%">${
        p.binnen === null ? getal(p.ask) : `${getalMet(p.binnen, 0)} %`}</span><span class="merker" style="left:calc(${
        Math.max(1, Math.min(99, p.plek))}% - 1.5px)"></span>`;

  return `<span class="spoorbalk">${vakjes}${merker}</span>`;
}

// De schaal eronder: dezelfde plekken als de vakken, met de ask-niveaus erbij.
export function schaalHtml(vakken = [], ijk = null) {
  const grens = ijk ? [null, ijk.stoploss, ijk.waarschuwing, ijk.breakeven, ijk.helft, ijk.winstanker] : [];
  const schaal = vakken.map((v, i) => {
    const breed = v.tot - v.van;
    // Het smalle stuk voorbij de stoploss draagt geen label: te smal voor een
    // woord, en de dieprode kleur zegt het al.
    const label = !ijk ? v.naam : i === 0 ? "" : `${getal(grens[i])}`;
    return `<span style="flex:0 0 calc(${breed.toFixed(2)}% - 3px)">${ontsnap(label)}</span>`;
  }).join("");
  return `<div class="schaalrij"><span class="schaal">${schaal}</span></div>`;
}

export function standBadge(p, naam) {
  if (p.voorbij_de_grens) return `<span class="badge" style="background:${DIEPROOD}">Voorbij de stoploss</span>`;
  if (p.stand) return `<span class="badge" style="background:${KLEUR[p.stand - 1]}">${ontsnap(naam || p.stand)}</span>`;
  return `<span class="badge" style="background:var(--dim)">${p.open ? "niet gemeten" : "Afgerond"}</span>`;
}

// De vijf cijfers van een tranche. Geen geschreven tekst: metrics.
export function metriekHtml(p) {
  const feit = (l, w, n) => `<span class="dfeit"><span class="dlab">${ontsnap(l)}</span>
    <span class="dwaarde">${ontsnap(w)}</span>${n ? `<span class="dnoot">${ontsnap(n)}</span>` : ""}</span>`;
  // Vijf getallen, en verder niets. Wat eronder stond — 'bod 50,0', 'prijs 9 min
  // oud', '22 % van het kapitaal' — herhaalde wat elders al staat of was een
  // tweede getal naast het getal, en op een scherm dat je elke dag opent is dat
  // ruis. Wat je wil weten: wat kwam er binnen, wat staat er open, waartegen
  // kwam je erin, waartegen kom je eruit, en hoe lang nog.
  // Een ontvangen premie is altijd positief; daar hoort geen plusteken bij.
  const euro = (n) => (n === null || n === undefined || !Number.isFinite(Number(n))
    ? "—" : `${Number(n) < 0 ? "\u2212 " : ""}€ ${Math.abs(Number(n)).toFixed(0)}`);

  return `<div class="dvak">
    <div class="dfeiten">
      ${feit("Totale premie", euro(p.premie_eur))}
      ${feit("Netto niet gerealiseerd", p.binnen === null || p.binnen === undefined
        ? "—" : `${getalMet(p.binnen, 0)} %`)}
      ${feit("Verkocht tegen", getal(p.premie))}
      ${feit("Ask nu", getal(p.ask))}
      ${feit("Dagen resterend", p.dagen === null ? "—" : String(p.dagen))}
    </div>
  </div>`;
}
