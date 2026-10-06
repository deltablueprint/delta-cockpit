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
import { KLEUR, DIEPROOD, balkHtml, schaalHtml, metriekHtml } from "./positiebalk.js";
import { tijdas, plaatsTijdkaarten, plaatsStrooktips } from "./tijdas.js";

// Het instap venster in zes tinten blauw, van licht naar donker. Eén reeks voor
// het hele scherm: de balkjes boven en de vakjes van de strook eronder horen
// dezelfde taal te spreken. Stond er voor de laatste stand groen, dan leek dat
// een oordeel — groen is goed — terwijl het gewoon het eind van het verloop is.
const VENSTERKLEUR = ["#DCE7EE", "#C9DCE7", "#ACC8D9", "#8CB0C7", "#6693B2", "#3D7598", "#0E4E70"];

// Elk bezoek krijgt een nummer. Klik je weg terwijl de peiling loopt, dan tekent
// het antwoord dat daarna binnenkomt niet meer over het scherm waar je inmiddels
// bent. Dat is een keer misgegaan en kostte iemand zijn halve formulier.
let bezoek = 0;

// Wat we de vorige keer tekenden. Klik je in de bovenste strip een andere cyclus
// aan, dan hoort die strip te blijven staan terwijl de schermen eronder laden:
// het is de plek waar je zonet klikte, en een balk die wegvalt om een halve
// seconde later terug te komen laat je twijfelen of je klik aankwam. Ook hoever
// de strip geschoven stond blijft zo bewaard.
let vorige = null;
let strookX = 0;

