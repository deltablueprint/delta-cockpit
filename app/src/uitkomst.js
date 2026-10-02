// Het gesprek: één scherm waarop alles staat wat op dat moment bekend is.
//
// Bovenaan de looptijd: links de events van de cyclus om door te scrollen,
// rechts diezelfde events op een tijdas met daar vlak onder, op dezelfde as,
// wat ieder zou schrijven — een balk die eindigt op de expiratie die hij
// voorstelt. Daaronder de portefeuille als één balk, dan de uitkomst, en
// onderaan de gerelateerde lijsten waar het materiaal zelf staat. Het systeem
// rekent hier niets uit en adviseert niets: het legt naast elkaar wat er is,
// zodat drie mensen naar hetzelfde beeld kijken (BOUWSPEC 5.4).

import { besluitOverzicht, besluitUitkomst } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";
import { avatar } from "./avatar.js";
import { kiezerHtml, kiezerAansluiten } from "./kiezer.js";
import { lijstscherm } from "./lijst.js";

const KLEUR = {
  groen: ["#1B6B3A", "#E3F2E7"], rood: ["#A1281F", "#FBE6E3"],
  oranje: ["#8A5A00", "#FBEFD8"], blauw: ["#136289", "#E1EFF6"], grijs: ["#595349", "#EDEAE3"],
};
const badge = (tekst, kleur = "grijs") => {
  const [fg, bg] = KLEUR[kleur] || KLEUR.grijs;
  return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(tekst)}</span>`;
};

const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MAAND = ["JAN", "FEB", "MRT", "APR", "MEI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];
const dag = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`) : null);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const kortDatum = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  return m ? `${Number(m[3])} ${MND[Number(m[2]) - 1]}` : "";
};
const getal = (n, cijfers = 0) =>
  Number(n).toLocaleString("nl-BE", { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });
const euro = (n) => `€ ${Number(n).toLocaleString("nl-BE", { maximumFractionDigits: 0 })}`;

// De contractnaam zoals hij bij de broker staat: OESX 30OKT26 5800 PUT. Zelfde
// regel als worker/positie.js, zodat scherm en record hetzelfde schrijven.
function contractnaam(expiratiedatum, strike) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(expiratiedatum ?? ""));
  const n = Number(strike);
  if (!m || !Number.isFinite(n)) return "OESX ? PUT";
  return `OESX ${m[3]}${MAAND[Number(m[2]) - 1]}${m[1].slice(2)} ${
    Number.isInteger(n) ? n : n.toFixed(1)} PUT`;
}

