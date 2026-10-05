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

// De zes cijfers en de balk 'premie binnen'. Geen geschreven tekst: metrics.
// De balk van break-even uit: links verlies tot de stoploss, rechts winst tot
// alles binnen. Het merkteken zit in het midden; de staaf groeit naar de kant
// waar de tranche staat.
function maatBalk(p) {
  if (p.binnen === null || p.binnen === undefined || !Number.isFinite(Number(p.binnen))) return "";
  const b = Number(p.binnen);

  // De linkerrand: bij de stoploss. Zonder ijkpunten valt er niets te schalen —
  // dan houden we honderd procent aan, zodat de balk wel leesbaar blijft.
  const ergst = p.premie > 0 && p.stoploss > 0 ? ((p.premie - p.stoploss) / p.premie) * 100 : -100;
  const deel = b >= 0
    ? Math.min(1, b / 100)
    : Math.min(1, ergst < 0 ? b / ergst : 1);
  const breed = (deel * 50).toFixed(1);

  return `<div class="dbalkrij">
    <span class="dbalklab">Vanaf break-even</span>
    <span class="dmaat">
      <span class="dmaatlijn"></span>
      <i class="${b >= 0 ? "winst" : "verlies"}" style="width:${breed}%"></i>
      <span class="dmaatnul"></span>
      <span class="dmaatrand links">stoploss</span>
      <span class="dmaatrand rechts">alles binnen</span>
    </span>
    <span class="dbalkpct">${getalMet(b, 0)} %</span></div>`;
}

export function metriekHtml(p) {
  const feit = (l, w, n) => `<span class="dfeit"><span class="dlab">${ontsnap(l)}</span>
    <span class="dwaarde">${ontsnap(w)}</span>${n ? `<span class="dnoot">${ontsnap(n)}</span>` : ""}</span>`;
  // De balk met break-even in het midden. Rechts is winst: hoeveel van de premie
  // binnen is, tot alles binnen (ask 0). Links is verlies, tot de stoploss — dat
  // is het punt waarop de tranche gesloten hoort te zijn, en dus de verste rand
  // die iets betekent. Een balk die van nul tot honderd loopt kan het verschil
  // tussen 'net onder break-even' en 'bijna tegen de stoploss' niet tonen.
  const binnen = maatBalk(p);

  return `<div class="dvak">
    <div class="dfeiten">
      ${feit("Premie", getal(p.premie), leeg(p.inzet_pct) ? "" : `${getal(p.inzet_pct)} % van het kapitaal`)}
      ${feit("Ask nu", getal(p.ask), p.ask_is_marktprijs ? "marktprijs" : `bod ${getal(p.bod)}`)}
      ${feit("Open resultaat", getalMet(p.resultaat), p.resultaat_eur === null ? "" : `€ ${getalMet(p.resultaat_eur, 0)}`)}
      ${feit("Break-even", getal(p.breakeven), "ask gelijk aan de premie")}
      ${feit("Stoploss", getal(p.stoploss), p.tot_stoploss === null ? "" : `${getal(p.tot_stoploss)} te gaan`)}
      ${feit("Dagen", p.dagen === null ? "—" : String(p.dagen), p.prijs_minuten_oud === null ? "" : `prijs ${p.prijs_minuten_oud} min oud`)}
    </div>
    <div class="dbalken">${binnen}</div>
  </div>`;
}