export async function werkbankscherm(inhoud, kruimel, opties = {}) {
  const dit = ++bezoek;
  const leeftNog = () =>
    dit === bezoek
    && location.hash.slice(1).split("?")[0] === "/werkbank"
    && document.body.contains(inhoud);

  // Een terugblik is elke cyclus die niet de lopende is. Daar gaat niets meer
  // naar de leden: het scherm leest, het schrijft niet.
  const terugblik = () => !!(data && data.cyclus && data.actief && data.cyclus.id !== data.actief);

  // Welke cyclus je bekijkt staat in de url (#/werkbank?cyclus=12). Zonder is
  // het de lopende; met is het een terugblik op een afgelopen cyclus.
  let cyclusId = Number(opties.cyclus) || null;
  let kiesStand = null;      // welke barometerstand je aanklikte
  let kiesVenster = null;    // welke vensterstand je aanklikte
  let open = new Set();      // welke posities uitgeklapt staan
  let melding = null;
  let nietMeldenVoor = null;   // de kaart waarvan je aan het opschrijven bent waarom hij niet weg gaat
  let data = vorige;

  // Wat er veranderde terwijl jij keek.
  //
  // De brug ziet een positie opengaan of sluiten; tien seconden later staat het
  // op dit scherm. Zonder merkteken schuift er dan een regel in de lijst zonder
  // dat je weet dat hij nieuw is — en dat is precies het moment waarop er iets
  // naar de leden moet. Het merkteken hoort bij het kijken, niet bij het record:
  // het leeft zolang deze pagina openstaat en is na een herlaadbeurt weg. Wat er
  // nog gemeld moet worden staat niet hier maar in de kaarten.
  let gezien = null;             // null = nog niet gepeild; dan is niets 'nieuw'
  const netVeranderd = new Map();  // positie -> geopend | gesloten

  function merkVerandering(uit) {
    const nu = new Map();
    for (const k of uit.kaarten || []) {
      const wat = k.soort === "positie_gesloten" ? "gesloten"
                : k.soort === "doorrol" ? "doorgerold" : "geopend";
      for (const id of k.ids || []) nu.set(id, { wat, positie: k.positie, tweede: k.tweede_positie });
    }
    // De eerste peiling van deze pagina is de nulmeting: wat er dan al staat,
    // stond er al voor je kwam kijken.
    if (gezien === null) { gezien = new Set(nu.keys()); return; }
    for (const [id, v] of nu) {
      if (gezien.has(id)) continue;
      gezien.add(id);
      if (v.positie) netVeranderd.set(v.positie, v.wat);
      if (v.tweede) netVeranderd.set(v.tweede, v.wat);
    }
  }

  async function haal() {
    try {
      const uit = await haalWerkbank(cyclusId);
      if (!leeftNog()) return;
      merkVerandering(uit);
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
    vorige = data;
    document.title = "Dispatch · Delta Wave Cockpit";
    kruimel.innerHTML = `<span>Communicatie</span> <span class="pijlje">&rsaquo;</span> <span>Dispatch</span>`;

    if (!data.cyclus) {
      inhoud.innerHTML = `<div class="werkbank">${cyclusbalk()}
        <p class="wbleeg">Er loopt geen cyclus. Open er een om te beginnen.</p></div>`;
      naStrook();
      return;
    }

    inhoud.innerHTML = `<div class="werkbank">
      ${cyclusbalk()}
      ${kop()}
      <div class="wbkolommen">
        <div class="wbhoofd">
          ${standvak()}
          ${looptijdvak()}
          ${positievak()}
          ${ledenvak()}
        </div>
      </div>
    </div>`;

    naStrook();

    // De hoverkaarten op de tijdas zweven boven alles; waar ze komen te staan is
    // pas te weten als het scherm er staat.
    plaatsTijdkaarten(inhoud);
    plaatsStrooktips(inhoud);
  }

  // ---------------------------------------------------- welke cyclus je ziet
  //
  // Dispatch is niet alleen het nu. Een afgelopen cyclus openen laat zien hoe de
  // standen zich over de hele looptijd ontwikkeld hebben — de strook
  // handelsdagen, de berichten die eruit gingen, de tranches zoals ze eindigden.
  // Links de lopende cyclus, rechts de tegels van wat erop zit.
  function cyclusbalk() {
    const lopend = (data.cycli || []).find((c) => c.id === data.actief) || null;
    const nu = cyclusId || (data.cyclus ? data.cyclus.id : null);

    // Elke tegel is hetzelfde opgebouwd: naam, periode, status. Alleen het
    // uiterlijk verschilt — de lopende cyclus staat wit met een blauwe rand, de
    // afgelopen staan zacht en randloos. Ze zijn naslag; ze horen de blik niet
    // te trekken. Het resultaat staat er niet op: dat verhaal hoort in een
    // post-analyse, niet in een keuzebalk.
    const STATUS = { afgesloten: "Afgerond", geannuleerd: "Geannuleerd" };
    const status = (c) => STATUS[c.status]
      || String(c.status || "").charAt(0).toUpperCase() + String(c.status || "").slice(1);

    const tegel = (c, { actief = false, url }) => {
      const periode = [c.geopend_op, c.gesloten_op || c.doelexpiratie]
        .filter(Boolean).map(kortedatum).join(" – ");
      return `<a class="cbtegel${actief ? " actief" : ""}${c.id === nu ? " aan" : ""}" href="${url}">
        <span class="cbnaam">${ontsnap(c.label || `Cyclus ${c.id}`)}</span>
        <span class="cbper">${ontsnap(periode || "—")}</span>
        <span class="cbst">${ontsnap(status(c))}</span>
      </a>`;
    };

    const tegels = (data.afgelopen || [])
      .map((c) => tegel(c, { url: `#/werkbank?cyclus=${c.id}` })).join("");

    // De lopende cyclus staat vast aan de linkerkant en schuift niet mee: dat is
    // waar je werkt. De pijl naar links hoort dus niet links daarvan maar tussen
    // die tegel en de historie, want hij bladert door de historie.
    return `<div class="cyclusbalk">
      ${lopend ? tegel(lopend, { actief: true, url: "#/werkbank" })
        : `<span class="cbgeen">Er loopt geen cyclus.</span>`}
      ${tegels ? `<span class="cbscheiding"></span>
        <button class="cbpijl" data-schuif="-1" aria-label="Naar links">&lsaquo;</button>` : ""}
      <div class="cbstrook">${tegels}</div>
      ${tegels ? `<button class="cbpijl" data-schuif="1" aria-label="Naar rechts">&rsaquo;</button>` : ""}
    </div>`;
  }

  // De strook onthoudt waar hij stond: het scherm tekent zichzelf elke tien
  // seconden opnieuw, en een strook die dan terugspringt is niet te gebruiken.
  function naStrook() {
    const strook = inhoud.querySelector(".cbstrook");
    if (!strook) return;
    strook.scrollLeft = strookX;
    strook.addEventListener("scroll", () => { strookX = strook.scrollLeft; });
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
      <span class="wbachter ${wacht ? "wacht" : "bij"}"><span class="stip"></span><span>${
        wacht ? `Wacht op de leden: ${ontsnap(wat)}` : "De leden zijn bij"}</span></span>
    </div>`;
  }

  // --------------------------------------------- het venster en de barometer
  function standvak() {
    const b = data.barometer;
    const v = data.venster;
    const toonVenster = kiesVenster ?? v.nu;
    // De wijzer staat op wat de léden kennen, altijd. Hij stond op onze eigen
    // vastlegging, en dan wijst het scherm een stand aan die buiten dit scherm
    // nog nergens bestaat. Wat wij ervan vinden is een stippellijn: het systeem
    // stelt er een voor (rood), wij kiezen er een (blauw), en pas als het
    // bericht weg is draait de wijzer mee.
    const toonStand = b.leden ? Number(b.leden.stand.waarde) : null;
    const onzeStand = kiesStand ?? (b.wij ? Number(b.wij.stand.waarde) : null);

    // Het venster krijgt geen systeemvoorstel. Het is een oordeel over de markt,
    // en juist dat is voor een lid het meeste waard — een systeem dat het zelf
    // zet, zet het een keer verkeerd (BOUWSPEC §13a).
    //
    // En er staan er nooit drie tegelijk. In de praktijk lopen er twee standen
    // uit elkaar: wat de leden kennen en wat eraan komt. Ligt er al iets van ons
    // klaar dat nog niet gemeld is, dan zwijgt het systeem tot dat bericht weg
    // is — anders kijk je naar een voorstel over een stand die de leden nog niet
    // eens hebben. Klik je het voorstel aan, dan wordt de rode stippellijn
    // blauw: hetzelfde vak, nu van ons.
    const ietsOnderweg = onzeStand !== null && onzeStand !== toonStand;
    const standTip = !ietsOnderweg && b.voorstel !== null
      && b.wij && Number(b.wij.stand.waarde) !== b.voorstel
      ? b.voorstel : null;

    // Het venster is een verloop, en dus leest het als een balk die volloopt:
    // wat geweest is lichtblauw, waar we staan donkerblauw, wat nog komt grijs.
    // Zes even zware blokjes lieten dat verloop juist niet zien. Het blauwe
    // segment blijft staan terwijl je kiest — zo zie je naast elkaar wat
    // vastligt en wat je ervan wil maken; staat de keuze op hetzelfde segment,
    // dan wint groen (die regel staat in de opmaak).
    // Het venster loopt van lichtblauw naar donkerblauw: de kleur zegt hóe ver je
    // in het verloop zit, en dat is voor elke cyclus hetzelfde. Waar we nu staan
    // zegt de dikte van het balkje, niet de kleur — anders betekent donkerblauw
    // de ene keer 'afgerond' en de andere keer 'hier staan we'.
    const vakje = (x, i) => {
      const kl = [
        v.verloop.indexOf(x.waarde) < v.verloop.indexOf(v.nu) ? "gehad" : "",
        x.waarde === v.nu ? "nu" : "",
        kiesVenster === x.waarde ? "gekozen" : "",
      ].filter(Boolean).join(" ");
      return `<button class="vstap ${kl}" data-venster="${x.waarde}">
        <span class="vbalk" style="background:${VENSTERKLEUR[i] || VENSTERKLEUR[VENSTERKLEUR.length - 1]}"></span>
        <span class="nm">${ontsnap(x.label)}</span></button>`;
    };

    // Wat er verandert, in beeld: van welke stand naar welke, in de kleuren van
    // de balk en de meter zelf. Een zin met twee vette woorden erin liet je nog
    // steeds zelf uitzoeken wat er nu precies anders wordt.
    const chip = (tekst, kleur) => `<span class="pubchip" style="background:${kleur}">${ontsnap(tekst)}</span>`;
    const vensterkleur = (w) => VENSTERKLEUR[(v.verloop || []).indexOf(w)] || "var(--b1)";
    const standkleur = (n) => KLEUR[Number(n) - 1] || "var(--dim)";

    const wissels = [];
    // Waar het vandaan komt is wat de léden kennen, niet wat wij ooit vastlegden:
    // het bericht dat hieruit volgt verandert hún stand. Stond er een oude
    // vastlegging die nooit gemeld is, dan wees de pijl van een stand naar
    // diezelfde stand terwijl de leden iets anders kenden.
    if (kiesVenster !== null) {
      const vanafW = v.gepubliceerd || v.nu;
      wissels.push(`<div class="pubwissel"><span class="publabel">Instap venster</span>
        ${chip(labelVenster(vanafW), vensterkleur(vanafW))}
        <span class="pubpijl">→</span>
        ${chip(labelVenster(kiesVenster), vensterkleur(kiesVenster))}</div>`);
    }
    if (kiesStand !== null) {
      const vanaf = b.leden ? Number(b.leden.stand.waarde) : (b.wij ? Number(b.wij.stand.waarde) : null);
      wissels.push(`<div class="pubwissel"><span class="publabel">Positie Barometer</span>
        ${vanaf ? chip(labelStand(vanaf), standkleur(vanaf)) : `<span class="pubchip leeg">nog niets</span>`}
        <span class="pubpijl">→</span>
        ${chip(labelStand(kiesStand), standkleur(kiesStand))}</div>`);
    }
    const stuk = wissels;

    return `<section class="paneel">
      <div class="paneelkop">Stand naar de leden</div>

      <div class="paneelbody standbody">
        <div class="standlinks">
        <div class="deel">
          <div class="deelkop"><span class="dtitel">Instap venster</span></div>
          <div class="dstaat">${vensteronder()}</div>
          <div class="vensterrij">${vensters().map(vakje).join("")}</div>
          ${dagstrook("venster")}
        </div>

        <div class="deel${b.wakker ? "" : " uit"}">
          <div class="deelkop"><span class="dtitel">Positie Barometer</span></div>
          ${eensgezind(standTip)}
          <div class="meterrij">
            <div class="gauge">${meter(toonStand, standTip, onzeStand)}
              <div class="gaugetekst">
                <div class="gaugenaam">${toonStand ? ontsnap(labelStand(toonStand)) : "nog niets gemeld"}</div>
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
        ${ketenvak()}
      </div>

      ${terugblik() ? `<div class="publiceerbalk"><div class="pubrij">
        <span class="pubtekst">Terugblik: deze cyclus is afgerond. Er gaat hier niets meer naar de leden.</span>
      </div></div>` : stuk.length ? `
      <div class="publiceerbalk open">
        <div class="pubvak">
          <div class="pubwissels">${stuk.join("")}</div>
          <label class="pubvraag" for="pubreden">Waarom verandert de stand? Dat is wat de leden lezen.</label>
          <textarea id="pubreden" class="pubreden" rows="2"
            placeholder="Bijvoorbeeld: de ask liep op tot vlak onder de stoploss."></textarea>
          <div class="pubrij">
            <button class="knop" data-publiceer disabled>Publiceren</button>
            <button class="knop tweede" data-afbreken>Annuleren</button>
            ${melding ? `<span class="wbmelding">${ontsnap(melding)}</span>` : ""}
          </div>
        </div>
      </div>` : melding ? `<div class="publiceerbalk"><div class="pubrij">
        <span class="wbmelding">${ontsnap(melding)}</span></div></div>` : ""}
    </section>`;
  }

  // ------------------------------------------- onderweg naar de leden
  //
  // Tussen 'wij hebben iets vastgelegd' en 'de leden weten het' zit een bericht.
  // Dat bericht kan blijven liggen — bij de opsteller, of bij een nalezer — en
  // zolang dat zo is lopen de leden achter zonder dat iemand het ziet. Deze
  // kolom is die tussenruimte, als vier stappen: vastgelegd, geschreven, bij de
  // nalezer, bij de leden. Waar het stilstaat, staat het stil in beeld.
  function ketenvak() {
    const o = data.onderweg;

    // Klik je een stand aan, dan begint het proces opnieuw — en dat hoort hier
    // meteen te staan. Anders kijk je naar de keten van het vorige bericht
    // terwijl je al met het volgende bezig bent.
    if (kiesStand !== null || kiesVenster !== null) {
      const b = data.barometer;
      const v = data.venster;
      const stukjes = [
        kiesVenster !== null ? `venster ${labelVenster(kiesVenster)}` : null,
        kiesStand !== null ? labelStand(kiesStand) : null,
      ].filter(Boolean).join(" · ");
      const nieuw = [
        { naam: "Stand gekozen", noot: `${stukjes} — nog niet vastgelegd` },
        { naam: "Bericht schrijven", noot: "komt er zodra je publiceert" },
        { naam: "Nalezen", noot: "—" },
        { naam: "Bij de leden", noot: `${
          (b.leden || v.gepubliceerd) ? "zij kennen nu nog de vorige stand" : "nog niets gemeld"}` },
      ];
      return `<aside class="keten">
        <div class="ketenkop">Onderweg naar de leden</div>
        ${nieuw.map((x, i) => `<div class="kstap">
          <div class="kspoor"><span class="kbol ${i === 0 ? "nu" : ""}"></span>${
            i < nieuw.length - 1 ? `<span class="klijn"></span>` : ""}</div>
          <div class="kinh"><div class="knaam ${i === 0 ? "nu" : ""}">${ontsnap(x.naam)}</div>
            <div class="knoot">${ontsnap(x.noot)}</div></div>
        </div>`).join("")}
        <div class="ketenlet"><span>!</span><span>Vul de reden in en publiceer; dan staat het concept klaar.</span></div>
      </aside>`;
    }

    // Is er niets onderweg, dan is de ketting rond, en dat hoort te staan als een
    // ketting die rond is — vier groene stappen — en niet als een leeg vakje.
    // Pas als je een andere stand aanklikt begint het opnieuw.
    if (!o) {
      const g = data.gemeld;
      if (!g) {
        return `<aside class="keten">
          <div class="ketenkop">Onderweg naar de leden</div>
          <p class="ketenleeg">Er is nog niets vastgelegd voor deze cyclus.</p>
        </aside>`;
      }
      const af = [
        { naam: "Stand vastgelegd",
          noot: `${g.venster ? labelVenster(g.venster) : ""}${g.venster && g.stand ? " · " : ""}${
            g.stand ? labelStand(Number(g.stand)) : ""} · ${klok(g.vastgesteld_op)}${g.wie ? ` · ${g.wie}` : ""}` },
        { naam: "Bericht geschreven", noot: g.titel || "—" },
        { naam: "Nagelezen en verstuurd",
          noot: `${klok(g.verstuurd_op || g.gepubliceerd_op)}${g.verstuurder ? ` · ${g.verstuurder}` : ""}` },
        { naam: "Bij de leden",
          noot: g.leden ? `${g.leden} ${g.leden === 1 ? "lid" : "leden"} hebben dit` : "verstuurd" },
      ];
      return `<aside class="keten">
        <div class="ketenkop">Onderweg naar de leden</div>
        ${af.map((x, i) => `<div class="kstap">
          <div class="kspoor"><span class="kbol klaar"></span>${
            i < af.length - 1 ? `<span class="klijn klaar"></span>` : ""}</div>
          <div class="kinh"><div class="knaam klaar">${ontsnap(x.naam)}</div>
            <div class="knoot">${ontsnap(x.noot)}</div></div>
        </div>`).join("")}
        <div class="ketenrond">Rond. Wat wij weten, weten de leden.</div>
      </aside>`;
    }

    const bericht = o.publicatie ? o.bericht_status : null;
    const stap = !o.publicatie ? 1                       // vastgelegd, nog geen bericht
      : bericht === "nalezen" ? 2                        // ligt bij een nalezer
      : bericht === "klaar" ? 3                          // nagelezen, nog niet weg
      : 2;                                               // concept bij de opsteller

    const stappen = [
      { naam: "Stand vastgelegd",
        noot: `${o.venster ? labelVenster(o.venster) : ""}${o.venster && o.stand ? " · " : ""}${
          o.stand ? labelStand(Number(o.stand)) : ""} · ${klok(o.vastgesteld_op)}${
          o.wie ? ` · ${o.wie}` : ""}` },
      { naam: o.publicatie ? "Concept geschreven" : "Nog geen bericht",
        noot: o.publicatie ? (o.titel || "zonder titel") : "er is niets opgesteld om te versturen" },
      { naam: o.nalezer ? `Ligt bij ${o.nalezer}` : "Ligt bij jou",
        noot: bericht === "klaar" ? "nagelezen · klaar om te versturen"
          : o.publicatie ? "nog niet verstuurd" : "—" },
      { naam: "Bij de leden",
        noot: o.leden ? `${o.leden} ${o.leden === 1 ? "lid" : "leden"} krijgen dit` : "nog niemand" },
    ];

    const rijen = stappen.map((x, i) => {
      const kl = i < stap ? "klaar" : i === stap ? "nu" : "";
      return `<div class="kstap">
        <div class="kspoor"><span class="kbol ${kl}"></span>${
          i < stappen.length - 1 ? `<span class="klijn"></span>` : ""}</div>
        <div class="kinh"><div class="knaam ${kl}">${ontsnap(x.naam)}</div>
          <div class="knoot">${ontsnap(x.noot)}</div></div>
      </div>`;
    }).join("");

    return `<aside class="keten">
      <div class="ketenkop">Onderweg naar de leden</div>
      ${rijen}
      ${o.publicatie ? `<div class="ketenknoppen">
        <a class="knop" href="#/bericht/${o.publicatie}?van=werkbank">Concept openen</a>
      </div>` : ""}
      <div class="ketenlet"><span>!</span><span>${o.publicatie
        ? "Dit bericht moet eerst weg. Zolang het ligt, kennen de leden de oude stand."
        : "Er is een stand vastgelegd zonder bericht. De leden horen er niets van tot er een bericht uitgaat."}</span></div>
    </aside>`;
  }

  const klok = (t) => String(t || "").slice(0, 16).replace("T", " ");

  // Hoe lang geleden, zoals je dat bij berichten gewend bent: 3m, 2u, 4d. Een
  // tijdstip van vanmorgen zegt je niets over hoe vers het is; 'net' en '3m'
  // wel. Na vijf dagen is het geen nieuws meer en staat er gewoon de datum.
  function geleden(t) {
    if (!t) return "—";
    const toen = Date.parse(String(t).replace(" ", "T") + (String(t).length <= 19 ? "Z" : ""));
    if (!Number.isFinite(toen)) return kortedatum(String(t).slice(0, 10));
    const sec = Math.max(0, (Date.now() - toen) / 1000);
    if (sec < 60) return "net";
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}u`;
    const dagen = Math.floor(sec / 86400);
    if (dagen <= 5) return `${dagen}d`;
    return kortedatum(String(t).slice(0, 10));
  }

  // Zijn het systeem en de leden het eens? Groen als wat het systeem meet
  // hetzelfde is als wat de leden kennen: dan staat de barometer waar hij hoort
  // en hoeft er niets. Oranje als ze uit elkaar lopen — dan moet er iets, en
  // staat erbij wat en waarom.
  function eensgezind(standTip = null) {
    const b = data.barometer;
    if (!b.wakker || terugblik()) return "";
    if (b.voorstel === null) return "";
    const zij = b.leden ? Number(b.leden.stand.waarde) : null;
    const waarom = data.zwakste
      ? ` — ${ontsnap(data.zwakste.contract || "de zwakste positie")} staat op ${
          getal(data.zwakste.ask)} van een stoploss op ${getal(data.zwakste.stoploss)}`
      : "";

    const pil = (n) => `<span class="standpil" style="background:${KLEUR[Number(n) - 1] || "var(--dim)"}">${
      ontsnap(labelStand(Number(n)))}</span>`;

    if (b.voorstel === zij) {
      return `<div class="eens goed"><span class="eensvk"></span><span>
        Het systeem meet ${pil(b.voorstel)} — dat is wat de leden kennen${waarom}.</span></div>`;
    }
    // Loopt het uit elkaar, dan hangt het ervan af of er al iets van ons klaar
    // ligt. Zo ja, dan is de handeling niet 'kies een stand' maar 'stuur dat
    // bericht'.
    const onsKlaar = kiesStand === null && standTip === null && data.onderweg;
    return `<div class="eens let"><span class="eensvk puls"></span><span>
      Het systeem meet ${pil(b.voorstel)}, de leden kennen ${
        zij ? pil(zij) : `<span class="standpil leeg">nog niets</span>`}${waarom}. ${
        onsKlaar ? "Er ligt al een stand klaar die nog niet gemeld is."
          : "Klik het pulserende vak aan en publiceer."}</span></div>`;
  }

  const vensters = () => (data.barometer.vensters || []).length
    ? data.barometer.vensters
    : data.venster.verloop.map((w) => ({ waarde: w, label: w }));
  const labelVenster = (w) => (vensters().find((x) => x.waarde === w) || { label: w }).label;
  const labelStand = (n) => {
    const s = (data.barometer.schaal || []).find((x) => String(x.waarde) === String(n));
    return s ? s.label : String(n);
  };

  // Hetzelfde voor het venster.
  function vensteronder() {
    const v = data.venster;
    if (kiesVenster !== null) return "gekozen — nog niet gemeld";
    if (!v.gepubliceerd) return "nog niet gemeld";
    if (v.gepubliceerd === v.nu) return "de leden weten dit";
    return `nog niet gemeld · de leden kennen ${ontsnap(labelVenster(v.gepubliceerd))}`;
  }

  // De meter. Vijf vakjes met lucht ertussen: aaneengesloten lezen ze als één
  // verloop, los lezen ze als vijf standen — en dat zijn het.
  function meter(toon, tip, ons) {
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
      // Wat wij ervan vinden staat als stippellijn om het vak. Rood zolang het
      // alleen een voorstel van het systeem is, blauw zodra wij het aanklikken
      // of vastleggen. Staat onze stand gelijk aan die van de leden, dan is er
      // niets onderweg en hoeft er geen lijn te staan.
      const onsHier = ons === stand && ons !== toon;
      const voorgesteld = tip === stand && !onsHier;
      // Het voorgestelde vak pulseert zelf. Een stippellijntje eromheen zag je
      // over het hoofd; dit is het enige op het scherm dat om een handeling
      // vraagt, dus mag het bewegen.
      svg += `<path class="seg${voorgesteld ? " puls" : ""}" data-stand="${stand}" d="${sector(a0, a1, RO, RI)}" fill="${KLEUR[stand - 1]}"
        opacity="${stand === toon ? 1 : onsHier ? 0.85 : voorgesteld ? 1 : 0.72}"></path>`;
      if (onsHier) svg += `<path d="${sector(a0, a1, RO + 5, RI - 5)}" fill="none" stroke="#136289" stroke-width="3" stroke-dasharray="6 4"></path>`;
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
    const b = data.barometer;
    // 'nu' is wat de leden kennen — hetzelfde als waar de wijzer op staat.
    // 'gekozen' is wat wij ervan vinden en nog niet gemeld is, 'tip' wat het
    // systeem voorstelt. Dezelfde drie betekenissen als op de meter.
    const nu = b.leden ? Number(b.leden.stand.waarde) : null;
    const ons = kiesStand ?? (b.wij ? Number(b.wij.stand.waarde) : null);
    return [1, 2, 3, 4, 5].map((stand) => {
      const onsHier = ons === stand && ons !== nu;
      const kl = [stand === nu ? "nu" : "", tip === stand && !onsHier ? "tip" : "",
                  onsHier ? "gekozen" : ""].filter(Boolean).join(" ");
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


    const weken = [];
    for (const d of dagen) {
      const laatste = weken[weken.length - 1];
      if (laatste && laatste.week === d.week) laatste.dagen.push(d);
      else weken.push({ week: d.week, dagen: [d] });
    }

    // De strook tekent wat de léden die dag wisten, niet wat wij die dag
    // vastlegden. Dat was precies de dubbelzinnigheid: onder de barometer stond
    // twee dagen een stand die de leden nooit gekregen hadden, terwijl de regel
    // ernaast zei dat zij iets anders kenden. Eén strook, één betekenis — en de
    // dagen waarop wij al meer wisten staan open, met onze kleur als rand. Zo
    // zie je in één blik hoeveel dagen zij achterlopen.
    const vakje = (d) => {
      if (wat === "venster") {
        const verloop = data.venster.verloop || [];
        const iZij = verloop.indexOf(d.gemeld_venster);
        const iWij = verloop.indexOf(d.venster);
        const achter = iWij >= 0 && iWij !== iZij;
        const kleur = iZij < 0 ? "var(--b2)" : VENSTERKLEUR[iZij];
        const tip = `${kortedatum(d.dag)} · de leden: ${
          d.gemeld_venster ? labelVenster(d.gemeld_venster) : "nog niets gemeld"}${
          achter ? ` · wij: ${labelVenster(d.venster)}` : ""}`;
        return achter
          ? `<i class="open" style="border-color:${iWij < 0 ? "var(--b1)" : VENSTERKLEUR[iWij]}" data-tip="${ontsnap(tip)}"></i>`
          : `<i style="background:${kleur}" data-tip="${ontsnap(tip)}"></i>`;
      }
      // De barometer slaapt tot wij in positie zitten: op die dagen is er geen
      // stand, en dan hoort er ook geen kleur te staan.
      const leeft = (w) => w === "in_positie" || w === "posities_innemen";
      const inPositie = leeft(d.gemeld_venster) || leeft(d.venster);
      const zij = inPositie && d.gemeld_stand >= 1 && d.gemeld_stand <= 5 ? Number(d.gemeld_stand) : null;
      const wij = inPositie && d.stand >= 1 && d.stand <= 5 ? Number(d.stand) : null;
      const achter = wij !== null && wij !== zij;
      const tip = `${kortedatum(d.dag)} · de leden: ${zij ? labelStand(zij) : "geen stand gemeld"}${
        achter ? ` · wij: ${labelStand(wij)}` : ""}`;
      return achter
        ? `<i class="open" style="border-color:${KLEUR[wij - 1]}" data-tip="${ontsnap(tip)}"></i>`
        : `<i style="background:${zij ? KLEUR[zij - 1] : "var(--b2)"}" data-tip="${ontsnap(tip)}"></i>`;
    };

    const eerste = dagen[0].dag, laatste = dagen[dagen.length - 1].dag;
    return `<div class="strookvak">
      <div class="strooklab">Historie</div>
      <div class="strook">
        ${weken.map((w) => `<span class="week" title="week ${w.week}">${
          w.dagen.map(vakje).join("")}</span>`).join("")}
      </div>
      <div class="strookdata"><span>${ontsnap(kortedatum(eerste))}</span><span>${
        ontsnap(kortedatum(laatste))}</span></div>
    </div>`;
  }

  // '2026-09-25' wordt '25 sep'. Het jaar hoort er niet bij: een cyclus loopt
  // weken, niet jaren, en een jaartal bij elke datum is ruis.
  const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function kortedatum(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
    return m ? `${Number(m[3])} ${MAANDEN[Number(m[2]) - 1]}` : String(d || "");
  }

  // Eén vakje per dag, in de kleur van de stand waarop de tranche die dag sloot.
  // In het verlengde van haar eigen regel, zodat je in één blik ziet hoe ze van
  // kleur veranderde: van groen naar oranje is een verhaal, een los getal niet.
  function dagen(p) {
    const rijen = (data.geschiedenis && data.geschiedenis.verloop[p.id]) || [];
    if (!rijen.length) return "";

    // De strook loopt over de hele looptijd: van de dag dat de tranche openging
    // tot de expiratie. Een dag zonder meting is grijs — dat is of het verleden
    // waarin niemand mat, of de toekomst die nog moet komen. Zo zie je in één
    // blik hoe het ging én hoeveel dagen er nog te gaan zijn.
    const weken = [];
    for (const r of rijen) {
      const laatste = weken[weken.length - 1];
      if (laatste && laatste.week === r.week) laatste.dagen.push(r);
      else weken.push({ week: r.week, dagen: [r] });
    }

    const vakje = (r) => {
      const st = Number(r.stand);
      // De laatste dag van een afgeronde tranche draagt haar uitkomst, niet een
      // stand: toen was het klaar.
      const kleur = r.slot === "winst" ? "var(--grn)"
                  : r.slot === "verlies" ? DIEPROOD
                  : st >= 1 && st <= 5 ? KLEUR[st - 1] : "var(--b2)";
      const wat = r.slot ? r.uitkomst : st ? labelStand(st) : "niet gemeten";
      return `<i style="background:${kleur}" data-tip="${ontsnap(
        `${kortedatum(r.dag)} · ${wat}${
          r.binnen === null || r.binnen === undefined ? "" : ` · ${getalMet(r.binnen, 0)} % binnen`}`)}"></i>`;
    };

    return `<div class="posdagen">
      <div class="strook">${weken.map((w) => `<span class="week">${
        w.dagen.map(vakje).join("")}</span>`).join("")}</div>
      <div class="strookdata"><span>${ontsnap(kortedatum(rijen[0].dag))}</span><span>${
        ontsnap(kortedatum(rijen[rijen.length - 1].dag))}</span></div>
    </div>`;
  }

  // De looptijd met de events erop, tussen de stand en de posities: eerst wat we
  // de leden vertellen, dan wat er in de weken voor ons ligt, dan de tranches
  // zelf. Een event dat over drie dagen komt verandert hoe je naar die tranches
  // kijkt, dus hoort het ervóór te staan.
  function looptijdvak() {
    const c = data.cyclus || {};
    const laatste = data.posities
      .map((p) => p.expiratiedatum).filter(Boolean).sort().pop();
    const as = tijdas({
      van: c.geopend_op,
      tot: c.doelexpiratie || laatste,
      events: data.events || [],
      extra: data.posities.map((p) => p.expiratiedatum).filter(Boolean),
    });

    // En onder de as de tranches die nu open staan, elk als een balk van de dag
    // dat hij geplaatst werd tot zijn expiratie. Zo zie je in één oogopslag welk
    // event binnen welke looptijd valt — dat is precies de vraag die je bij een
    // event stelt: raakt dit een positie die we nog hebben?
    // In welke zone de tranche staat, als pil aan het eind van haar balk. De
    // balk zelf is rustig grijs — die gaat over tijd — maar waar de tranche
    // staat hoort er wel bij: anders moet je twee panelen naast elkaar leggen.
    const zonepil = (p) => {
      if (p.voorbij_de_grens) {
        return `<span class="looppil" style="background:${DIEPROOD}">Voorbij de stoploss</span>`;
      }
      if (!p.stand) return "";
      return `<span class="looppil" style="background:${KLEUR[Number(p.stand) - 1]}">${
        ontsnap(labelStand(Number(p.stand)))}</span>`;
    };

    const lopend = (data.posities || []).filter((p) => p.open);
    const balken = lopend.map((p) => {
      const a = as.plek(p.geopend_op);
      const b = as.plek(p.expiratiedatum);
      if (a === null || b === null) return "";
      const links = Math.min(a, b);
      const breed = Math.max(2, Math.abs(b - a));
      // Allemaal dezelfde rustige kleur. De stand van een tranche staat in haar
      // eigen balk; hier gaat het over tijd, en drie felle kleuren naast elkaar
      // zeiden iets over gezondheid wat deze strook helemaal niet toont.
      const kleur = "#ECEAE5";
      const naam = p.contract || `Tranche ${p.tranche}`;
      return `<div class="tijdrij looprij"><div class="tijdspoor loopspoor">
        <span class="loopnu" style="left:${as.vandaagP}%"></span>
        <span class="loopbalk" style="left:${links}%;width:${breed}%;background:${kleur}"
          title="${ontsnap(naam)} — ${ontsnap(kortedatum(p.geopend_op))} tot ${ontsnap(kortedatum(p.expiratiedatum))}">
          <span class="loopnaam">${ontsnap(naam)}</span>${zonepil(p)}</span>
      </div></div>`;
    }).join("");

    return `<section class="paneel">
      <div class="paneelkop">Posities in looptijd<span class="meta">${
        (data.events || []).length} ${(data.events || []).length === 1 ? "event" : "events"}</span></div>
      <div class="tijdblok breed">${as.asHtml}${balken}</div>
    </section>`;
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
      const net = netVeranderd.get(p.id) || null;
      return `<div class="posblok ${uit ? "uitgeklapt" : ""}${net ? " net" : ""}">
        <button class="pos ${p.open ? "" : "posdicht"}" data-pos="${p.id}">
          <span class="poslinks"><span class="chev">${uit ? "▾" : "▸"}</span><span>
            <span class="posnaam">${ontsnap(p.contract || `Tranche ${p.tranche}`)}</span>${
              net ? `<span class="netvlag">zojuist ${ontsnap(net)}</span>` : ""}<br>
            <span class="posonder">${ontsnap(onderschrift(p))}</span></span></span>
          ${balkHtml(p, VAKKEN)}
        </button>
        ${dagen(p)}
        ${uit ? detail(p) : ""}
      </div>`;
    }).join("");

    // De schaal eronder staat op dezelfde plekken als de vakken, met de
    // ask-niveaus van de zwakste tranche erbij. De namen van de standen staan
    // er niet nog eens: die staan rechts op elke regel.
    const ijk = (data.posities.find((p) => p.ijk && p.open) || {}).ijk || null;

    return `<section class="paneel">
      <div class="paneelkop">Gezondheid posities</div>
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

  // Eén verstuurd bericht in het overzicht. Dit stond vroeger rechts als een
  // aparte geschiedenis van standen, los van de berichten waarin die standen
  // naar de leden gingen — twee lijsten over hetzelfde. Wat de leden weten staat
  // in wat zij gekregen hebben, dus staat het hier: de stand die erin stond, naar
  // hoeveel leden het ging, wie het verstuurde, en één klik naar het bericht.
  function berichtregel(v) {
    const chips = [];
    if (v.venster) {
      chips.push(`<span class="gstuk">venster <b>${ontsnap(labelVenster(v.venster))}</b></span>`);
    }
    if (v.stand) {
      chips.push(`<span class="gstuk"><span class="gvlak" style="background:${
        KLEUR[Number(v.stand) - 1] || "var(--dim)"}"></span><b>${
        ontsnap(labelStand(Number(v.stand)))}</b></span>`);
    }
    const voet = [
      v.leden ? `${v.leden} ${v.leden === 1 ? "lid" : "leden"}` : null,
      v.wie ? ontsnap(v.wie) : null,
    ].filter(Boolean).join(" · ");

    return `<a class="vreg" href="#/bericht/${v.id}?van=werkbank">
      <span class="vink">✓</span>
      <span class="kern">
        <b>${ontsnap(v.titel || v.soort)}</b>
        ${chips.length ? `<span class="vchips">${chips.join("")}</span>` : ""}
        <span>${ontsnap(String(v.tekst || "").replace(/\s+/g, " ").slice(0, 90))}</span>
        ${voet ? `<span class="vvoet">${voet}</span>` : ""}
      </span>
      <span class="tijd" data-tip="${ontsnap(klok(v.verstuurd_op))}">${
        ontsnap(geleden(v.verstuurd_op))}</span></a>`;
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
      ${terugblik() ? "" : nietMeldenVoor === k.id ? `
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
          <a class="knop" href="${k.concept ? `#/bericht/${k.concept}?van=werkbank` : "#"}" data-concept="${k.id}">${
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
          <div class="kolkop">Geposte berichten<span class="n">${
            data.verstuurd.length} deze cyclus</span></div>
          ${data.verstuurd.length
            ? `<div class="berichtenlijst">${data.verstuurd.map((v) => berichtregel(v)).join("")}</div>`
            : `<p class="wbleeg">Er is nog niets naar de leden gegaan.</p>`}
        </div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------- bediening
  let bezigMetKnop = false;

  async function opKlik(e) {
    // De pijlen onder de tegels van de afgelopen cycli. Eén tegel per klik: dat
    // leest als bladeren, een sprong van een halve strook leest als springen.
    const pijl = e.target.closest("[data-schuif]");
    if (pijl) {
      const strook = inhoud.querySelector(".cbstrook");
      if (strook) {
        strookX = Math.max(0, Math.min(
          strook.scrollWidth - strook.clientWidth,
          strook.scrollLeft + Number(pijl.dataset.schuif) * 196));
        strook.scrollTo({ left: strookX, behavior: "smooth" });
      }
      return;
    }

    const posKnop = e.target.closest("[data-pos]");
    if (posKnop) {
      const id = Number(posKnop.dataset.pos);
      open.has(id) ? open.delete(id) : open.add(id);
      return teken();
    }
    // In een terugblik verandert er niets meer: wat deze cyclus geweest is, is
    // geweest. Er valt dus ook niets te kiezen.
    if (terugblik()) return;

    const seg = e.target.closest("[data-stand]");
    if (seg && data.barometer.wakker) {
      const n = Number(seg.dataset.stand);
      const staat = data.barometer.wij ? Number(data.barometer.wij.stand.waarde) : null;
      // Klikken op de stand die al vastligt doet niets — maar dan hoor je wel
      // waarom, anders voelt de meter kapot.
      melding = n === staat && kiesStand !== n ? "Die stand ligt al vast." : null;
      kiesStand = kiesStand === n || n === staat ? null : n;
      return teken();
    }
    const vh = e.target.closest("[data-venster]");
    if (vh) {
      const w = vh.dataset.venster;
      // Dezelfde stand nog eens vastleggen is geen verandering — de werkbank
      // weigert hem, en 'In positie → In positie' is ook geen bericht waard.
      // Klikken op wat er al staat betekent dus: toch maar niet.
      const staat = data.barometer.wij ? data.barometer.wij.venster.waarde : data.venster.nu;
      melding = w === staat && kiesVenster !== w ? "Die stand ligt al vast." : null;
      kiesVenster = kiesVenster === w || w === staat ? null : w;
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
      // Twee keer klikken terwijl de eerste nog onderweg is, maakte twee
      // berichten: beide vragen kijken of er al een concept ligt voordat een
      // van de twee er een heeft gemaakt.
      if (bezigMetKnop) return;
      bezigMetKnop = true;
      concept.classList.add("bezig");
      try {
        const uit = await conceptUitKaart(Number(concept.dataset.concept));
        if (uit && uit.publicatie) { location.hash = `#/bericht/${uit.publicatie}?van=werkbank`; return; }
        melding = (uit && uit.fout) || "Dat lukte niet.";
      } finally { bezigMetKnop = false; }
      return teken();
    }
  }

  async function publiceer() {
    const vak = inhoud.querySelector("#pubreden");
    const reden = vak ? vak.value.trim() : "";
    if (!reden) return;
    // Zonder deze vangst gebeurde er bij een weigering niets: de fout kwam uit
    // de api omhoog, niemand ving hem op, en het scherm bleef staan alsof je
    // niet geklikt had.
    let uit;
    try {
      uit = await publiceerStand({
        cyclus: cyclusId, stand: kiesStand, venster: kiesVenster, reden,
      });
    } catch (fout) {
      melding = fout && fout.message ? fout.message : "Het publiceren lukte niet.";
      return teken();
    }
    if (uit && uit.fout) { melding = uit.fout; return teken(); }
    kiesStand = null; kiesVenster = null; melding = null;

    // Vastleggen is niet melden. Het concept staat klaar met jouw reden erin;
    // de leden weten het pas als dat bericht weg is, dus gaan we er meteen
    // naartoe in plaats van hier te blijven staan met een vinkje.
    if (uit && uit.publicatie) {
      location.hash = `/bericht/${uit.publicatie}?van=werkbank`;
      return;
    }
    if (uit && uit.bericht_fout) melding = `Vastgelegd, maar het bericht lukte niet: ${uit.bericht_fout}`;
    return haal();
  }

  // Het element waarin dit scherm tekent leeft langer dan dit scherm: ga je weg
  // en kom je terug, dan hangt de luisteraar van de vorige keer er nog aan. Eén
  // klik werd dan twee of drie handelingen — en dat leverde drie concepten op
  // voor één doorrol. De luisteraar van een oud bezoek doet dus niets meer.
  inhoud.addEventListener("click", (e) => { if (leeftNog()) opKlik(e); });

  // De knop gaat aan zodra er een reden staat. Niet opnieuw tekenen bij elke
  // toetsaanslag: dan springt de cursor uit het vak en ben je je tekst kwijt.
  inhoud.addEventListener("input", (e) => {
    if (!leeftNog()) return;
    const vak = e.target.closest("#pubreden, #nietreden");
    if (!vak) return;
    const knop = inhoud.querySelector(vak.id === "pubreden" ? "[data-publiceer]" : "[data-nietmeldendoor]");
    if (knop) knop.disabled = !vak.value.trim();
  });

  // De eerste tekening: de strip van de vorige keer blijft staan, daaronder
  // 'Bezig…'. Kom je vers binnen, dan is er nog geen strip.
  //
  // Dit staat hier onderaan en niet bovenin: cyclusbalk() leunt op constanten
  // die verderop in deze functie staan, en een const bestaat pas als de regel
  // gedraaid is. Bovenin wierp hij 'Cannot access MAANDEN before
  // initialization', en dan bleef het scherm staan waar het stond.
  inhoud.innerHTML = data && data.cyclus
    ? `<div class="werkbank">${cyclusbalk()}<p class="wbleeg">Bezig…</p></div>`
    : `<div class="werkbank">Bezig…</div>`;
  naStrook();

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