export async function uitkomstscherm(inhoud, kruimel, momentId, meta) {
  inhoud.innerHTML = `<div class="kaart leeg">Bezig met ophalen&hellip;</div>`;

  let data;
  try {
    data = await besluitOverzicht(momentId);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  const { moment, cyclus, portefeuille } = data;
  kruimel.innerHTML = `<a href="#/t/cyclus">Cycli</a> <span class="pijlje">&rsaquo;</span>
    <a href="#/t/cyclus/${cyclus.id}">${ontsnap(cyclus.label)}</a> <span class="pijlje">&rsaquo;</span>
    <a href="#/t/beoordelingsmoment/${moment.id}">${ontsnap(moment.datum)}</a>
    <span class="pijlje">&rsaquo;</span> <span>Uitkomst vastleggen</span>`;
  document.title = `Uitkomst vastleggen · ${cyclus.label}`;

  const vastgelegd = moment.status === "uitkomst vastgelegd";
  const vandaag = iso(Date.now());

  const wie = (id) => data.deelnemers.find((d) => d.id === id) || null;
  const kortVan = (id) => { const g = wie(id); return g ? (g.korte_naam || g.naam) : id; };

  // ================================================================== de as
  const begin = Math.min(
    dag(cyclus.geopend_op) || Infinity,
    ...data.events.map((e) => dag(e.datum) || Infinity),
    dag(vandaag)
  );
  const eind = Math.max(
    dag(cyclus.doelexpiratie) || 0,
    ...data.events.map((e) => dag(e.datum) || 0),
    ...data.inzendingen.map((i) => dag(i.expiratiedatum) || 0),
    begin + 86400000
  );
  const plek = (d) => {
    const t = dag(d);
    if (!t) return null;
    return Math.max(0, Math.min(100, ((t - begin) / (eind - begin)) * 100));
  };
  const rand = (p) => (p < 6 ? " randlinks" : p > 94 ? " randrechts" : "");

  // De datumlinialen: elke vrijdag en elke laatste dag van de maand krijgt een
  // datum — dat zijn de dagen waarop week- en maandopties aflopen. Liggen twee
  // labels te dicht op elkaar, dan wint het maandeinde.
  const liniaal = (() => {
    const kandidaat = new Map();
    const zet = (d, pri) => { if ((kandidaat.get(d) || 0) < pri) kandidaat.set(d, pri); };
    const loop = new Date(begin);
    while (loop.getTime() <= eind) {
      const d = iso(loop.getTime());
      const morgen = new Date(loop.getTime());
      morgen.setUTCDate(morgen.getUTCDate() + 1);
      if (morgen.getUTCMonth() !== loop.getUTCMonth()) zet(d, 3);
      else if (loop.getUTCDay() === 5) zet(d, 2);
      loop.setUTCDate(loop.getUTCDate() + 1);
    }
    zet(iso(begin), 1);
    zet(iso(eind), 1);
    const alle = [...kandidaat.entries()]
      .map(([d, pri]) => ({ d, pri, p: plek(d) }))
      .sort((a, b) => a.p - b.p);
    const uit = [];
    for (const k of alle) {
      const botst = uit.find((g) => Math.abs(g.p - k.p) < 4.5);
      if (!botst) uit.push(k);
      else if (k.pri > botst.pri) uit[uit.indexOf(botst)] = k;
    }
    // Waar 'vandaag' staat, hoeft geen tweede datum te staan.
    const nu = plek(vandaag) ?? -99;
    return uit.filter((k) => Math.abs(k.p - nu) > 4.5).sort((a, b) => a.p - b.p);
  })();

  // Events op dezelfde dag worden één punt: anders staan er drie bolletjes over
  // elkaar en is er niets meer aan te wijzen. De hoverkaart draagt ze alle drie.
  const perDag = new Map();
  for (const e of data.events) {
    if (plek(e.datum) === null) continue;
    if (!perDag.has(e.datum)) perDag.set(e.datum, []);
    perDag.get(e.datum).push(e);
  }
  const rang = { zwaar: 3, middel: 2, licht: 1 };
  const zwaarste = (lijst) =>
    lijst.reduce((z, e) => ((rang[e.zwaarte] || 0) > (rang[z] || 0) ? e.zwaarte : z), "licht");

  const kaartregels = (lijst) => lijst.map((e) => `
    <span class="tijdkaartitem">
      <b>${ontsnap(e.naam)}</b>
      <span class="tijdkaartregel">${badge(e.zwaarte || "niet gewogen",
        e.zwaarte === "zwaar" ? "rood" : e.zwaarte === "middel" ? "oranje" : "grijs")}
        <span class="faint">${ontsnap(e.soort || "")}${
          e.tijdstip ? ` · ${ontsnap(e.tijdstip)}${e.tijdzone ? ` ${ontsnap(e.tijdzone)}` : ""}` : ""}</span></span>
      <span class="tijdkaartregel">Behandeling: ${ontsnap(e.behandeling || "nog te wegen")}</span>
      ${e.motivering ? `<span class="tijdkaartnoot">${ontsnap(e.motivering)}</span>` : ""}
    </span>`).join("");

  const puntenHtml = [...perDag.entries()].map(([datum, lijst]) => {
    const p = plek(datum);
    return `<span class="tijdpunt ${zwaarste(lijst)}${lijst.length > 1 ? " meer" : ""}"
      style="left:${p}%" data-datum="${ontsnap(datum)}" tabindex="0">
      ${lijst.length > 1 ? `<i class="tijdaantal">${lijst.length}</i>` : ""}
      <span class="tijdkaart${rand(p)}">
        <span class="tijdkaartkop">${ontsnap(toonDatum(datum))}${
          lijst.length > 1 ? ` · ${lijst.length} events` : ""}</span>
        ${kaartregels(lijst)}
      </span></span>`;
  }).join("");

  // Wat ieder zou schrijven, op diezelfde as en er vlak onder: de balk loopt
  // van vandaag tot de voorgestelde expiratie en eindigt precies op die datum.
  const vandaagP = plek(vandaag) ?? 0;
  const schrijfrij = (i) => {
    const g = wie(i.deelnemer);
    const kleur = (g && g.kleur) || "#136289";
    const tot = plek(i.expiratiedatum);
    const naam = `<div class="tijdnaam">${g ? avatar(g, 20) : ""}<span>${ontsnap(kortVan(i.deelnemer))}</span></div>`;
    if (i.positie === "no-go" || tot === null) {
      return `<div class="tijdrij">${naam}
        <div class="tijdspoor"><span class="geenbalk">${
          ontsnap(i.positie === "no-go" ? "no-go — zou nu niets schrijven" : "geen expiratie opgegeven")}</span></div></div>`;
    }
    const links = Math.min(vandaagP, tot);
    const breed = Math.max(tot - links, 1.5);
    return `<div class="tijdrij">${naam}
      <div class="tijdspoor">
        <span class="schrijfbalk" style="left:${links}%;width:${breed}%;--k:${ontsnap(kleur)}"
          title="${ontsnap(`${contractnaam(i.expiratiedatum, i.strike)} · ${
            i.inzet_pct === null || i.inzet_pct === undefined ? "inzet onbekend" : `${getal(i.inzet_pct, 1)} % inzet`}`)}">
          <b>${ontsnap(contractnaam(i.expiratiedatum, i.strike))}</b>
        </span>
      </div></div>`;
  };

  const goTellen = data.inzendingen.filter((i) => i.positie === "go").length;
  const nogoTellen = data.inzendingen.filter((i) => i.positie === "no-go").length;

  const eventlijstHtml = `
    <div class="eventlijstkop">Events van deze cyclus<span>${data.events.length}</span></div>
    <ul class="eventlijst">
      ${[...perDag.entries()].map(([datum, lijst]) => lijst.map((e) => `
        <li data-datum="${ontsnap(datum)}">
          <span class="evdatum">${ontsnap(kortDatum(datum))}</span>
          <span class="evbol ${zwaarste([e])}"></span>
          <span class="evnaam" title="${ontsnap(e.naam)}">${ontsnap(e.naam)}</span>
          <span class="evbeh">${ontsnap(e.behandeling || "nog te wegen")}</span>
        </li>`).join("")).join("")}
    </ul>`;

  const tijdlijnHtml = `
    <div class="paneel">
      <div class="paneelkop">Events in de looptijd
        <span class="paneelmeta">${data.events.length} events · ${goTellen} go · ${nogoTellen} no-go ·
          van ${toonDatum(cyclus.geopend_op)} tot ${
            cyclus.doelexpiratie ? toonDatum(cyclus.doelexpiratie) : "onbepaald"}</span></div>
      <div class="looptijd">
        <div class="eventkolom">${eventlijstHtml}</div>
        <div class="tijdblok">
          <div class="tijdrij asrij">
            <div class="tijdnaam"><span class="faint">Looptijd</span></div>
            <div class="tijdspoor">
              ${liniaal.map((k) => `<span class="tijdijk${k.pri === 3 ? " maand" : ""}${rand(k.p)}"
                style="left:${k.p}%">${ontsnap(kortDatum(k.d))}<i></i></span>`).join("")}
              <div class="tijdas"></div>
              <span class="vandaag${rand(vandaagP)}" style="left:${vandaagP}%"></span>
              ${puntenHtml}
            </div>
          </div>
          ${data.inzendingen.map(schrijfrij).join("")}
        </div>
      </div>
    </div>`;

  // ---------------------------------------------------------- portefeuille
  // Eén balk van honderd procent: wat er als marge vastligt en wat er vrij is.
  // Het kapitaal komt van de broker als het rapport de nettowaarde draagt.
  const p = portefeuille;
  const marge = Number(p.blootstelling || 0);
  const kapitaal = Number(p.kapitaal || 0);
  const margePct = kapitaal ? Math.min(100, (marge / kapitaal) * 100) : 0;

  const portefeuilleHtml = !kapitaal ? "" : `
    <div class="paneel">
      <div class="paneelkop">Portefeuille
        <span class="paneelmeta">kapitaal ${euro(kapitaal)} ${
          p.kapitaal_bron === "lynx"
            ? `· live uit Lynx${p.kapitaal_opgehaald_op ? ` (${ontsnap(p.kapitaal_opgehaald_op)})` : ""}`
            : "· uit de portefeuille-instelling; Lynx levert de nettowaarde nog niet"
        } · multiplier ${euro(p.multiplier)} per punt</span></div>
      <div class="kapitaalvak">
        <div class="kapitaalbalk">
          <span class="kdeel marge" style="width:${margePct}%"></span>
          <span class="kdeel vrij"></span>
          ${p.max_inzet_pct ? `<span class="kplafond" style="left:${Math.min(100, Number(p.max_inzet_pct))}%">
            <i></i><span>plafond ${getal(p.max_inzet_pct, 0)} %</span></span>` : ""}
        </div>
        <div class="kapitaallegenda">
          <span class="klegend"><i class="vlak marge"></i>
            <b>${euro(marge)}</b> marge <span class="faint">${getal(margePct, 1)} % · ${
              p.open_tranches.length} open ${p.open_tranches.length === 1 ? "tranche" : "tranches"}</span></span>
          <span class="klegend"><i class="vlak vrij"></i>
            <b>${euro(Math.max(kapitaal - marge, 0))}</b> beschikbaar
            <span class="faint">${getal(Math.max(100 - margePct, 0), 1)} % van het kapitaal</span></span>
        </div>
        ${p.open_tranches.length ? `<p class="paneelnoot">Open: ${p.open_tranches.map((t) =>
          `${ontsnap(t.cyclusnaam)} — ${ontsnap(contractnaam(t.expiratiedatum, t.strike))} × ${t.aantal}`
        ).join(" · ")}</p>` : ""}
      </div>
    </div>`;

  // --------------------------------------------------------------- uitkomst
  const gekozenAanwezig = data.aanwezigen.length
    ? data.aanwezigen.map(String)
    : data.inzendingen.map((i) => String(i.deelnemer));
  const rij = (g) => ({ id: g.id, html: `<span class="persoon">${avatar(g, 20)}<span>${ontsnap(g.naam)}</span></span>` });

  const uitkomstHtml = vastgelegd ? `
    <div class="paneel">
      <div class="paneelkop">Uitkomst van het gesprek<span class="paneelmeta">vastgelegd op ${
        ontsnap(moment.vastgelegd_op || "")}</span></div>
      <div class="uitkomstvast">
        ${badge(moment.uitkomst || "—", moment.uitkomst === "go" ? "groen" : "rood")}
        ${moment.uitkomst === "go"
          ? `<span><b>${ontsnap(contractnaam(moment.expiratiedatum, moment.strike))}</b> · inzet ${
              getal(moment.inzet_pct, 1)} %</span>` : ""}
        ${moment.aanwezigen ? `<span class="faint">aanwezig: ${ontsnap(moment.aanwezigen)}</span>` : ""}
        ${moment.wat_veranderde ? `<p>${ontsnap(moment.wat_veranderde)}</p>` : ""}
      </div>
    </div>` : `
    <div class="paneel">
      <div class="paneelkop">Uitkomst van het gesprek<span class="paneelmeta">één uitkomst voor de groep — alle velden verplicht</span></div>
      <div class="formsectie">
        <div class="formkolommen">
          <div class="formkolom">
            <label class="veldlabel" for="u_uitkomst"><span class="ster">*</span> Uitkomst</label>
            <div class="veldwaarde"><select id="u_uitkomst">
              <option value="">&mdash;</option><option value="go">Go</option><option value="no-go">No-go</option>
            </select></div>
            <label class="veldlabel" for="u_expiratie" data-alleen="go" hidden><span class="ster">*</span> Expiratiedatum</label>
            <div class="veldwaarde" data-alleen="go" hidden><input id="u_expiratie" type="date"></div>
            <label class="veldlabel" for="u_strike" data-alleen="go" hidden><span class="ster">*</span> Strike</label>
            <div class="veldwaarde" data-alleen="go" hidden><input id="u_strike" type="number" step="25"></div>
            <label class="veldlabel" for="u_inzet" data-alleen="go" hidden><span class="ster">*</span> Inzet in % van het kapitaal</label>
            <div class="veldwaarde" data-alleen="go" hidden>
              <span class="metteken"><input id="u_inzet" type="number" step="0.1"><span class="teken">%</span></span></div>
            <label class="veldlabel" for="u_volgend" data-alleen="no-go" hidden><span class="ster">*</span> Volgend analysemoment</label>
            <div class="veldwaarde" data-alleen="no-go" hidden><input id="u_volgend" type="date"></div>
            <label class="veldlabel" data-alleen="go" hidden>Contract</label>
            <div class="veldwaarde" data-alleen="go" hidden><span class="alleenlezen" id="u_contract">&mdash;</span></div>
          </div>
          <div class="formkolom">
            <label class="veldlabel"><span class="ster">*</span> Aanwezigen</label>
            <div class="veldwaarde kiezervak">
              ${kiezerHtml({
                id: "u_aanwezigen",
                linkskop: "Niet bij het gesprek",
                rechtskop: "Was erbij",
                links: data.deelnemers.filter((g) => !gekozenAanwezig.includes(String(g.id))).map(rij),
                rechts: data.deelnemers.filter((g) => gekozenAanwezig.includes(String(g.id))).map(rij),
              })}
            </div>
          </div>
        </div>
        <div class="formbreed">
          <label class="veldlabel" for="u_veranderde"><span class="ster">*</span> Wat het gesprek veranderde</label>
          <div class="veldwaarde"><textarea id="u_veranderde" placeholder="Wat is er gezegd dat iemands oordeel heeft verschoven? Niets is ook een antwoord."></textarea></div>
        </div>
        <div class="knoprij">
          <button class="knop" id="vastleggen">Uitkomst vastleggen</button>
          <span class="paneelmeta">Bij een go ontstaat het positierecord vanzelf, met dit besluit eronder.</span>
        </div>
      </div>
    </div>`;

  // ------------------------------------------------------ gerelateerde lijsten
  const relaties = [
    { sleutel: "instap", label: "Instapvoorwaarden", tabel: "voorwaarde",
      idfilters: { cyclus: String(cyclus.id) }, filters: { soort: "instap" },
      uitleg: "alleen lezen — bijwerken gebeurt op de cyclus" },
    { sleutel: "uitstap", label: "Uitstapvoorwaarden", tabel: "voorwaarde",
      idfilters: { cyclus: String(cyclus.id) }, filters: { soort: "uitstap" },
      uitleg: "alleen lezen — bijwerken gebeurt op de cyclus" },
    { sleutel: "chart", label: "Technische analyse", tabel: null },
    { sleutel: "inzending", label: "Inzendingen", tabel: "inzending",
      idfilters: { beoordelingsmoment: String(moment.id) }, filters: {},
      uitleg: "blind ingestuurd, nu open" },
  ];

  const relatieHtml = `
    <div class="relatieblok"><div class="tabbalk">
      ${relaties.map((r, n) => `<a href="#" data-sleutel="${r.sleutel}" class="tab ${n === 0 ? "actief" : ""}">${
        ontsnap(r.label)}</a>`).join("")}
    </div><div id="relatievak" class="relatieinhoud"></div></div>`;

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(cyclus.label)} — gesprek van ${toonDatum(moment.datum)}</span>
      <span class="recordmelding" id="umelding"></span>
    </div>
    ${tijdlijnHtml}
    ${portefeuilleHtml}
    ${uitkomstHtml}
    ${relatieHtml}`;

  // ---------------------------------------------------------------- gedrag
  // Een regel in de eventlijst en het punt op de as wijzen naar hetzelfde: wie
  // de een aanwijst, ziet de ander oplichten.
  const aanwijzen = (datum, aan) => {
    inhoud.querySelectorAll(`[data-datum="${CSS.escape(datum)}"]`)
      .forEach((el) => el.classList.toggle("wijs", aan));
  };
  inhoud.querySelectorAll(".eventlijst li, .tijdpunt").forEach((el) => {
    el.addEventListener("mouseenter", () => aanwijzen(el.dataset.datum, true));
    el.addEventListener("mouseleave", () => aanwijzen(el.dataset.datum, false));
  });

  const kiezer = inhoud.querySelector("#u_aanwezigen");
  let aanwezigen = () => gekozenAanwezig;
  if (kiezer) aanwezigen = kiezerAansluiten(kiezer) || aanwezigen;

  const contractvak = inhoud.querySelector("#u_contract");
  const keuze = inhoud.querySelector("#u_uitkomst");
  const hertel = () => {
    if (!contractvak) return;
    const e = inhoud.querySelector("#u_expiratie");
    const s = inhoud.querySelector("#u_strike");
    contractvak.textContent = e && e.value && s && s.value ? contractnaam(e.value, s.value) : "—";
  };
  if (keuze) {
    const toon = () => inhoud.querySelectorAll("[data-alleen]").forEach((el) => {
      el.hidden = el.dataset.alleen !== keuze.value;
    });
    keuze.addEventListener("change", toon);
    ["#u_expiratie", "#u_strike"].forEach((id) => {
      const el = inhoud.querySelector(id);
      if (el) el.addEventListener("input", hertel);
    });
    toon();
    hertel();
  }

  const melding = inhoud.querySelector("#umelding");
  const knop = inhoud.querySelector("#vastleggen");
  if (knop) {
    knop.addEventListener("click", async () => {
      const lees = (id) => {
        const el = inhoud.querySelector(id);
        return el && el.value !== "" ? el.value : null;
      };
      const erbij = (typeof aanwezigen === "function" ? aanwezigen() : gekozenAanwezig) || [];
      const body = {
        uitkomst: lees("#u_uitkomst"),
        strike: lees("#u_strike"),
        expiratiedatum: lees("#u_expiratie"),
        inzet_pct: lees("#u_inzet"),
        aanwezigen: erbij.map((id) => kortVan(id)).join(", "),
        volgend_moment: lees("#u_volgend"),
        wat_veranderde: lees("#u_veranderde"),
      };

      // Alles invullen, en wel hier: een halve uitkomst is geen uitkomst.
      const mist =
        !body.uitkomst ? "Leg vast of het een go of een no-go werd."
        : body.uitkomst === "go" && !body.expiratiedatum ? "Bij een go hoort een expiratiedatum."
        : body.uitkomst === "go" && !body.strike ? "Bij een go hoort een strike."
        : body.uitkomst === "go" && !body.inzet_pct ? "Bij een go hoort de inzet in % van het kapitaal."
        : body.uitkomst === "no-go" && !body.volgend_moment ? "Elke no-go eindigt met een nieuw analysemoment."
        : !erbij.length ? "Zet rechts wie er bij het gesprek waren."
        : !body.wat_veranderde ? "Schrijf op wat het gesprek veranderde; ook 'niets' is een antwoord."
        : null;
      if (mist) {
        melding.textContent = mist;
        melding.className = "recordmelding fouttekst";
        return;
      }

      knop.disabled = true;
      melding.textContent = "Bezig met vastleggen…";
      melding.className = "recordmelding";
      try {
        await besluitUitkomst(momentId, body);
        location.hash = `/t/beoordelingsmoment/${momentId}`;
      } catch (fout) {
        knop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "recordmelding fouttekst";
      }
    });
  }

  // De lijsten onderaan zijn de echte lijsten van de applicatie: zelfde
  // kolommen, zelfde zoekvensters, alleen niets dat hier gewijzigd mag worden.
  function toonRelatie(r) {
    const vak = inhoud.querySelector("#relatievak");
    if (!vak) return;
    if (!r.tabel) {
      vak.innerHTML = `<div class="lijst"><div class="rlkop"><span class="rltitel">Technische analyse</span>
        <span class="rluitleg">chartlezing met niveaus</span></div>
        <p class="paneelleeg">De chartanalyse is nog niet gebouwd (etappe 11b). Tot dan hoort de lezing van de
          charts in de motivering van de inzendingen.</p></div>`;
      return;
    }
    lijstscherm(vak, { textContent: "" }, r.tabel, meta, {
      q: "", sorteer: null, richting: "asc", offset: 0,
      filters: { ...r.filters }, idfilters: { ...r.idfilters },
      ingebed: { ouder: { tabel: "beoordelingsmoment", id: moment.id },
                 kolom: Object.keys(r.idfilters)[0], label: r.label,
                 toonTelling: true, magNieuw: false, inPlaatsVan: r.uitleg },
    });
  }
  toonRelatie(relaties[0]);
  inhoud.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const r = relaties.find((x) => x.sleutel === tab.dataset.sleutel);
      if (!r) return;
      inhoud.querySelectorAll(".tab").forEach((t) => t.classList.toggle("actief", t === tab));
      toonRelatie(r);
    });
  });
}
