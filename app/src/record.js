// ============================================================================
// Het recordscherm — één vorm voor élk record in de applicatie.
//
//   · een balk met de naam van het record, een bijlageknop en de acties
//   · daaronder, als de tabel een procesveld heeft, een chevronbalk:
//     lichtblauw is gedaan, donkerblauw is waar je nu staat, grijs komt nog
//   · dan het formulier: twee kolommen labels en velden, geen kaarten
//   · onderaan de gerelateerde lijsten
// ============================================================================

import { record as haalRecord, bewaar, maakAan, nieuwSjabloon, lynxPosities } from "./api.js";
import { lijstscherm } from "./lijst.js";
import { lees, invoer, ontsnap, toonDatum } from "./veld.js";

// Het merkteken van Delta Blueprint, voor de koppelanimatie.
const LOGO = `<svg viewBox="0 0 296.1 251.9" width="15" height="13" aria-hidden="true">
  <polygon points="226.6 133.8 108.7 67.1 148.1 0 226.6 133.8" fill="currentColor"/>
  <polygon points="296.1 251.9 139.2 251.9 256.9 185.1 296.1 251.9" fill="currentColor"/>
  <polygon points="76.9 251.9 0 251.9 76.7 121.6 76.9 251.9" fill="currentColor"/></svg>`;
import { volgLive, stopLive, HARTSLAG } from "./live.js";
import { avatar, avatarMetNaam } from "./avatar.js";
import { kiezerHtml, kiezerAansluiten } from "./kiezer.js";
import { voorwaardeSjablonen, voorwaardenOvernemen, stappenVan } from "./api.js";

