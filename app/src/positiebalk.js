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

// De vakken met de markering erop.
//
// Eén vak draagt kleur: dat waar de tranche nu in staat. De andere vijf staan er
// bleek bij — je ziet wel welke kleur het is, maar niets trekt je blik weg van
// waar het om gaat. Zes volle kleuren naast elkaar lazen als een waarschuwing
// die altijd aanstaat, en dan zegt kleur niets meer.
//
// Elk vak draagt zijn eigen ask-bereik als hover: dat is de vraag die je bij een
// kleur stelt — bij welke prijs komt deze tranche daar terecht?
export function balkHtml(p, vakken = []) {
  const ijk = p.ijk || null;
  const boven = ijk ? [null, ijk.stoploss, ijk.waarschuwing, ijk.breakeven, ijk.helft, ijk.winstanker] : [];
  const onder = ijk ? [ijk.stoploss, ijk.waarschuwing, ijk.breakeven, ijk.helft, ijk.winstanker, 0] : [];

  // Waar de markering staat, is het vak dat kleur houdt. Staat er geen verse
  // prijs, dan valt de balk terug op de stand die vastligt.
  const hier = (v) => (p.plek !== null && p.plek !== undefined
    ? p.plek >= v.van && p.plek <= v.tot
    : Number(p.stand) === Number(v.stand));

  const vakjes = vakken.map((v, i) => {
    const breed = v.tot - v.van;
    const kleur = v.stand === 0 ? DIEPROOD : KLEUR[v.stand - 1];
    const aan = hier(v);
    const naam = String(v.naam || "").charAt(0).toUpperCase() + String(v.naam || "").slice(1);
    const bereik = !ijk ? ""
      : i === 0 ? ` · ask boven ${getal(boven[1])}`
      : v.stand === 5 ? ` · ask onder ${getal(boven[i])}`
      : ` · ask ${getal(boven[i])} tot ${getal(onder[i])}`;
    const tip = `${naam}${bereik}${aan && p.ask !== null && p.ask !== undefined ? ` · nu ${getal(p.ask)}` : ""}`;
    return `<span class="z${aan ? " aan" : ""}" data-tip="${ontsnap(tip)}"
      style="flex:0 0 calc(${breed.toFixed(2)}% - 3px);background:${kleur};opacity:${
        !p.open ? 0.22 : aan ? 1 : 0.3}"></span>`;
  }).join("");

  const merker = p.plek === null || p.plek === undefined ? ""
    : `<span class="merkerlab" style="left:${Math.max(2, Math.min(98, p.plek))}%">${
        p.binnen === null ? getal(p.ask) : `${getalMet(p.binnen, 0)} %`}</span><span class="merker" style="left:calc(${
        Math.max(1, Math.min(99, p.plek))}% - 1.5px)"></span>`;

  return `<span class="spoorbalk">${vakjes}${merker}</span>`;
}

// De schaal eronder: de ask-niveaus op de grenzen waar ze bij horen.
//
// Elk getal hoort op de lijn tussen twee vakken te staan, niet ergens in een
// vak: 60 is de stoploss, en dat is precies de overgang van 'voorbij de grens'
// naar 'onder druk'. Ze stonden een vak te ver naar rechts — rechts uitgelijnd
// binnen hun eigen cel — en dan lees je 60 bij de verkeerde kleur.
//
// Daarom staan ze nu absoluut, elk gecentreerd op zijn eigen grens.
export function schaalHtml(vakken = [], ijk = null) {
  if (!vakken.length) return "";
  const grens = ijk
    ? [null, ijk.stoploss, ijk.waarschuwing, ijk.breakeven, ijk.helft, ijk.winstanker]
    : [];

  const merken = vakken.map((v, i) => {
    // Het eerste vak heeft links geen grens: daarboven is er geen prijs meer,
    // alleen 'hier hoor je niet meer te zitten'.
    if (i === 0) return "";
    const tekst = ijk ? getal(grens[i]) : v.naam;
    if (!tekst) return "";
    const rand = v.van < 4 ? " links" : v.van > 96 ? " rechts" : "";
    return `<span class="schaalmerk${rand}" style="left:${v.van.toFixed(2)}%">${ontsnap(tekst)}</span>`;
  }).join("");

  return `<div class="schaalrij"><span class="schaal">${merken}</span></div>`;
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
