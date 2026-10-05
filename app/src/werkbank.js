// De werkbank: het scherm waarop je begint.
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
const KLEUR = ["#0A9D4E", "#8DC63F", "#FBC02D", "#F26A21", "#D7261E"];   // stand 1..5

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
    document.title = "Werkbank · Delta Blueprint Cockpit";
    kruimel.innerHTML = `<span>Werken</span> <span class="pijlje">&rsaquo;</span> <span>Werkbank</span>`;

    if (!data.cyclus) {
      inhoud.innerHTML = `<div class="werkbank"><p class="wbleeg">Er loopt geen cyclus. Open er een om te beginnen.</p></div>`;
      return;
    }

    inhoud.innerHTML = `<div class="werkbank">
      ${kop()}
      ${standvak()}
      ${positievak()}
      ${ledenvak()}
    </div>`;
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

    return `<div class="wbtop">
      <select class="cycluskies" data-cyclus>
        ${data.cycli.map((c) => `<option value="${c.id}"${c.id === data.cyclus.id ? " selected" : ""}>${ontsnap(c.label)}</option>`).join("")}
      </select>
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

    const vensterTip = b.wakker ? null : null;   // het venster stelt zichzelf niet voor
    const standTip = b.voorstel !== null && b.wij && Number(b.wij.stand.waarde) !== b.voorstel
      ? b.voorstel : null;

    const vakje = (x, i) => {
      const nuHier = x.waarde === v.nu && kiesVenster === null;
      const kl = [
        v.verloop.indexOf(x.waarde) < v.verloop.indexOf(v.nu) ? "gehad" : "",
        nuHier ? "nu" : "",
        kiesVenster === x.waarde ? "gekozen" : "",
      ].filter(Boolean).join(" ");
      return `<button class="vhok ${kl}" data-venster="${x.waarde}">
        <span class="nm">${ontsnap(x.label)}</span></button>`;
    };

    const stuk = [];
    if (kiesVenster !== null) stuk.push(`venster naar <b>${ontsnap(labelVenster(kiesVenster))}</b>`);
    if (kiesStand !== null) stuk.push(`barometer naar <b>${ontsnap(labelStand(kiesStand))}</b>`);

    return `<section class="paneel">
      <div class="paneelkop">Stand naar de leden<span class="meta">venster en barometer</span></div>
      ${standTip !== null && kiesStand === null ? `<div class="suggestie"><span class="vk"></span><span>
        Barometer: het systeem stelt <b>${ontsnap(labelStand(standTip))}</b> voor${
          data.zwakste ? ` — ${ontsnap(data.zwakste.contract || "de zwakste positie")} staat op ${
            getal(data.zwakste.ask)} van een stoploss op ${getal(data.zwakste.stoploss)}` : ""
        }. Klik de omstippelde stand en publiceer.</span></div>` : ""}

      <div class="paneelbody">
        <div class="deel">
          <div class="deelkop"><span class="dtitel">Venster</span><span class="dmeta">voorbereidingstijd voor de leden</span>
            <span class="dkent">${v.gepubliceerd ? `Leden kennen: ${ontsnap(labelVenster(v.gepubliceerd))}` : "Nog niets gemeld"}</span></div>
          <div class="vensterrij">${vensters().map(vakje).join("")}</div>
        </div>

        <div class="deel${b.wakker ? "" : " uit"}">
          <div class="deelkop"><span class="dtitel">Barometer</span><span class="dmeta">wat wij van een lid vragen</span>
            <span class="dkent">${b.leden ? `Leden kennen: ${ontsnap(b.leden.stand.label)}` : "Nog niets gemeld"}</span></div>
          <div class="slaapt">Slaapt tot het venster op <b>In positie</b> staat — ${ontsnap(b.slaapt_waarom || "")}.</div>
          <div class="meterrij">
            <div class="gauge">${meter(toonStand, standTip)}
              <div class="gaugetekst">
                <div class="gaugenaam">${toonStand ? ontsnap(labelStand(toonStand)) : "—"}</div>
                <div class="gaugeonder">${gaugeonder()}</div>
              </div>
            </div>
            <div class="legenda">${legenda(standTip)}</div>
          </div>
          ${b.voorstel_waarom_niet ? `<p class="wbnoot">Het systeem meet niet: ${ontsnap(b.voorstel_waarom_niet)}.</p>` : ""}
          ${(b.ongemeten || []).length ? `<p class="wbnoot wblet">Niet meegewogen, want niet te meten: ${
            ontsnap(b.ongemeten.map((p) => p.contract || `positie ${p.id}`).join(", "))}.</p>` : ""}
        </div>
      </div>

      <div class="publiceerbalk">
        <span class="pubtekst">${stuk.length ? `Klaar om te publiceren: ${stuk.join(" en ")}.` : "Klik een stand aan om hem te veranderen."}</span>
        ${melding ? `<span class="wbmelding">${ontsnap(melding)}</span>` : ""}
        <button class="knop" data-publiceer ${stuk.length ? "" : "disabled"}>Publiceren</button>
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
    // Stand 5 (onder de strike) links, stand 1 (ruim) rechts.
    for (let i = 0; i < 5; i++) {
      const stand = 5 - i;
      const a0 = 180 - i * 36 - LUCHT, a1 = a0 - 36 + 2 * LUCHT;
      const gekozen = kiesStand === stand;
      const voorgesteld = tip === stand && kiesStand === null;
      svg += `<path class="seg" data-stand="${stand}" d="${sector(a0, a1, RO, RI)}" fill="${KLEUR[stand - 1]}"
        opacity="${gekozen || voorgesteld || (kiesStand === null && stand === toon) ? 1 : 0.72}"></path>`;
      if (voorgesteld) svg += `<path d="${sector(a0, a1, RO + 5, RI - 5)}" fill="none" stroke="#8A5A12" stroke-width="2.5" stroke-dasharray="6 4"></path>`;
      if (gekozen) svg += `<path d="${sector(a0, a1, RO + 5, RI - 5)}" fill="none" stroke="#136289" stroke-width="3"></path>`;
    }
    if (toon) {
      const h = 180 - (5 - toon + 0.5) * 36;
      const [nx, ny] = punt(h, RO - 14);
      const [bx, by] = punt(h + 90, 9), [cx, cy] = punt(h - 90, 9);
      svg += `<path d="M${bx} ${by}L${nx} ${ny}L${cx} ${cy}Z" fill="#0F0E0D"></path>`;
    }
    svg += `<circle cx="${CX}" cy="${CY}" r="11" fill="#0F0E0D"></circle><circle cx="${CX}" cy="${CY}" r="4.5" fill="#fff"></circle>`;
    return `<svg viewBox="0 0 320 212">${svg}</svg>`;
  }

  function legenda(tip) {
    const d = data.drempels || {};
    // De grenzen lopen in procent van de stoploss: 0 % is waardeloos, 100 % is
    // eruit volgens het exitplan.
    const pctVan = (n) => `${getal(n, 0)} %`;
    const omschrijving = {
      1: `ask < ${pctVan(d.barometer_comfortabel_pct)} van de stoploss`,
      2: `${pctVan(d.barometer_comfortabel_pct)} – ${pctVan(d.barometer_letop_pct)}`,
      3: `${pctVan(d.barometer_letop_pct)} – ${pctVan(d.barometer_krap_pct)}`,
      4: `${pctVan(d.barometer_krap_pct)} – 100 %`,
      5: "op of over de stoploss",
    };
    const nu = data.barometer.wij ? Number(data.barometer.wij.stand.waarde) : null;
    return [5, 4, 3, 2, 1].map((stand) => {
      const kl = [stand === nu ? "nu" : "", tip === stand && kiesStand === null ? "tip" : "",
                  kiesStand === stand ? "gekozen" : ""].filter(Boolean).join(" ");
      return `<button class="lreg ${kl}" data-stand="${stand}">
        <span class="vlak" style="background:${KLEUR[stand - 1]}"></span>
        <span class="nm">${ontsnap(labelStand(stand))}</span>
        <span class="om">${ontsnap(omschrijving[stand])}</span></button>`;
    }).join("");
  }

  // --------------------------------------------------------- de posities
  function positievak() {
    // De balk loopt van ask 0 tot de stoploss, met een stukje erover zodat een
    // positie die eroverheen is ook nog ergens staat. De vakjes hebben de
    // breedte van hun eigen bereik: even brede vakjes zouden het merkteken in
    // een ander vakje zetten dan het label ernaast.
    const ZONES = data.zones || [];
    const RECHTS = ZONES.length ? ZONES[ZONES.length - 1].tot : 120;

    const regels = data.posities.map((p) => {
      const uit = open.has(p.id);
      const vakjes = ZONES.map((z) => {
        const breed = (z.tot - z.van) / RECHTS;
        return `<span class="z" style="flex:0 0 calc(${(breed * 100).toFixed(2)}% - 4px);background:${
          KLEUR[z.stand - 1]};opacity:${p.open ? 0.9 : 0.4}"></span>`;
      }).join("");

      const plek = p.weg === null ? null : Math.max(1, Math.min(99, (p.weg / RECHTS) * 100));
      const merker = plek === null ? ""
        : `<span class="merkerlab" style="left:${plek}%">${getal(p.ask)}</span><span class="merker" style="left:calc(${plek}% - 1.5px)"></span>`;

      return `<div class="posblok ${uit ? "uitgeklapt" : ""}">
        <button class="pos ${p.open ? "" : "posdicht"}" data-pos="${p.id}">
          <span class="poslinks"><span class="chev">${uit ? "▾" : "▸"}</span><span>
            <span class="posnaam">${ontsnap(p.contract || `Tranche ${p.tranche}`)}</span><br>
            <span class="posonder">${ontsnap(onderschrift(p))}</span></span></span>
          <span class="spoorbalk">${vakjes}${merker}</span>
          <span class="posstand">${p.stand
            ? `<span class="badge" style="background:${KLEUR[p.stand - 1]}">${ontsnap(labelStand(p.stand))}</span>`
            : `<span class="badge" style="background:var(--dim)">${p.open ? "niet gemeten" : "Afgerond"}</span>`}</span>
        </button>
        ${uit ? detail(p) : ""}
      </div>`;
    }).join("");

    // De schaal eronder staat op dezelfde grenzen als de vakjes, en in punten —
    // want dat is wat je op het scherm van de broker ziet staan. De stoploss
    // verschilt per positie, dus de schaal toont die van de zwakste.
    const maat = data.zwakste && data.zwakste.stoploss
      ? data.zwakste.stoploss
      : (data.posities.find((p) => p.stoploss) || {}).stoploss || null;
    const schaal = ZONES.map((z) => {
      const breed = (z.tot - z.van) / RECHTS;
      const bij = maat ? getal((z.van / 100) * maat) : `${getal(z.van, 0)} %`;
      return `<span style="flex:0 0 calc(${(breed * 100).toFixed(2)}% - 4px)">${
        z.van === 0 ? "waardeloos" : z.van === 100 ? "stoploss" : bij}</span>`;
    }).join("");

    return `<section class="paneel">
      <div class="paneelkop">Posities<span class="meta">de ask, van waardeloos tot de stoploss · de zwakste bepaalt de barometer</span></div>
      ${data.posities.length ? regels : `<p class="wbleeg">Deze cyclus heeft nog geen positie.</p>`}
      ${data.posities.length ? `<div class="schaalrij"><span class="schaal">${schaal}</span></div>` : ""}
      ${data.zwakste ? `<div class="zwakste"><b>${ontsnap(data.zwakste.contract || "")}</b> is de zwakste en bepaalt de barometer: ask ${
        getal(data.zwakste.ask)} van een stoploss op ${getal(data.zwakste.stoploss)} — <b>${ontsnap(labelStand(data.zwakste.stand))}</b>.</div>` : ""}
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
      p.wie_volgt ? ["", `Volgt: ${p.wie_volgt}`] : null,
    ].filter(Boolean);

    return `<div class="detail"><div class="dvak">
      <div class="dfeiten">
        ${feit("Premie", getal(p.premie), `${p.aantal ?? "?"} contract${p.aantal === 1 ? "" : "en"}`)}
        ${feit("Ask nu", getal(p.ask), p.ask_is_marktprijs ? "marktprijs" : `bod ${getal(p.bod)}`)}
        ${feit("Open resultaat", getalMet(p.resultaat), p.resultaat_eur === null ? "" : `€ ${getal(p.resultaat_eur, 0)}`)}
        ${feit("Stoploss", getal(p.stoploss), p.tot_stoploss === null ? "" : `${getal(p.tot_stoploss)} te gaan`)}
        ${feit("Strike", getal(p.strike, 0), p.expiratiedatum || "")}
        ${feit("Dagen", p.dagen === null ? "—" : String(p.dagen), p.prijs_minuten_oud === null ? "" : `prijs ${p.prijs_minuten_oud} min oud`)}
      </div>
      <div class="dbalken">
        ${balk("Premie binnen", p.binnen, p.binnen !== null && p.binnen >= 50 ? "var(--grn)" : "var(--amb)")}
        ${balk("Naar de stoploss", p.weg, p.weg !== null && p.weg >= 80 ? "var(--red)" : "var(--blue)")}
      </div>
      <div class="dmerken">
        ${merken.map(([kl, t]) => `<span class="dmerk ${kl}">${ontsnap(t)}</span>`).join("")}
        <a class="knop tweede" href="#/t/positie/${p.id}">Positierecord</a>
      </div>
    </div></div>`;
  }

  const feit = (l, w, n) => `<span class="dfeit"><span class="dlab">${ontsnap(l)}</span>
    <span class="dwaarde">${ontsnap(w)}</span>${n ? `<span class="dnoot">${ontsnap(n)}</span>` : ""}</span>`;
  const balk = (l, pctWaarde, kleur) => pctWaarde === null ? "" : `
    <div class="dbalkrij"><span class="dbalklab">${ontsnap(l)}</span>
      <span class="dbalk"><i style="width:${Math.max(0, Math.min(100, pctWaarde))}%;background:${kleur}"></i></span>
      <span class="dbalkpct">${Math.round(pctWaarde)} %</span></div>`;

  // ------------------------------------------------- kaarten en verstuurd
  function ledenvak() {
    const kaartjes = data.kaarten.map((k) => `<div class="kaart">
      <div class="kaartkop"><h3>${ontsnap(k.titel)}</h3>
        <span class="pt ${k.soort === "doorrol" ? "p-hoog" : k.soort === "positie_gesloten" ? "p-med" : "p-laag"}">${
          k.soort === "doorrol" ? "doorrol" : k.soort === "positie_gesloten" ? "gesloten" : "nieuw"}</span></div>
      ${k.was ? `<div class="omgezet">↻ Was: ${ontsnap(k.was)}</div>` : ""}
      <div class="feiten">${k.feiten.map(([l, w]) =>
        `<span class="feit"><span class="flab">${ontsnap(l)}</span><span class="fwaarde">${ontsnap(w)}</span></span>`).join("")}</div>
      <div class="kaartknoppen">
        <button class="knop tweede" data-nietmelden="${k.id}">Niet melden</button>
        <a class="knop" href="${k.concept ? `#/bericht/${k.concept}` : "#"}" data-concept="${k.id}">${
          k.concept ? "Concept openen" : "Bericht opstellen"}</a>
      </div>
    </div>`).join("");

    return `<section class="paneel">
      <div class="paneelkop">Ledencommunicatie<span class="meta">wat er gebeurde, en wat de leden ervan weten</span></div>
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
    if (e.target.closest("[data-publiceer]")) return publiceer();

    const niet = e.target.closest("[data-nietmelden]");
    if (niet) {
      const reden = window.prompt("Waarom gaat dit niet naar de leden?");
      if (!reden) return;
      const uit = await nietMelden(Number(niet.dataset.nietmelden), reden);
      melding = uit && uit.fout ? uit.fout : null;
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
    const reden = window.prompt("Waarom verandert de stand? Dat is wat de leden lezen.");
    if (!reden) return;
    const uit = await publiceerStand({
      cyclus: cyclusId, stand: kiesStand, venster: kiesVenster, reden,
    });
    if (uit && uit.fout) { melding = uit.fout; return teken(); }
    kiesStand = null; kiesVenster = null; melding = null;
    return haal();
  }

  function opWissel(e) {
    const kies = e.target.closest("[data-cyclus]");
    if (!kies) return;
    cyclusId = Number(kies.value);
    kiesStand = null; kiesVenster = null; open = new Set();
    haal();
  }

  inhoud.addEventListener("click", opKlik);
  inhoud.addEventListener("change", opWissel);

  await haal();

  // De peiling. De brug is de klok; dit scherm kijkt of er iets veranderd is.
  // Niet opnieuw tekenen terwijl je een stand aan het kiezen bent — dan zou het
  // scherm je keuze onder je handen vandaan halen.
  (async function peil() {
    await new Promise((r) => setTimeout(r, 10000));
    if (!leeftNog()) return;
    if (kiesStand === null && kiesVenster === null) await haal();
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
function getalMet(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1).replace(".", ",")}`;
}