const ICOON = {
  bijlage: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 6"/></svg>`,
  vink: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`,
};

// De klikluisteraar van het overnemen hangt aan het werkvlak, niet aan het
// scherm: tekenen we opnieuw, dan moet de vorige eraf. Anders reageren er twee
// op dezelfde klik en krijg je het paneel twee keer.
let overnemenLuisteraar = null;

export async function recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties = {}) {
  let data;
  try {
    data = id === "nieuw"
      ? await nieuwSjabloon(tabelnaam, opties.ouder)
      : await haalRecord(tabelnaam, id);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  const isNieuw = data.nieuw === true;
  // Is het titelveld een verwijzing, dan heet het record naar waar het heen
  // wijst — 'Maandexpiratie OESX', niet '66'.
  const titelVeld = data.tabel.titel_veld;
  const titel = isNieuw
    ? `Nieuwe ${data.tabel.label.toLowerCase()}`
    : String(
        (data.verwijzingen && data.verwijzingen[titelVeld])
        ?? (meta.gebruikers && meta.gebruikers[data.waarden[titelVeld]]
             ? meta.gebruikers[data.waarden[titelVeld]].naam : null)
        ?? data.waarden[titelVeld]
        ?? `${data.tabel.label} ${id}`
      );

  document.title = `${titel} · Delta Blueprint Cockpit`;

  // ---- breadcrumb: de hele ouderketen, zoals het bouwplan voorschrijft ----
  const kruimels = [];
  if (data.ouder) {
    kruimels.push(`<a href="#/t/${data.ouder.tabel}">${ontsnap(data.ouder.label_mv)}</a>`);
    kruimels.push(`<a href="#/t/${data.ouder.tabel}/${data.ouder.id}">${ontsnap(data.ouder.titel)}</a>`);
  }
  // Kom je via een cyclus bij een voorwaarde, dan hoort 'Voorwaarden' in de
  // breadcrumb de voorwaarden van díé cyclus te tonen — niet die van alle
  // cycli. De kruimel draagt het ouderfilter dus mee.
  // Kom je van een ouderrecord, dan is deze kruimel de gerelateerde lijst waar
  // je net uit kwam. Die is geen bestemming op zichzelf — je staat er al — dus
  // hij is wel te lezen en niet aan te klikken. Het hele bestand opvragen doe
  // je via het menu.
  kruimels.push(data.ouder
    ? `<span>${ontsnap(data.tabel.label_mv)}</span>`
    : `<a href="#/t/${tabelnaam}">${ontsnap(data.tabel.label_mv)}</a>`);
  kruimels.push(`<span>${ontsnap(titel)}</span>`);
  kruimel.innerHTML = kruimels.join(` <span class="pijlje">&rsaquo;</span> `);

  // Op een nieuw record staat de stand nog niet in de waarden; die komt dan
  // uit de procesbalk, die hem al kent.
  const standNu = data.proces
    ? (data.waarden[data.proces.veld] ?? data.proces.nu)
    : null;

  // ---- procesbalk: de fasen, met onder elke fase haar eigen stappen ----
  // Zo zie je in één blik wat er in een eerdere fase gebeurd is en wat er
  // straks nog komt, in plaats van alleen de fase waar je nu in staat. De fase
  // waarin het record staat draagt de kleur; de rest staat gedoofd. Niets om
  // aan te vinken: elke stap vinkt zichzelf af zodra het gedaan is.
  const stapHtml = (st) => `
    <li class="stap ${st.gedaan ? "gedaan" : "open"}${st.verplicht ? "" : " mag-later"}">
      <span class="stapvink">${st.gedaan ? ICOON.vink : ""}</span>
      <span class="stapnaam">${ontsnap(st.naam)}${
        st.stand ? ` <i class="stapstand">${ontsnap(st.stand)}</i>` : ""}</span>
    </li>`;

  const fasekolommen = () => {
    const fasen = (data.proces && data.proces.stappen) || [];
    const nu = fasen.findIndex((f) => f.waarde === standNu);
    return fasen.map((f, i) => {
      const bij = (data.stappen || []).filter((st) => st.fase === f.waarde);
      const stand = i < nu ? "gedaan" : i === nu ? "nu" : "straks";
      return `<div class="fasekolom ${stand}">${
        bij.length ? `<ul class="stappenlijst">${bij.map(stapHtml).join("")}</ul>` : ""
      }</div>`;
    }).join("");
  };

  let procesHtml = "";
  if (data.proces && data.proces.stappen.length) {
    const fasen = data.proces.stappen;
    const nu = fasen.findIndex((f) => f.waarde === standNu);
    const heeftStappen = (data.stappen || []).length > 0;
    procesHtml = `<div class="proces">
      <div class="chevrons">${fasen.map((f, i) => {
        const stand = i < nu ? "gedaan" : i === nu ? "nu" : "straks";
        return `<span class="chevron ${stand}">${ontsnap(f.label)}${i < nu ? ICOON.vink : ""}</span>`;
      }).join("")}</div>
      ${heeftStappen && !isNieuw ? `<div class="fasestappen">${fasekolommen()}</div>` : ""}
    </div>`;
  }

  // ---- wie er bij dit besluit was ----
  // Twee kolommen: links wie er niet bij is, rechts wie meebeslist. Het aantal
  // rechts is het quorum — wie meedoet moet inzenden, wie er niet is telt niet
  // mee. Daarmee is het quorum per besluit anders en altijd uitlegbaar.
  const toonAanwezigen = tabelnaam === "beoordelingsmoment" && !isNieuw;
  const erbij = String(data.waarden.aanwezigen_ids || "").split(",").map((w) => w.trim()).filter(Boolean);
  const iedereen = Object.values(meta.gebruikers || {});
  const quorumtekst = (n) => n === 0 ? "nog niemand gekozen"
    : n === 1 ? "één persoon — dit besluit draagt een vlag en vraagt een toelichting"
    : `${n} aanwezigen, dus ${n} inzendingen nodig`;

  const aanwezigenHtml = !toonAanwezigen ? "" : `
    <div class="aanwezigen">
      <div class="stappenkop">Aanwezig bij dit besluit<span class="stappenmeta" id="quorumtekst">${
        ontsnap(quorumtekst(erbij.length))}</span></div>
      ${kiezerHtml({
        id: "aanwezigenkiezer",
        linkskop: "Niet aanwezig",
        rechtskop: "Aanwezig",
        links: iedereen.filter((g) => !erbij.includes(g.id)).map((g) => ({ id: g.id, html: avatarMetNaam(g) })),
        rechts: iedereen.filter((g) => erbij.includes(g.id)).map((g) => ({ id: g.id, html: avatarMetNaam(g) })),
      })}
      <div class="veldwaarde verborgen">
        <input type="hidden" data-kolom="aanwezigen_ids" id="aanwezigen_ids" value="${ontsnap(erbij.join(","))}">
      </div>
    </div>`;

  // ---- formulier: twee kolommen, velden om en om verdeeld ----
  const velden = data.velden.filter(
    (v) => v.toon_op_formulier !== 0 && (v.sectie !== "systeem" || !isNieuw)
  );
  // Een sectie kan zeggen dat ze bij het aanmaken nog niets te melden heeft
  // (db_sectie.verbergen_bij_nieuw). En een sectie waarvan alles alleen-lezen
  // én leeg is, vertelt niets: die laten we weg in plaats van een rij
  // streepjes te tonen.
  const alleSecties = data.secties.length ? data.secties : [{ naam: "algemeen", label: data.tabel.label }];
  const secties = alleSecties.filter((sectie) => {
    if (isNieuw && sectie.verbergen_bij_nieuw) return false;
    // Een sectie kan bij bepaalde standen horen (db_sectie.standen). Leeg
    // staan wachten op iets wat nog niet gebeurd is, is geen informatie.
    if (sectie.standen) {
      const bij = String(sectie.standen).split(",").map((w) => w.trim());
      if (isNieuw || !bij.includes(String(standNu))) return false;
    }
    const eigen = velden.filter((v) => (v.sectie || "algemeen") === sectie.naam);
    if (!eigen.length) return false;
    const allesLeegEnVast = eigen.every(
      (v) => v.alleen_lezen && (data.waarden[v.kolom] === null || data.waarden[v.kolom] === undefined || data.waarden[v.kolom] === "")
    );
    return !allesLeegEnVast;
  });

  const veldHtml = (v) => `
    <label class="veldlabel" data-veld="${v.kolom}" for="veld-${v.kolom}">${
      v.verplicht ? '<span class="ster">*</span> ' : ""}${ontsnap(v.label)}</label>
    <div class="veldwaarde" data-veld="${v.kolom}"${v.live ? ` data-live="${tabelnaam}.${id}.${v.kolom}"` : ""}>${
      v.alleen_lezen
        ? `<span class="alleenlezen livewaarde" data-toon="${v.kolom}">${
            lees(v, data.waarden[v.kolom], meta, data.verwijzingen, data.waarden, "formulier")}</span>`
        : invoer(v, data.waarden[v.kolom], meta, "",
                 data.verwijzingen ? data.verwijzingen[v.kolom] : null,
                 data.opties ? data.opties[v.kolom] : null)
    }${v.live ? `<span class="hartje-vak" title="loopt live mee">${HARTSLAG}</span>` : ""}</div>`;

  const sectieHtml = secties.map((sectie) => {
    const eigen = velden.filter((v) => (v.sectie || "algemeen") === sectie.naam);
    if (!eigen.length) return "";
    const breed = eigen.filter((v) => v.type === "lang");
    let smal = eigen.filter((v) => v.type !== "lang");

    // Waar een veld staat, zegt de definitielaag: db_field.kolom_rechts. Dat
    // geldt voor de hele tabel en niet per sectie — anders viel een sectie
    // waarin niemand naar rechts wil terug op 'om en om', en stond er alsnog
    // iets rechts dat links hoorde.
    // Een tabel met formulier_kolommen = 1 zet alles onder elkaar, ook als geen
    // enkel veld rechts wil staan: anders viel zo'n formulier terug op 'om en
    // om' zodra je het laatste rechtse veld naar links haalde.
    const kiestZelf = velden.some((v) => v.kolom_rechts) ||
      Number(data.tabel.formulier_kolommen) === 1;
    let links;
    let rechts;
    if (kiestZelf) {
      links = smal.filter((v) => !v.kolom_rechts);
      rechts = smal.filter((v) => v.kolom_rechts);
    } else {
      // De status staat dan op elk formulier op dezelfde plek: tweede links.
      const procesVeld = data.tabel.proces_veld;
      const plek = smal.findIndex((v) => v.kolom === procesVeld);
      if (procesVeld && plek > -1) {
        const [veld] = smal.splice(plek, 1);
        smal.splice(Math.min(2, smal.length), 0, veld);
      }
      links = smal.filter((_, i) => i % 2 === 0);
      rechts = smal.filter((_, i) => i % 2 === 1);
    }

    return `
      <div class="formsectie${sectie.accent ? " nadruk" : ""}" data-sectie="${ontsnap(sectie.naam)}">
        ${alleSecties.length > 1 ? `<div class="formsectiekop">${ontsnap(sectie.label)}</div>` : ""}
        <div class="formkolommen">
          <div class="formkolom">${links.map(veldHtml).join("")}</div>
          <div class="formkolom">${rechts.map(veldHtml).join("")}</div>
        </div>
        ${breed.length ? `<div class="formbreed">${breed.map(veldHtml).join("")}</div>` : ""}
      </div>`;
  }).join("");

  // ---- gerelateerde lijsten ----
  const relaties = data.relaties || [];
  const tabbladen = data.tabel.related_weergave !== "onder_elkaar";
  const actiefTab = opties.tab && relaties.some((r) => r.tabel === opties.tab)
    ? opties.tab
    : relaties.length ? relaties[0].tabel : null;

  // De pagina staat meteen op de hoogte van de grootste lijst. Anders groeit ze
  // als je van een kort tabblad naar een lang wisselt, en moet je scrollen naar
  // wat er net nog paste. Vijftig is wat één pagina van een lijst toont.
  const meesteRegels = Math.min(50, Math.max(0, ...relaties.map((r) => r.aantal || 0)));
  const vakhoogte = relaties.length ? Math.max(meesteRegels * 33 + 150, 220) : 0;

  const relatieHtml = !relaties.length ? "" : tabbladen
    ? `<div class="relatieblok"><div class="tabbalk">
         ${relaties.map((r) => `
           <a href="#/t/${tabelnaam}/${id}?tab=${r.tabel}" data-tabel="${r.tabel}" class="tab ${r.tabel === actiefTab ? "actief" : ""}">
             ${ontsnap(r.label)}<span class="tabtelling">${r.aantal}</span></a>`).join("")}
       </div>
       <div id="relatievak" class="relatieinhoud" style="min-height:${vakhoogte}px"></div></div>`
    : `<div class="relatieblok">${relaties.map((r) => `<div id="relatie-${r.tabel}" class="relatieinhoud los"></div>`).join("")}</div>`;

  // Op een tranche die nog niet uitgevoerd is, hoort het kader met wat er bij
  // de broker open staat: daar kies je de positie in plaats van haar over te
  // typen.
  const toonBroker = tabelnaam === "positie" &&
    ["besluit goedgekeurd", "order bij lynx"].includes(String(standNu || ""));

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(titel)}</span>
      <span class="recordmelding" id="opslagmelding"></span>
      <span class="recordacties">
        <button class="knop tweede" id="bijlage" title="Bijlage toevoegen">${ICOON.bijlage}<span>Bijlage</span></button>
        ${data.actie && !isNieuw
          ? `<a class="knop" href="#${data.actie.route}" title="${ontsnap(data.actie.stap || "")}">${ontsnap(data.actie.label)}</a>`
          : ""}
        <button class="knop${data.actie && !isNieuw ? " tweede" : ""}" id="opslaan">${
          isNieuw ? ontsnap(data.tabel.aanmaakknop || "Aanmaken") : "Opslaan"}</button>
      </span>
    </div>
    ${procesHtml}
    ${aanwezigenHtml}
    <div class="formulier">${sectieHtml}</div>
    ${toonBroker ? `<div class="brokervak" id="brokervak">
      <div class="brokerkop">Open posities bij Lynx<span class="feitmeta">lezend — het systeem plaatst nooit zelf een order</span></div>
      <div class="brokerinhoud" id="brokerinhoud">Bezig met ophalen&hellip;</div>
    </div>` : ""}
    ${relatieHtml}`;

  // De stappen lezen de stand van het proces. Verandert er iets in een
  // gerelateerde lijst — een event behandeld, een voorwaarde ingevuld — dan
  // klopt die stand niet meer. Hem opnieuw ophalen is één vraag; het hele
  // scherm hertekenen zou je uit je werk halen.
  const stappenHertekenen = async () => {
    if (isNieuw) return;
    try {
      const verse = await stappenVan(tabelnaam, id);
      data.stappen = verse.stappen;
      const vak = inhoud.querySelector(".fasestappen");
      if (vak) vak.innerHTML = fasekolommen();
      // Is de fase opgeschoven, dan klopt de balk erboven ook niet meer.
      if (verse.stand && verse.stand !== standNu) {
        recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties);
      }
    } catch { /* de checklist bijwerken mag nooit het scherm breken */ }
  };

  // ---- gerelateerde lijsten vullen ----
  function toonRelatie(r) {
    const vak = inhoud.querySelector("#relatievak");
    if (!vak) return;
    lijstscherm(vak, { textContent: "" }, r.tabel, meta, {
      q: "", sorteer: null, richting: "asc", offset: 0,
      filters: {},
      idfilters: { [r.kolom]: String(id) },
      ingebed: { ouder: { tabel: tabelnaam, id }, kolom: r.kolom, label: r.label,
                 magNieuw: r.magNieuw !== false,
                 overnemen: r.overnemen, direct: r.direct, naWijziging: stappenHertekenen },
    });
  }

  if (tabbladen) {
    const begin = relaties.find((r) => r.tabel === actiefTab);
    if (begin) toonRelatie(begin);
    // Een ander tabblad kiezen wisselt alleen de inhoud van het vak. Het hele
    // record opnieuw opbouwen liet het scherm een paar keer knipperen.
    inhoud.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const r = relaties.find((x) => x.tabel === tab.dataset.tabel);
        if (!r) return;
        inhoud.querySelectorAll(".tab").forEach((t) => t.classList.toggle("actief", t === tab));
        history.replaceState(null, "", `#/t/${tabelnaam}/${id}?tab=${r.tabel}`);
        toonRelatie(r);
      });
    });
  } else {
    for (const r of relaties) {
      const vak = inhoud.querySelector(`#relatie-${r.tabel}`);
      if (!vak) continue;
      lijstscherm(vak, { textContent: "" }, r.tabel, meta, {
        q: "", sorteer: null, richting: "asc", offset: 0,
        filters: {},
        idfilters: { [r.kolom]: String(id) },
        ingebed: { ouder: { tabel: tabelnaam, id }, kolom: r.kolom, label: r.label,
                 magNieuw: r.magNieuw !== false,
                 overnemen: r.overnemen, direct: r.direct, naWijziging: stappenHertekenen },
      });
    }
  }

  // Bedragen schrijven we zoals ze hier gelezen worden: komma, twee cijfers.
  const euro = (n) => Number(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const punten = (n) => Number(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

  // ---- voorwaarden overnemen uit een eerdere cyclus ----
  // De vraag is vaak dezelfde; alleen het antwoord verschilt per cyclus. Die
  // vragen opnieuw intypen levert niets op en zorgt voor kleine verschillen in
  // naamgeving, waardoor je ze later niet meer naast elkaar kunt leggen.
  if (overnemenLuisteraar) {
    overnemenLuisteraar.el.removeEventListener("click", overnemenLuisteraar.fn);
    overnemenLuisteraar = null;
  }
  const overnemenKlik = async (e) => {
    const knop = e.target.closest("#rlovernemen");
    if (!knop) return;
    const vak = knop.closest(".lijst");
    if (!vak || vak.querySelector(".overnemen")) return;

    knop.disabled = true;
    let lijst = [];
    try {
      ({ voorwaarden: lijst } = await voorwaardeSjablonen(id));
    } catch (fout) {
      knop.disabled = false;
      alert(fout.message);
      return;
    }
    knop.disabled = false;

    const paneel = document.createElement("div");
    paneel.className = "overnemen";
    paneel.innerHTML = !lijst.length
      ? `<p class="brokerleeg">Er zijn geen voorwaarden uit eerdere cycli die hier nog niet staan.
         <button class="knop klein tweede" data-sluit>Sluiten</button></p>`
      : `<div class="stappenkop">Overnemen uit een eerdere cyclus<span class="stappenmeta">
           de vraag gaat mee, de gemeten waarde niet</span></div>
         ${kiezerHtml({
           id: "voorwaardekiezer",
           linkskop: "Eerder gebruikt",
           rechtskop: "Overnemen naar deze cyclus",
           links: lijst.map((v) => ({
             id: v.sleutel,
             html: `<span class="koppelnaam">${ontsnap(v.naam)}</span>
                    <span class="faint">${ontsnap(v.soort)}${v.bron ? ` · ${ontsnap(v.bron)}` : ""}</span>
                    <span class="stapstand">${v.keer}×</span>`,
           })),
           rechts: [],
         })}
         <div class="knoprij" style="padding:0 16px 14px">
           <button class="knop" data-overnemen disabled>Overnemen</button>
           <button class="knop tweede" data-sluit>Annuleren</button>
         </div>`;

    vak.insertBefore(paneel, vak.querySelector(".tabelomhulsel"));

    paneel.querySelectorAll("[data-sluit]").forEach((b) => b.addEventListener("click", () => paneel.remove()));

    const kiezer = paneel.querySelector("#voorwaardekiezer");
    if (!kiezer) return;
    const nemen = paneel.querySelector("[data-overnemen]");
    const gekozen = kiezerAansluiten(kiezer, (ids) => { nemen.disabled = ids.length === 0; });

    nemen.addEventListener("click", async () => {
      nemen.disabled = true;
      try {
        await voorwaardenOvernemen(id, gekozen());
        paneel.remove();
        // Blijf staan waar je was: je hebt net voorwaarden overgenomen, dus je
        // wilt ze zien — niet het eerste tabblad.
        recordscherm(inhoud, kruimel, tabelnaam, id, meta, { ...opties, tab: "voorwaarde" });
      } catch (fout) {
        nemen.disabled = false;
        alert(fout.message);
      }
    });
  };
  inhoud.addEventListener("click", overnemenKlik);
  overnemenLuisteraar = { el: inhoud, fn: overnemenKlik };

  // ---- velden die de keuze volgen ----
  // Bij een go vraag je om de positie, bij een no-go om de reden. Allebei
  // tonen betekent dat de helft van het formulier altijd niet van toepassing
  // is — en dan vult iemand vroeg of laat het verkeerde in. Welke voorwaarde
  // erbij hoort staat in de definitielaag (db_field.toon_als).
  const voorwaardelijk = data.velden.filter((v) => v.toon_als);
  if (voorwaardelijk.length) {
    const huidigeWaarde = (kolom) => {
      const el = inhoud.querySelector(`.veldwaarde [data-kolom="${kolom}"]`);
      if (el) return el.value;
      const w = data.waarden[kolom];
      return w === null || w === undefined ? "" : String(w);
    };

    const voldoet = (uitdrukking) => {
      const m = /^\s*(\S+)\s*(=|!=)\s*(.+?)\s*$/.exec(String(uitdrukking));
      if (!m) return true;
      const [, kolom, op, verwacht] = m;
      const nu = String(huidigeWaarde(kolom));
      return op === "=" ? nu === verwacht : nu !== verwacht;
    };

    const bijwerken = () => {
      for (const veld of voorwaardelijk) {
        const zichtbaar = voldoet(veld.toon_als);
        inhoud.querySelectorAll(`[data-veld="${veld.kolom}"]`).forEach((el) => { el.hidden = !zichtbaar; });
      }
      // Een sectie waarvan alles verborgen is, hoeft er ook niet te staan.
      inhoud.querySelectorAll(".formsectie").forEach((sectie) => {
        const velden = [...sectie.querySelectorAll(".veldwaarde")];
        sectie.hidden = velden.length > 0 && velden.every((el) => el.hidden);
      });
    };

    const sturend = [...new Set(voorwaardelijk.map((v) => /^\s*(\S+)/.exec(v.toon_als)[1]))];
    for (const kolom of sturend) {
      const el = inhoud.querySelector(`.veldwaarde [data-kolom="${kolom}"]`);
      if (el) el.addEventListener("change", bijwerken);
    }
    bijwerken();
  }

  // ---- de aanwezigenkiezer ----
  if (toonAanwezigen) {
    const vak = inhoud.querySelector("#aanwezigenkiezer");
    const veld = inhoud.querySelector("#aanwezigen_ids");
    const tekst = inhoud.querySelector("#quorumtekst");
    if (vak && veld) {
      kiezerAansluiten(vak, (ids) => {
        veld.value = ids.join(",");
        if (tekst) tekst.textContent = quorumtekst(ids.length);
      });
    }
  }

  // ---- wat er bij de broker open staat ----
  // Het kader hoort onder het besluit: eerst waarom, dan wat er in de markt
  // staat, dan pas de tranche. Zolang er niets gekozen is, staat het formulier
  // van de tranche er niet — een leeg formulier naast een lijst waaruit je
  // kunt kiezen, nodigt uit tot overtypen.
  if (toonBroker) {
    const brokervak = inhoud.querySelector("#brokervak");
    const besluitsectie = inhoud.querySelector('.formsectie[data-sectie="besluit"]');
    if (brokervak && besluitsectie) besluitsectie.after(brokervak);

    const verborgen = isNieuw
      ? [...inhoud.querySelectorAll(".formsectie")].filter((el) => el.dataset.sectie !== "besluit")
      : [];
    verborgen.forEach((el) => { el.hidden = true; });

    const toonTranche = () => {
      verborgen.forEach((el) => { el.hidden = false; });
      const handmatig = inhoud.querySelector("#handmatig");
      if (handmatig) handmatig.hidden = true;
    };

    const vak = inhoud.querySelector("#brokerinhoud");

    // De knoppen onder het kader: nog eens proberen, of het zelf doen.
    const knoppenAansluiten = () => {
      const opnieuw = vak.querySelector("#opnieuw");
      if (opnieuw) opnieuw.addEventListener("click", () => { ophalen(true); });
      const handmatig = vak.querySelector("#handmatig");
      if (handmatig) handmatig.addEventListener("click", toonTranche);
    };

    const ophalen = (nogEens = false) => {
      if (vak) vak.innerHTML = `
        <div class="koppelloader">
          <span class="koppelzijde bron"><img src="/lynx.png" alt="Lynx" width="30" height="30"></span>
          <span class="koppelpad" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="koppelzijde doel">${LOGO}</span>
          <span class="koppeltekst">Gegevens ophalen bij Lynx${
            nogEens ? " — het rapport wordt op aanvraag gemaakt, dat duurt soms een halve minuut" : ""}</span>
        </div>`;
      lynxPosities().then((uit) => {
      if (!vak) return;
      const handmatigKnop = `<p class="brokerleeg">
        <button class="knop klein tweede" id="opnieuw">Opnieuw ophalen</button>
        ${verborgen.length ? `<button class="knop klein tweede" id="handmatig">De tranche met de hand invullen</button>` : ""}
      </p>`;
      if (!uit.koppeling) {
        vak.innerHTML = `<p class="brokerleeg">${ontsnap(uit.reden || "Geen koppeling met Lynx.")}</p>${handmatigKnop}`;
        knoppenAansluiten();
        return;
      }
      if (!uit.posities.length) {
        vak.innerHTML = `<p class="brokerleeg">Er staat niets open bij Lynx${
          uit.opgehaald_op ? ` (rapport van ${ontsnap(uit.opgehaald_op)})` : ""}.</p>${handmatigKnop}`;
        knoppenAansluiten();
        return;
      }
      // Welke open positie hoort bij dit besluit? Gelijke strike én gelijke
      // expiratie: dan is het dezelfde afspraak. Die wordt voorgesteld en
      // meteen overgenomen; de rest blijft zichtbaar maar grijs, want ze
      // hoort niet bij dit besluit — zichtbaar houden is eerlijker dan
      // wegfilteren, want soms is het besluit nét anders uitgevoerd.
      const leesVeld = (kolom) => {
        const el = inhoud.querySelector(`.veldwaarde [data-kolom="${kolom}"]`);
        if (el) return el.value;
        const toon = inhoud.querySelector(`.veldwaarde [data-toon="${kolom}"]`);
        return toon ? toon.textContent.trim() : "";
      };
      const besluitStrike = Number(data.waarden.besluit_strike ?? leesVeld("besluit_strike"));
      const besluitExpiratie = String(data.waarden.besluit_expiratiedatum || "");
      const past = (p) =>
        Number(p.strike) === besluitStrike && String(p.expiratiedatum || "") === besluitExpiratie;
      const treffers = uit.posities.filter(past);

      vak.innerHTML = `<table class="feittabel"><thead><tr>
          <th>Contract</th><th>Strike</th><th>Expiratie</th><th>Aantal</th>
          <th>Premie per contract</th><th>Uitgevoerd</th><th></th>
        </tr></thead><tbody>${uit.posities.map((p, i) => `
          <tr class="${past(p) ? "past" : "anders"}"><td class="feitnaam">${ontsnap(p.contract)}${
            past(p) ? ` <span class="badge" style="color:#1B6B3A;background:#E3F2E7">past bij het besluit</span>` : ""}</td><td>${ontsnap(p.strike ?? "—")}</td>
            <td>${p.expiratiedatum ? toonDatum(p.expiratiedatum) : "—"}</td>
            <td>${ontsnap(p.aantal ?? "—")}${p.richting === "gekocht" ? ' <span class="faint">gekocht</span>' : ""}</td>
            <td>${p.premie_eur === null || p.premie_eur === undefined ? "—"
                 : `€ ${euro(p.premie_eur)}${p.premie_pt ? ` <span class="faint">· ${punten(p.premie_pt)} pt</span>` : ""}${
                     p.premie_bron === "positie" ? ` <span class="faint" title="Komt van de positie zelf: dat is de kostprijs ná commissie, iets lager dan de prijs waartegen geschreven is.">na kosten</span>` : ""}`}</td>
            <td>${ontsnap(p.uitvoering_op || p.rapportdatum || "—")}</td>
            <td><button class="knop klein" data-kies="${i}">Deze nemen</button></td></tr>`).join("")}
        </tbody></table>`;
      if (treffers.length === 1) {
        vak.insertAdjacentHTML("afterbegin",
          `<p class="brokerleeg">Eén open positie past bij dit besluit — strike ${ontsnap(besluitStrike)},
           expiratie ${besluitExpiratie ? toonDatum(besluitExpiratie) : "—"}. Die is hieronder overgenomen;
           kies een andere regel als het anders gelopen is.</p>`);
      } else if (besluitStrike && !treffers.length) {
        vak.insertAdjacentHTML("afterbegin",
          `<p class="brokerleeg">Geen open positie met strike ${ontsnap(besluitStrike)} en expiratie
           ${besluitExpiratie ? toonDatum(besluitExpiratie) : "—"}. Kies de regel die het geworden is, of vul met de hand in.</p>`);
      }

      if (uit.opgehaald_op) {
        vak.insertAdjacentHTML("beforeend",
          `<p class="brokerleeg feitmeta">Rapport van ${ontsnap(uit.opgehaald_op)}.</p>`);
      }
      vak.insertAdjacentHTML("beforeend", handmatigKnop);
      knoppenAansluiten();

      const neemOver = (p) => {
        const zet = (kolom, waarde) => {
          const el = inhoud.querySelector(`.veldwaarde [data-kolom="${kolom}"]`);
          if (el && waarde !== null && waarde !== undefined) el.value = waarde;
        };
        zet("strike", p.strike);
        zet("expiratiedatum", p.expiratiedatum);
        zet("aantal", p.aantal);
        zet("ontvangen_premie_eur", p.premie_eur);
        zet("uitvoering_op", p.uitvoering_op);
        zet("herkomst", "broker");
        toonTranche();
      };

      vak.querySelectorAll("[data-kies]").forEach((knop) => {
        knop.addEventListener("click", () => neemOver(uit.posities[Number(knop.dataset.kies)]));
      });

      // Past er precies één, dan is er niets te kiezen: dan is het die.
      if (treffers.length === 1) neemOver(treffers[0]);
      }).catch(() => {
        if (vak) vak.innerHTML = `<p class="brokerleeg">De koppeling met Lynx is niet bereikbaar.</p>`;
      });
    };

    ophalen();
  }

  // ---- een andere keuze, andere gegevens ----
  // Kies je een ander besluit onder deze tranche, dan hoort het formulier
  // meteen te laten zien wat dát besluit zei. Bij het opslaan doet de worker
  // hetzelfde nog eens: het scherm vooruitlopen is prettig, maar het is niet
  // de plek waar de waarheid vandaan komt.
  for (const [kolom, lijst] of Object.entries(data.opties || {})) {
    const kiezer = inhoud.querySelector(`.veldwaarde [data-kolom="${kolom}"]`);
    if (!kiezer || !Array.isArray(lijst)) continue;
    kiezer.addEventListener("change", () => {
      const gekozen = lijst.find((k) => String(k.id) === String(kiezer.value));
      if (!gekozen) return;
      // Is er al uitgevoerd, dan blijft wat er in de markt gebeurd is staan;
      // alleen 'wat het besluit zei' wordt dan bijgewerkt.
      const standveld = inhoud.querySelector('.veldwaarde [data-kolom="status"]');
      const nogNiets = isNieuw || !standveld || standveld.value === "besluit goedgekeurd";
      for (const [veld, waarde] of Object.entries(gekozen.overnemen || {})) {
        if (!nogNiets && !veld.startsWith("besluit_")) continue;
        const el = inhoud.querySelector(`.veldwaarde [data-kolom="${veld}"]`);
        if (el) el.value = waarde ?? "";
        const toon = inhoud.querySelector(`.veldwaarde [data-toon="${veld}"]`);
        if (toon) toon.textContent = waarde === null || waarde === undefined || waarde === "" ? "—" : waarde;
      }
    });
  }

  // ---- opslaan ----
  const melding = inhoud.querySelector("#opslagmelding");
  const knop = inhoud.querySelector("#opslaan");

  inhoud.querySelector("#bijlage").addEventListener("click", () => {
    melding.textContent = "Bijlagen komen bij de chartanalyses (etappe 11).";
    melding.className = "recordmelding";
    setTimeout(() => { melding.textContent = ""; }, 3000);
  });

  function verzamel() {
    const v = {};
    inhoud.querySelectorAll(".veldwaarde [data-kolom]").forEach((el) => {
      v[el.dataset.kolom] = el.value === "" ? null : el.value;
    });
    return v;
  }

  knop.addEventListener("click", async () => {
    knop.disabled = true;
    melding.textContent = "Bezig met opslaan…";
    melding.className = "recordmelding";
    try {
      if (isNieuw) {
        const velden = verzamel();
        if (data.ouderkolom) velden[data.ouderkolom] = data.waarden[data.ouderkolom];
        const gemaakt = await maakAan(tabelnaam, velden, data.ouderkolom);
        // Waar je na het aanmaken heen gaat, hangt af van wat je deed: een
        // inzending verstuur je en dan ga je terug naar het besluit, want daar
        // gaat het verder.
        location.hash = data.tabel.na_aanmaken === "ouder" && data.ouder
          ? `/t/${data.ouder.tabel}/${data.ouder.id}`
          : `/t/${tabelnaam}/${gemaakt.id}`;
      } else {
        const uitkomst = await bewaar(tabelnaam, id, verzamel(), data.waarden.revisie);
        data.waarden.revisie = uitkomst.revisie ?? data.waarden.revisie;
        melding.textContent = uitkomst.ongewijzigd ? "Niets gewijzigd" : "Opgeslagen";
        if (uitkomst.waarschuwingen && uitkomst.waarschuwingen.length) {
          melding.textContent = `Opgeslagen — ${uitkomst.waarschuwingen[0].melding}`;
          melding.className = "recordmelding waarschuwing";
        }
        // Verandert het procesveld, dan klopt de chevronbalk niet meer.
        if (data.proces && verzamel()[data.proces.veld] !== data.proces.nu) {
          recordscherm(inhoud, kruimel, tabelnaam, id, meta, opties);
          return;
        }
        setTimeout(() => { melding.textContent = ""; melding.className = "recordmelding"; }, 4000);
      }
    } catch (fout) {
      melding.textContent = fout.message;
      melding.className = "recordmelding fouttekst";
    } finally {
      knop.disabled = false;
    }
  });

  // Live velden: alleen waarden die als live gemarkeerd staan worden ververst,
  // en alleen díé plekken op het scherm. In fase 1 staat er niets live, dus
  // loopt er geen timer en beweegt er niets. Vanaf etappe 11 meldt dit scherm
  // zich hier aan met een functie die de live waarden ophaalt.
  stopLive();
}
