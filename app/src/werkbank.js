// Dispatch: het scherm waarop je begint.
//
// Het heette Werkbank, naar wat het vroeger was: een bank met werk erop. Dat
// werk is weg (BOUWSPEC §13b) — wat er staat gaat over de leden. De route heet
// nog wel /werkbank, want een adres is geen naam: favorieten en bladwijzers
// wijzen ernaar.
//
// Vier dingen, in deze volgorde, en niets anders:
//   1. de stand naar de leden — het venster en, zodra wij erin zitten, de
//      barometer. Eén knop publiceert allebei tegelijk.
//   2. de posities, met per positie waar hij staat ten opzichte van zijn strike.
//   3. wat er in een positie veranderde en nog niet gemeld is.
//   4. wat er wél gemeld is.
//
// Wat hier niet staat: taken. Werk aan de cyclus gebeurt op het cyclusrecord en
// in zijn related lists. Zie BOUWSPEC §13b.

import { haalWerkbank, publiceerStand, nietMelden, conceptUitKaart } from "./api.js";
import { ontsnap } from "./veld.js";

// De vijf treden van de barometer, van rustig naar druk. De labels komen uit
// beheer; de kleuren staan hier omdat ze de meter tekenen.
// Stand 1..5: 1 is onder druk, 5 is vrijwel afgerond (BOUWSPEC §10.1). De balk
// loopt van verlies links naar winst rechts, dus van rood naar groen.
import { KLEUR, DIEPROOD, balkHtml, schaalHtml, standBadge, metriekHtml } from "./positiebalk.js";

// Elk bezoek krijgt een nummer. Klik je weg terwijl de peiling loopt, dan tekent
// het antwoord dat daarna binnenkomt niet meer over het scherm waar je inmiddels
// bent. Dat is een keer misgegaan en kostte iemand zijn halve formulier.
let bezoek = 0;

