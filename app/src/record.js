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

const ICOON = {
  bijlage: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 6"/></svg>`,
  vink: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`,
};

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
  kruimels.push(data.ouder && data.ouder.kolom
    ? `<a href="#/t/${tabelnaam}?fid.${data.ouder.kolom}=${data.ouder.id}">${ontsnap(data.tabel.label_mv)}</a>`
    : `<a href="#/t/${tabelnaam}">${ontsnap(data.tabel.label_mv)}</a>`);
  kruimels.push(`<span>${ontsnap(titel)}</span>`);
  kruimel.innerHTML = kruimels.join(` <span class="pijlje">&rsaquo;</span> `);

  // ---- procesbalk ----
  let procesHtml = "";
  if (data.proces && data.proces.stappen.length) {
    const nu = data.proces.stappen.findIndex((s) => s.waarde === data.proces.nu);
    procesHtml = `<div class="chevrons">${data.proces.stappen.map((s, i) => {
      const stand = i < nu ? "gedaan" : i === nu ? "nu" : "straks";
      return `<span class="chevron ${stand}">${ontsnap(s.label)}${i < nu ? ICOON.vink : ""}</span>`;
    }).join("")}</div>`;
  }

  // ---- formulier: twee kolommen, velden om en om verdeeld ----
  const velden = data.velden.filter(
    (v) => v.toon_op_formulier !== 0 && (v.sectie !== "systeem" || !isNieuw)
  );
  // Een sectie kan zeggen dat ze bij het aanmaken nog niets te melden heeft
  // (db_sectie.verbergen_bij_nieuw). En een sectie waarvan alles alleen-lezen
  // én leeg is, vertelt niets: die laten we weg in plaats van een rij
  // streepjes te tonen.
  const alleSecties = data.secties.length ? data.secties : [{ naam: "algemeen", label: data.tabel.label }];
  // Op een nieuw record staat de stand nog niet in de waarden; die komt dan
  // uit de procesbalk, die hem al kent.
  const standNu = data.proces
    ? (data.waarden[data.proces.veld] ?? data.proces.nu)
    : null;
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
    <label class="veldlabel" for="veld-${v.kolom}">${v.verplicht ? '<span class="ster">*</span> ' : ""}${ontsnap(v.label)}</label>
    <div class="veldwaarde"${v.live ? ` data-live="${tabelnaam}.${id}.${v.kolom}"` : ""}>${
      v.alleen_lezen
        ? `<span class="alleenlezen livewaarde" data-toon="${v.kolom}">${lees(v, data.waarden[v.kolom], meta, data.verwijzingen, data.waarden)}</span>`
        : invoer(v, data.waarden[v.kolom], meta, "",
                 data.verwijzingen ? data.verwijzingen[v.kolom] : null,
                 data.opties ? data.opties[v.kolom] : null)
    }${v.live ? `<span class="hartje-vak" title="loopt live mee">${HARTSLAG}</span>` : ""}</div>`;

  const sectieHtml = secties.map((sectie) => {
    const eigen = velden.filter((v) => (v.sectie || "algemeen") === sectie.naam);
    if (!eigen.length) return "";
    const breed = eigen.filter((v) => v.type === "lang");
    let smal = eigen.filter((v) => v.type !== "lang");

    // Waar een veld staat, zegt de definitielaag: db_field.kolom_rechts. Zegt
    // geen enkel veld van deze tabel er iets over, dan blijft het om en om —
    // zo veranderen formulieren die niets ingesteld hebben niet.
    const kiestZelf = smal.some((v) => v.kolom_rechts);
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
        ${secties.length > 1 ? `<div class="formsectiekop">${ontsnap(sectie.label)}</div>` : ""}
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

  const relatieHtml = !relaties.length ? "" : tabbladen
    ? `<div class="relatieblok"><div class="tabbalk">
         ${relaties.map((r) => `
           <a href="#/t/${tabelnaam}/${id}?tab=${r.tabel}" data-tabel="${r.tabel}" class="tab ${r.tabel === actiefTab ? "actief" : ""}">
             ${ontsnap(r.label)}<span class="tabtelling">${r.aantal}</span></a>`).join("")}
       </div>
       <div id="relatievak" class="relatieinhoud"></div></div>`
    : `<div class="relatieblok">${relaties.map((r) => `<div id="relatie-${r.tabel}" class="relatieinhoud los"></div>`).join("")}</div>`;

  // Op een tranche die nog niet uitgevoerd is, hoort het kader met wat er bij
  // de broker open staat: daar kies je de positie in plaats van haar over te
  // typen.
  const toonBroker = tabelnaam === "positie" &&
    ["besluit goedgekeurd", "order bij lynx"].includes(String(standNu || ""));

  const terugNaar = data.ouder
    ? { href: `#/t/${data.ouder.tabel}/${data.ouder.id}`, label: `Terug naar ${data.ouder.titel}` }
    : { href: `#/t/${tabelnaam}`, label: "Terug naar de lijst" };

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(titel)}</span>
      <span class="recordmelding" id="opslagmelding"></span>
      <span class="recordacties">
        <button class="knop tweede" id="bijlage" title="Bijlage toevoegen">${ICOON.bijlage}<span>Bijlage</span></button>
        <a class="knop tweede" href="${terugNaar.href}">${ontsnap(terugNaar.label)}</a>
        ${data.actie && !isNieuw
          ? `<a class="knop" href="#${data.actie.route}" title="${ontsnap(data.actie.stap || "")}">${ontsnap(data.actie.label)}</a>`
          : ""}
        <button class="knop${data.actie && !isNieuw ? " tweede" : ""}" id="opslaan">${isNieuw ? "Aanmaken" : "Opslaan"}</button>
      </span>
    </div>
    ${procesHtml}
    <div class="formulier">${sectieHtml}</div>
    ${toonBroker ? `<div class="brokervak" id="brokervak">
      <div class="brokerkop">Open posities bij Lynx<span class="feitmeta">lezend — het systeem plaatst nooit zelf een order</span></div>
      <div class="brokerinhoud" id="brokerinhoud">Bezig met ophalen&hellip;</div>
    </div>` : ""}
    ${relatieHtml}`;

  // ---- gerelateerde lijsten vullen ----
  function toonRelatie(r) {
    const vak = inhoud.querySelector("#relatievak");
    if (!vak) return;
    lijstscherm(vak, { textContent: "" }, r.tabel, meta, {
      q: "", sorteer: null, richting: "asc", offset: 0,
      filters: {},
      idfilters: { [r.kolom]: String(id) },
      ingebed: { ouder: { tabel: tabelnaam, id }, kolom: r.kolom, label: r.label,
                 toonTelling: !tabbladen, magNieuw: r.magNieuw !== false },
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
                 toonTelling: !tabbladen, magNieuw: r.magNieuw !== false },
      });
    }
  }

  // Bedragen schrijven we zoals ze hier gelezen worden: komma, twee cijfers.
  const euro = (n) => Number(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const punten = (n) => Number(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

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
          <span class="koppelzijde bron">Lynx</span>
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
        vak.innerHTML = `<p class="brokerleeg">Er staat niets open bij Lynx.</p>${handmatigKnop}`;
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
        location.hash = `/t/${tabelnaam}/${gemaakt.id}`;
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