export async function werkbankscherm(inhoud, kruimel) {
  const dit = ++bezoek;
  const leeftNog = () =>
    dit === bezoek
    && location.hash.slice(1).split("?")[0] === "/werkbank"
    && document.body.contains(inhoud);

  inhoud.innerHTML = `<div class="werkbank">Bezig…</div>`;

  let cyclusId = null;
  let kiesStand = null;      // welke barometerstand je aanklikte
  let kiesVenster = null;    // welke vensterstand je aanklikte
  let open = new Set();      // welke posities uitgeklapt staan
  let melding = null;
  let nietMeldenVoor = null;   // de kaart waarvan je aan het opschrijven bent waarom hij niet weg gaat
  let data = null;

  async function haal() {
    try {
      const uit = await haalWerkbank(cyclusId);
      if (!leeftNog()) return;
      data = uit;
      if (data.cyclus) cyclusId = data.cyclus.id;
      teken();
    } catch (fout) {
      if (!leeftNog()) return;
      inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    }
  }

  function teken() {
    if (!leeftNog()) return;
    document.title = "Dispatch · Delta Wave Cockpit";
    kruimel.innerHTML = `<span>Communicatie</span> <span class="pijlje">&rsaquo;</span> <span>Dispatch</span>`;

    if (!data.cyclus) {
      inhoud.innerHTML = `<div class="werkbank"><p class="wbleeg">Er loopt geen cyclus. Open er een om te beginnen.</p></div>`;
      return;
    }

    inhoud.innerHTML = `<div class="werkbank">
      ${kop()}
      <div class="wbkolommen">
        <div class="wbhoofd">
          ${standvak()}
          ${positievak()}
          ${ledenvak()}
        </div>
        ${geschiedenisvak()}
      </div>
    </div>`;
  }

  // ------------------------------------------------------- de geschiedenis
  //
  // Rechts staat wat er gebeurd is: welke standen wij achter elkaar zetten, en
  // hoe elke tranche zich ondertussen ontwikkelde. Een scherm dat alleen het nu
  // toont beantwoordt de vraag niet die een lid stelt — wordt het beter of
  // slechter?
  function geschiedenisvak() {
    const g = data.geschiedenis || { standen: [], verloop: {} };

    const standen = g.standen.map((r, i) => {
      const vorige = g.standen[i + 1] || null;
      const stuk = [];
      if (!vorige || vorige.venster !== r.venster) {
        stuk.push(`<span class="gstuk">venster <b>${ontsnap(labelVenster(r.venster))}</b></span>`);
      }
      if (!vorige || Number(vorige.stand) !== Number(r.stand)) {
        stuk.push(`<span class="gstuk"><span class="gvlak" style="background:${
          KLEUR[Number(r.stand) - 1] || "var(--dim)"}"></span><b>${ontsnap(labelStand(Number(r.stand)))}</b></span>`);
      }
      // Een rij waarin niets veranderde is een bevestiging; die zeggen we zo.
      if (!stuk.length) stuk.push(`<span class="gstuk gstil">bevestigd</span>`);

      return `<li class="greg">
        <span class="gtijd">${ontsnap(String(r.vastgesteld_op || "").slice(0, 16))}</span>
        <span class="gwat">${stuk.join("")}</span>
        ${r.reden ? `<span class="greden">${ontsnap(r.reden)}</span>` : ""}
        <span class="gvoet">${r.wie ? ontsnap(r.wie) : "—"}${
          r.gepubliceerd_op ? " · gemeld aan de leden" : " · niet gemeld"}</span>
      </li>`;
    }).join("");

    return `<aside class="wbzij">
      <section class="paneel">
        <div class="paneelkop">Geschiedenis</div>
        <div class="paneelbody">
          ${g.standen.length ? `<ul class="glijst">${standen}</ul>`
            : `<p class="wbleeg">Er is nog geen stand vastgelegd.</p>`}
        </div>
      </section>
    </aside>`;
  }

  // ------------------------------------------------------------------- kop
  function kop() {
    const w = data.wacht;
    const wacht = w.kaarten > 0 || w.stand_anders || w.voorstel;
    const wat = [
      w.kaarten ? `${w.kaarten} ${w.kaarten === 1 ? "verandering" : "veranderingen"}` : null,
      w.stand_anders ? "een stand die zij niet kennen" : null,
      w.voorstel ? "een voorstel" : null,
    ].filter(Boolean).join(" · ");

    // Er loopt er één. Een keuzelijst met één regel erin is geen keuze maar een
    // vraag die je elke keer opnieuw moet beantwoorden; de naam volstaat.
    return `<div class="wbtop">
      <span class="wbcyclus">Lopende cyclus: <b>${ontsnap(data.cyclus.label)}</b></span>
      <span class="wbachter ${wacht ? "wacht" : "bij"}"><span class="stip"></span><span>${
        wacht ? `Wacht op de leden: ${ontsnap(wat)}` : "De leden zijn bij"}</span></span>
    </div>`;
  }

  // --------------------------------------------- het venster en de barometer
  function standvak() {
    const b = data.barometer;
    const v = data.venster;
    const toonVenster = kiesVenster ?? v.nu;
    const toonStand = kiesStand ?? (b.wij ? Number(b.wij.stand.waarde) : null);

    // Het venster krijgt geen systeemvoorstel. Het is een oordeel over de markt,
    // en juist dat is voor een lid het meeste waard — een systeem dat het zelf
    // zet, zet het een keer verkeerd (BOUWSPEC §13a).
    const standTip = b.voorstel !== null && b.wij && Number(b.wij.stand.waarde) !== b.voorstel
      ? b.voorstel : null;

    // Het venster is een verloop, en dus leest het als een balk die volloopt:
    // wat geweest is lichtblauw, waar we staan donkerblauw, wat nog komt grijs.
    // Zes even zware blokjes lieten dat verloop juist niet zien. Het blauwe
    // segment blijft staan terwijl je kiest — zo zie je naast elkaar wat
    // vastligt en wat je ervan wil maken; staat de keuze op hetzelfde segment,
    // dan wint groen (die regel staat in de opmaak).
    const vakje = (x) => {
      const kl = [
        v.verloop.indexOf(x.waarde) < v.verloop.indexOf(v.nu) ? "gehad" : "",
        x.waarde === v.nu ? "nu" : "",
        kiesVenster === x.waarde ? "gekozen" : "",
      ].filter(Boolean).join(" ");
      return `<button class="vstap ${kl}" data-venster="${x.waarde}">
        <span class="vbalk"></span>
        <span class="nm">${ontsnap(x.label)}</span></button>`;
    };

    const stuk = [];
    if (kiesVenster !== null) stuk.push(`venster naar <b>${ontsnap(labelVenster(kiesVenster))}</b>`);
    if (kiesStand !== null) stuk.push(`barometer naar <b>${ontsnap(labelStand(kiesStand))}</b>`);

    return `<section class="paneel">
      <div class="paneelkop">Stand naar de leden</div>
      ${standTip !== null && kiesStand === null ? `<div class="suggestie"><span class="vk"></span><span>
        Barometer: het systeem stelt <b>${ontsnap(labelStand(standTip))}</b> voor${
          data.zwakste ? ` — ${ontsnap(data.zwakste.contract || "de zwakste positie")} staat op ${
            getal(data.zwakste.ask)} van een stoploss op ${getal(data.zwakste.stoploss)}` : ""
        }. Klik de omstippelde stand en publiceer.</span></div>` : ""}

      <div class="paneelbody">
        <div class="deel">
          <div class="deelkop"><span class="dtitel">Instap venster</span>
            <span class="dkent">${v.gepubliceerd ? `Leden kennen: ${ontsnap(labelVenster(v.gepubliceerd))}` : "Nog niets gemeld"}</span></div>
          <div class="vnu">${ontsnap(labelVenster(toonVenster))}</div>
          <div class="vensterrij">${vensters().map(vakje).join("")}</div>
          ${dagstrook("venster")}
        </div>

        <div class="deel${b.wakker ? "" : " uit"}">
          <div class="deelkop"><span class="dtitel">Positie Barometer</span>
            <span class="dkent">${b.leden ? `Leden kennen: ${ontsnap(b.leden.stand.label)}` : "Nog niets gemeld"}</span></div>
          <div class="meterrij">
            <div class="gauge">${meter(toonStand, standTip)}
              <div class="gaugetekst">
                <div class="gaugenaam">${toonStand ? ontsnap(labelStand(toonStand)) : "—"}</div>
                <div class="gaugeonder">${gaugeonder()}</div>
              </div>
            </div>
            <div class="legenda">${legenda(standTip)}</div>
          </div>
          ${dagstrook("barometer")}
          ${b.voorstel_waarom_niet ? `<p class="wbnoot">Het systeem meet niet: ${ontsnap(b.voorstel_waarom_niet)}.</p>` : ""}
          ${(b.ongemeten || []).length ? `<p class="wbnoot wblet">Niet meegewogen, want niet te meten: ${
            ontsnap(b.ongemeten.map((p) => p.contract || `positie ${p.id}`).join(", "))}.</p>` : ""}
        </div>
      </div>

      <div class="publiceerbalk${stuk.length ? " open" : ""}">
        ${stuk.length ? `
          <label class="pubvraag" for="pubreden">Waarom verandert de stand? Dat is wat de leden lezen.</label>
          <textarea id="pubreden" class="pubreden" rows="2"
            placeholder="Bijvoorbeeld: de ask liep op tot vlak onder de stoploss."></textarea>` : ""}
        <div class="pubrij">
          <span class="pubtekst">${stuk.length ? `Klaar om te publiceren: ${stuk.join(" en ")}.` : "Klik een stand aan om hem te veranderen."}</span>
          ${melding ? `<span class="wbmelding">${ontsnap(melding)}</span>` : ""}
          ${stuk.length ? `<button class="knop tweede" data-afbreken>Laat maar</button>` : ""}
          <button class="knop" data-publiceer disabled>Publiceren</button>
        </div>
      </div>
    </section>`;
  }

  const vensters = () => (data.barometer.vensters || []).length
    ? data.barometer.vensters
    : data.venster.verloop.map((w) => ({ waarde: w, label: w }));
  const labelVenster = (w) => (vensters().find((x) => x.waarde === w) || { label: w }).label;
  const labelStand = (n) => {
    const s = (data.barometer.schaal || []).find((x) => String(x.waarde) === String(n));
    return s ? s.label : String(n);
  };

  function gaugeonder() {
    const b = data.barometer;
    if (!b.wakker) return "nog niet van toepassing";
    if (kiesStand !== null) return "gekozen — nog niet gepubliceerd";
    if (!b.wij) return "nog niet vastgesteld";
    return b.gelijk ? "de leden weten dit" : "nog niet gepubliceerd";
  }

  // De meter. Vijf vakjes met lucht ertussen: aaneengesloten lezen ze als één
  // verloop, los lezen ze als vijf standen — en dat zijn het.
  function meter(toon, tip) {
    const CX = 160, CY = 158, RO = 132, RI = 74, LUCHT = 2.2;
    const punt = (h, r) => [CX + r * Math.cos((h * Math.PI) / 180), CY - r * Math.sin((h * Math.PI) / 180)];
    const sector = (a0, a1, ro, ri) => {
      const [x1, y1] = punt(a0, ro), [x2, y2] = punt(a1, ro);
      const [x3, y3] = punt(a1, ri), [x4, y4] = punt(a0, ri);
      return `M${x1} ${y1}A${ro} ${ro} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${ri} ${ri} 0 0 0 ${x4} ${y4}Z`;
    };
    let svg = "";
    // Stand 1 (onder druk) links, stand 5 (vrijwel afgerond) rechts — dezelfde
    // leesrichting als de balk onder een positie.
    for (let i = 0; i < 5; i++) {
      const stand = i + 1;
      const a0 = 180 - i * 36 - LUCHT, a1 = a0 - 36 + 2 * LUCHT;
      const gekozen = kiesStand === stand;
      const voorgesteld = tip === stand && kiesStand === null;
      svg += `<path class="seg" data-stand="${stand}" d="${sector(a0, a1, RO, RI)}" fill="${KLEUR[stand - 1]}"
        opacity="${gekozen || voorgesteld || (kiesStand === null && stand === toon) ? 1 : 0.72}"></path>`;
      if (voorgesteld) svg += `<path d="${sector(a0, a1, RO + 5, RI - 5)}" fill="none" stroke="#8A5A12" stroke-width="2.5" stroke-dasharray="6 4"></path>`;
      // Groen: dit is wat je net koos en wat nog niet weg is. De blauwe regel
      // ernaast blijft zeggen wat de leden kennen.
      if (gekozen) svg += `<path d="${sector(a0, a1, RO + 5, RI - 5)}" fill="none" stroke="#1F5E45" stroke-width="3"></path>`;
    }
    if (toon) {
      const h = 180 - (toon - 0.5) * 36;
      const [nx, ny] = punt(h, RO - 14);
      const [bx, by] = punt(h + 90, 9), [cx, cy] = punt(h - 90, 9);
      svg += `<path d="M${bx} ${by}L${nx} ${ny}L${cx} ${cy}Z" fill="#0F0E0D"></path>`;
    }
    svg += `<circle cx="${CX}" cy="${CY}" r="11" fill="#0F0E0D"></circle><circle cx="${CX}" cy="${CY}" r="4.5" fill="#fff"></circle>`;
    return `<svg viewBox="0 0 320 212">${svg}</svg>`;
  }

  // Alleen de standen zelf. De ask-grenzen staan al onder de posities; ze hier
  // herhalen maakte van een keuzelijst een tabel.
  function legenda(tip) {
    const nu = data.barometer.wij ? Number(data.barometer.wij.stand.waarde) : null;
    return [1, 2, 3, 4, 5].map((stand) => {
      const kl = [stand === nu ? "nu" : "", tip === stand && kiesStand === null ? "tip" : "",
                  kiesStand === stand ? "gekozen" : ""].filter(Boolean).join(" ");
      return `<button class="lreg ${kl}" data-stand="${stand}">
        <span class="vlak" style="background:${KLEUR[stand - 1]}"></span>
        <span class="nm">${ontsnap(labelStand(stand))}</span></button>`;
    }).join("");
  }

  // De geschiedenis van de cyclus als strook handelsdagen, in weken gegroepeerd.
  // Eén vakje per handelsdag, een spleet tussen de weken. Zo zie je niet alleen
  // wat er nu staat maar hoe lang het al zo staat — en dat is wat een lid dat
  // meeleest wil weten.
  function dagstrook(wat) {
    const dagen = (data.geschiedenis && data.geschiedenis.dagen) || [];
    if (!dagen.length) return "";

    // Blauw voor het venster: hoe verder in het verloop, hoe donkerder. Voor de
    // barometer de kleuren van de standen zelf.
    const VENSTERBLAUW = ["#DCE7EE", "#BBD2DF", "#93B8CC", "#6A9CB7", "#136289", "#1F5E45"];

    const weken = [];
    for (const d of dagen) {
      const laatste = weken[weken.length - 1];
      if (laatste && laatste.week === d.week) laatste.dagen.push(d);
      else weken.push({ week: d.week, dagen: [d] });
    }

    const vakje = (d) => {
      if (wat === "venster") {
        const i = (data.venster.verloop || []).indexOf(d.venster);
        const kleur = i < 0 ? "var(--b2)" : VENSTERBLAUW[i];
        return `<i style="background:${kleur}" title="${ontsnap(
          `${d.dag} · ${d.venster ? labelVenster(d.venster) : "nog niets vastgelegd"}`)}"></i>`;
      }
      // De barometer slaapt tot wij in positie zitten: op die dagen is er geen
      // stand, en dan hoort er ook geen kleur te staan.
      const inPositie = d.venster === "in_positie";
      const kleur = inPositie && d.stand >= 1 && d.stand <= 5 ? KLEUR[d.stand - 1] : "var(--b2)";
      return `<i style="background:${kleur}" title="${ontsnap(
        `${d.dag} · ${inPositie && d.stand ? labelStand(d.stand) : "geen stand"}`)}"></i>`;
    };

    return `<div class="strook">
      ${weken.map((w) => `<span class="week" title="week ${w.week}">${
        w.dagen.map(vakje).join("")}</span>`).join("")}
      <span class="strooknoot">${dagen.length} handelsdagen</span>
    </div>`;
  }

  // Eén vakje per dag, in de kleur van de stand waarop de tranche die dag sloot.
  // In het verlengde van haar eigen regel, zodat je in één blik ziet hoe ze van
  // kleur veranderde: van groen naar oranje is een verhaal, een los getal niet.
  function dagen(p) {
    const rijen = (data.geschiedenis && data.geschiedenis.verloop[p.id]) || [];
    if (!rijen.length) return `<span class="dagen leeg"></span>`;
    return `<span class="dagen">${rijen.map((r) => {
      const st = Number(r.stand);
      const kleur = st >= 1 && st <= 5 ? KLEUR[st - 1] : "var(--b2)";
      return `<i style="background:${kleur}" title="${ontsnap(
        `${r.dag}: ${st ? labelStand(st) : "niet gemeten"}${
          r.binnen === null || r.binnen === undefined ? "" : ` · ${getalMet(r.binnen, 0)} % binnen`}`)}"></i>`;
    }).join("")}</span>`;
  }

  // --------------------------------------------------------- de posities
  function positievak() {
    // De balk loopt van verlies links naar winst rechts; de ask daalt dus naar
    // rechts — een geschreven optie die goedkoper wordt is winst. De vakken
    // staan op vaste plekken, met break-even in het midden, zodat twee tranches
    // met verschillende premies naast elkaar te lezen zijn. Binnen een vak
    // beweegt de markering lineair mee met de prijs. Zie BOUWSPEC §10.1.
    const VAKKEN = data.vakken || [];

    const regels = data.posities.map((p) => {
      const uit = open.has(p.id);
      return `<div class="posblok ${uit ? "uitgeklapt" : ""}">
        <button class="pos ${p.open ? "" : "posdicht"}" data-pos="${p.id}">
          <span class="poslinks"><span class="chev">${uit ? "▾" : "▸"}</span><span>
            <span class="posnaam">${ontsnap(p.contract || `Tranche ${p.tranche}`)}</span><br>
            <span class="posonder">${ontsnap(onderschrift(p))}</span></span></span>
          ${balkHtml(p, VAKKEN)}
          ${dagen(p)}
          <span class="posstand">${standBadge(p, p.stand ? labelStand(p.stand) : null)}</span>
        </button>
        ${uit ? detail(p) : ""}
      </div>`;
    }).join("");

    // De schaal eronder staat op dezelfde plekken als de vakken, met de
    // ask-niveaus van de zwakste tranche erbij. De namen van de standen staan
    // er niet nog eens: die staan rechts op elke regel.
    const ijk = (data.posities.find((p) => p.ijk && p.open) || {}).ijk || null;

    return `<section class="paneel">
      <div class="paneelkop">Posities</div>
      ${data.posities.length ? regels : `<p class="wbleeg">Deze cyclus heeft nog geen positie.</p>`}
      ${data.posities.length ? schaalHtml(VAKKEN, ijk) : ""}
      ${data.zwakste ? `<div class="zwakste"><b>${ontsnap(data.zwakste.contract || "")}</b> is de zwakste en bepaalt de barometer: ask ${
        getal(data.zwakste.ask)}, break-even op ${getal(data.zwakste.breakeven)}, stoploss op ${
        getal(data.zwakste.stoploss)} — <b>${ontsnap(labelStand(data.zwakste.stand))}</b>.</div>` : ""}
    </section>`;
  }

  function onderschrift(p) {
    if (!p.open) return `${p.uitkomst || "gesloten"} · ${getalMet(p.resultaat)}`;
    return [p.dagen !== null ? `${p.dagen} dagen` : null,
            p.premie !== null ? `premie ${getal(p.premie)}` : null,
            p.ask !== null ? `ask ${getal(p.ask)}${p.verse_prijs ? "" : " (oud)"}` : "geen prijs"]
      .filter(Boolean).join(" · ");
  }

  // Zes cijfers, twee balken, en wat eraan hangt. Meer hoeft hier niet: het
  // volledige record staat één klik verderop.
  function detail(p) {
    const merken = [
      p.doorgerold_naar ? ["dblauw", `Doorgerold naar ${p.doorgerold_naar}`] : null,
      p.afwijking ? ["dlet", `Afwijking · ${p.afwijking_soort || "zie het record"}`] : null,
      p.gepubliceerd_op ? ["", `Gemeld ${String(p.gepubliceerd_op).slice(0, 16)}`] : ["dlet", "Nog niet gemeld aan de leden"],
    ].filter(Boolean);

    return `<div class="detail">
      ${metriekHtml(p)}
      <div class="dmerken">
        ${merken.map(([kl, t]) => `<span class="dmerk ${kl}">${ontsnap(t)}</span>`).join("")}
        <a class="knop tweede" href="#/t/positie/${p.id}">Positierecord</a>
      </div>
    </div>`;
  }

  // Een doorrol is één beweging: eruit en er weer in. Twee kanten met een pijl
  // ertussen leest als die beweging; drie regels onder elkaar lieten je zelf
  // uitzoeken wat bij wat hoorde.
  function rolvak(rol) {
    const kant = (wat, lab, k) => `
      <div class="rolkant ${wat}">
        <span class="rollab">${lab}</span>
        <span class="rolcontract">${ontsnap(k.contract)}</span>
        <span class="rolgetal ${k.op || ""}">${ontsnap(k.getal)}</span>
        ${k.inzet ? `<span class="rolnoot">${ontsnap(k.inzet)}</span>` : ""}
      </div>`;
    return `<div class="rolvak">
      ${kant("uit", "Uit", rol.uit)}
      <span class="rolpijl" aria-hidden="true">
        <svg viewBox="0 0 34 12"><path d="M0 6h26M21 1l6 5-6 5" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      ${kant("in", "In", rol.in)}
      <div class="rolnetto ${rol.netto_op}"><span>Netto</span><b>${ontsnap(rol.netto)}</b></div>
    </div>`;
  }

  // ------------------------------------------------- kaarten en verstuurd
  function ledenvak() {
    const kaartjes = data.kaarten.map((k) => `<div class="kaart">
      <div class="kaartkop"><h3>${ontsnap(k.titel)}</h3>
        <span class="pt ${k.soort === "doorrol" ? "p-hoog" : k.soort === "positie_gesloten" ? "p-med" : "p-laag"}">${
          k.soort === "doorrol" ? "doorrol" : k.soort === "positie_gesloten" ? "gesloten" : "nieuw"}</span></div>
      ${k.was ? `<div class="omgezet">↻ Was: ${ontsnap(k.was)}</div>` : ""}
      ${k.rol ? rolvak(k.rol) : ""}
      ${k.feiten.length ? `<div class="feiten">${k.feiten.map(([l, w]) =>
        `<span class="feit"><span class="flab">${ontsnap(l)}</span><span class="fwaarde">${ontsnap(w)}</span></span>`).join("")}</div>` : ""}
      ${nietMeldenVoor === k.id ? `
        <div class="kaartreden">
          <label for="nietreden">Waarom gaat dit niet naar de leden?</label>
          <textarea id="nietreden" rows="2" placeholder="Bijvoorbeeld: dit is dezelfde tranche als gisteren."></textarea>
          <div class="kaartknoppen">
            <button class="knop tweede" data-nietmeldenaf>Laat maar</button>
            <button class="knop" data-nietmeldendoor="${k.id}" disabled>Niet melden</button>
          </div>
        </div>` : `
        <div class="kaartknoppen">
          <button class="knop tweede" data-nietmelden="${k.id}">Niet melden</button>
          <a class="knop" href="${k.concept ? `#/bericht/${k.concept}` : "#"}" data-concept="${k.id}">${
            k.concept ? "Concept openen" : "Bericht opstellen"}</a>
        </div>`}
    </div>`).join("");

    return `<section class="paneel">
      <div class="paneelkop">Publicaties</div>
      <div class="tweekolom">
        <div class="kol">
          <div class="kolkop">Kaarten · veranderingen in een positie<span class="n">${data.kaarten.length} open</span></div>
          ${kaartjes || `<p class="wbleeg">Geen openstaande kaarten. Er is geen positie veranderd.</p>`}
        </div>
        <div class="kol">
          <div class="kolkop">Verstuurd naar de leden<span class="n">deze cyclus</span></div>
          ${data.verstuurd.length ? data.verstuurd.map((v) => `<div class="vreg">
            <span class="vink">✓</span>
            <span class="kern"><b>${ontsnap(v.titel || v.soort)}</b><span>${ontsnap(String(v.tekst || "").slice(0, 90))}</span></span>
            <span class="tijd">${ontsnap(String(v.verstuurd_op || "").slice(0, 16))}</span></div>`).join("")
            : `<p class="wbleeg">Er is nog niets naar de leden gegaan.</p>`}
        </div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------- bediening
  async function opKlik(e) {
    const posKnop = e.target.closest("[data-pos]");
    if (posKnop) {
      const id = Number(posKnop.dataset.pos);
      open.has(id) ? open.delete(id) : open.add(id);
      return teken();
    }
    const seg = e.target.closest("[data-stand]");
    if (seg && data.barometer.wakker) {
      const n = Number(seg.dataset.stand);
      kiesStand = kiesStand === n ? null : n;
      melding = null;
      return teken();
    }
    const vh = e.target.closest("[data-venster]");
    if (vh) {
      const w = vh.dataset.venster;
      kiesVenster = kiesVenster === w ? null : w;
      melding = null;
      return teken();
    }
    if (e.target.closest("[data-afbreken]")) {
      kiesStand = null; kiesVenster = null; melding = null;
      return teken();
    }
    if (e.target.closest("[data-publiceer]")) return publiceer();

    const niet = e.target.closest("[data-nietmelden]");
    if (niet) { nietMeldenVoor = Number(niet.dataset.nietmelden); melding = null; return teken(); }

    if (e.target.closest("[data-nietmeldenaf]")) { nietMeldenVoor = null; return teken(); }

    const nietOk = e.target.closest("[data-nietmeldendoor]");
    if (nietOk) {
      const vak = inhoud.querySelector("#nietreden");
      const reden = vak ? vak.value.trim() : "";
      if (!reden) return;
      const uit = await nietMelden(Number(nietOk.dataset.nietmeldendoor), reden);
      melding = uit && uit.fout ? uit.fout : null;
      nietMeldenVoor = null;
      return haal();
    }

    const concept = e.target.closest("[data-concept]");
    if (concept && !concept.getAttribute("href").startsWith("#/bericht/")) {
      e.preventDefault();
      const uit = await conceptUitKaart(Number(concept.dataset.concept));
      if (uit && uit.publicatie) location.hash = `#/bericht/${uit.publicatie}`;
      else melding = (uit && uit.fout) || "Dat lukte niet.";
      return teken();
    }
  }

  async function publiceer() {
    const vak = inhoud.querySelector("#pubreden");
    const reden = vak ? vak.value.trim() : "";
    if (!reden) return;
    const uit = await publiceerStand({
      cyclus: cyclusId, stand: kiesStand, venster: kiesVenster, reden,
    });
    if (uit && uit.fout) { melding = uit.fout; return teken(); }
    kiesStand = null; kiesVenster = null; melding = null;
    return haal();
  }

  inhoud.addEventListener("click", opKlik);

  // De knop gaat aan zodra er een reden staat. Niet opnieuw tekenen bij elke
  // toetsaanslag: dan springt de cursor uit het vak en ben je je tekst kwijt.
  inhoud.addEventListener("input", (e) => {
    const vak = e.target.closest("#pubreden, #nietreden");
    if (!vak) return;
    const knop = inhoud.querySelector(vak.id === "pubreden" ? "[data-publiceer]" : "[data-nietmeldendoor]");
    if (knop) knop.disabled = !vak.value.trim();
  });

  await haal();

  // De peiling. De brug is de klok; dit scherm kijkt of er iets veranderd is.
  // Niet opnieuw tekenen terwijl je een stand aan het kiezen bent — dan zou het
  // scherm je keuze onder je handen vandaan halen.
  (async function peil() {
    await new Promise((r) => setTimeout(r, 10000));
    if (!leeftNog()) return;
    if (kiesStand === null && kiesVenster === null && nietMeldenVoor === null) await haal();
    if (!leeftNog()) return;
    peil();
  })();
}

// --------------------------------------------------------------- opmaak
function getal(n, decimalen = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(decimalen).replace(".", ",");
}
function getalMet(n, decimalen = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(decimalen).replace(".", ",")}`;
}

