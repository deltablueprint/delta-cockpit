// Het gesprek: één scherm waarop alles staat wat op dat moment bekend is.
//
// Vijf blokken onder elkaar, en alles is meteen zichtbaar — geen tabbladen waar
// je iets achter wegklikt:
//
//   1. de looptijd over de volle breedte: de events op een tijdas, en daar vlak
//      onder wat ieder zou schrijven, als balk tot de expiratie die hij voorstelt
//   2. links de events van de cyclus, rechts de instapvoorwaarden — beide de
//      echte lijsten van de applicatie, met dezelfde kolommen
//   3. de technische analyse: per chart een schermafdruk met wat je erin leest
//   4. de uitkomst van het gesprek
//   5. de portefeuille
//
// Het systeem rekent hier niets uit en adviseert niets: het legt naast elkaar
// wat er is, zodat drie mensen naar hetzelfde beeld kijken (BOUWSPEC 5.4).

import { besluitOverzicht, besluitUitkomst, besluitChart } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";
import { avatar } from "./avatar.js";
import { verkleinChart, uitKlembord, toonGroot } from "./afbeelding.js";
import { kiezerHtml, kiezerAansluiten } from "./kiezer.js";
import { lijstscherm } from "./lijst.js";
import { tijdas, plaatsTijdkaarten } from "./tijdas.js";

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
  // De as zelf staat in tijdas.js: Dispatch tekent dezelfde. Hier komt eronder
  // wat ieder zou schrijven, en dát is het verhaal van dit scherm.
  const as = tijdas({
    van: cyclus.geopend_op, tot: cyclus.doelexpiratie,
    events: data.events, nu: vandaag,
    extra: data.inzendingen.map((i) => i.expiratiedatum),
  });
  const plek = as.plek;

  // Wat ieder zou schrijven, op diezelfde as en er vlak onder: de balk loopt
  // van vandaag tot de voorgestelde expiratie en eindigt precies op die datum.
  const vandaagP = as.vandaagP;
  const schrijfrij = (i) => {
    const g = wie(i.deelnemer);
    const kleur = (g && g.kleur) || "#136289";
    const tot = plek(i.expiratiedatum);
    // De inzet hoort bij het voorstel: zonder dat getal zegt de balk wel wélk
    // contract iemand wil schrijven, maar niet voor hoeveel.
    const inzet = i.inzet_pct === null || i.inzet_pct === undefined || i.inzet_pct === ""
      ? "" : `<b class="tijdinzet" title="van het kapitaal">${getal(i.inzet_pct, 1)} %</b>`;
    const naam = `<div class="tijdnaam">${g ? avatar(g, 20) : ""}<span class="tijdwie">${
      ontsnap(kortVan(i.deelnemer))}</span>${inzet}</div>`;
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

  const tijdlijnHtml = `
    <div class="paneel">
      <div class="paneelkop">Looptijd
        <span class="paneelmeta">${data.events.length} events &middot; ${goTellen} go &middot; ${nogoTellen} no-go &middot;
          van ${toonDatum(cyclus.geopend_op)} tot ${
            cyclus.doelexpiratie ? toonDatum(cyclus.doelexpiratie) : "onbepaald"}</span></div>
      <div class="tijdblok breed">
        ${as.asHtml}
        ${data.inzendingen.map(schrijfrij).join("")}
      </div>
    </div>`;

  // ---- 2 · links de events, rechts de instapvoorwaarden -----------------
  // Allebei de echte lijst van de applicatie: zelfde kolommen, zelfde
  // zoekvensters. Alleen niets dat hier gewijzigd mag worden.
  const splitHtml = `
    <div class="gesprekssplit">
      <div class="relatieinhoud los" id="vak_events"></div>
      <div class="relatieinhoud los" id="vak_voorwaarden"></div>
    </div>`;

  // ---- 3 · de technische analyse ----------------------------------------
  // Eén regel per chart: een schermafdruk en wat je erin leest. De eerste regel
  // ligt vast, zodat elk gesprek met dezelfde blik begint; daaronder voeg je
  // zelf toe wat je verder wilt laten zien.
  const chartregelHtml = (r) => `
    <div class="chartregel" data-id="${ontsnap(String(r.id ?? ""))}" data-vast="${r.vast ? 1 : 0}">
      <div class="chartkop">
        <input class="chartnaam invulbaar" value="${ontsnap(r.onderwerp || "")}"
               placeholder="Waar kijk je naar?"${vastgelegd ? " disabled" : ""}>
      </div>
      <div class="chartbeeld${r.afbeelding ? " gevuld" : ""}" tabindex="0">
        ${r.afbeelding
          ? `<img src="${ontsnap(r.afbeelding)}" alt="${ontsnap(r.onderwerp || "chart")}">
             ${vastgelegd ? "" : `<button class="chartvervang" type="button">Vervangen</button>`}`
          : `<span class="chartleeg">Plak hier een schermafdruk, of <b>kies een bestand</b></span>`}
        ${vastgelegd ? "" : `<input type="file" class="chartbestand" accept="image/*" hidden>`}
      </div>
      <textarea class="chartcommentaar" placeholder="Wat lees je in deze chart?"${
        vastgelegd ? " disabled" : ""}>${ontsnap(r.commentaar || "")}</textarea>
    </div>`;

  const chartHtml = `
    <div class="paneel" id="chartpaneel">
      <div class="paneelkop">Technische analyse
        <span class="paneelmeta" id="chartmelding">een schermafdruk per chart, met wat je erin leest</span></div>
      <div class="chartrijen" id="chartrijen">
        ${(data.chartlezingen || []).map(chartregelHtml).join("")}
      </div>
      ${vastgelegd ? "" : `<div class="chartvoet">
        <button class="knop tweede" id="chartbij" type="button">Chart toevoegen</button>
      </div>`}
    </div>`;

  // ---------------------------------------------------------- portefeuille
  // Eén balk van honderd procent: wat er als marge vastligt en wat er vrij is.
  // Het kapitaal komt van de broker als het rapport de nettowaarde draagt.
  const p = portefeuille;
  const marge = Number(p.blootstelling || 0);
  const kapitaal = Number(p.kapitaal || 0);
  const margePct = kapitaal ? Math.min(100, (marge / kapitaal) * 100) : 0;

  // Twee balken naast elkaar, met wit ertussen. Links het beschikbare kapitaal
  // dat het plafond toelaat — lichtgroen wat vrij is, donkergroen wat er al
  // uitstaat. Rechts de marge die er altijd moet blijven. De scheiding tussen
  // de twee ís het plafond; daar hoeft geen streepje bij.
  const plafondPct = p.max_inzet_pct ? Math.min(100, Number(p.max_inzet_pct)) : 100;
  const margePlafondPct = Math.max(100 - plafondPct, 0);
  // Binnen de linkerbalk rekenen we in procenten van die balk, niet van het
  // kapitaal: anders klopt de vulling niet.
  const binnen = (pct) => (plafondPct ? Math.min(100, (pct / plafondPct) * 100) : 0);

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
          <div class="kbalk beschikbaar" style="flex-basis:${plafondPct}%">
            <span class="kdeel ingezet" style="width:${binnen(margePct)}%"></span>
            <span class="kdeel voorstel" id="kvoorstel" style="width:0"></span>
          </div>
          ${margePlafondPct ? `<div class="kbalk marge" style="flex-basis:${margePlafondPct}%"></div>` : ""}
        </div>
        <div class="kapitaalonder">
          <span class="konderschrift" style="flex-basis:${plafondPct}%">beschikbaar kapitaal &middot; ${
            getal(plafondPct, 0)} % van het kapitaal</span>
          ${margePlafondPct ? `<span class="konderschrift" style="flex-basis:${margePlafondPct}%">marge &middot; ${
            getal(margePlafondPct, 0)} %</span>` : ""}
        </div>
        <div class="kapitaallegenda">
          <span class="klegend"><i class="vlak ingezet"></i>
            <b>${euro(marge)}</b> staat uit
            <span class="faint">${getal(margePct, 1)} % &middot; ${p.open_tranches.length} open ${
              p.open_tranches.length === 1 ? "tranche" : "tranches"}</span></span>
          <span class="klegend" id="kvoorstelregel" hidden><i class="vlak voorstel"></i>
            <b id="kvoorstelbedrag"></b> dit besluit
            <span class="faint" id="kvoorstelnoot"></span></span>
          <span class="klegend"><i class="vlak vrij"></i>
            <b id="kvrijbedrag">${euro(Math.max((kapitaal * plafondPct) / 100 - marge, 0))}</b> vrij binnen het plafond
            <span class="faint" id="kvrijnoot">${getal(Math.max(plafondPct - margePct, 0), 1)} % van het kapitaal</span></span>
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
      <div class="formsectie uitkomstvorm">
        <div class="uitkomstvelden">
          <div class="formkolommen een">
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
          </div>
          <div class="formbreed">
            <label class="veldlabel" for="u_veranderde"><span class="ster">*</span> Commentaar</label>
            <div class="veldwaarde"><textarea id="u_veranderde"></textarea></div>
          </div>
        </div>
        <div class="uitkomstwie">
          <label class="veldlabel"><span class="ster">*</span> Aanwezigen</label>
          ${kiezerHtml({
            id: "u_aanwezigen",
            linkskop: "Niet bij het gesprek",
            rechtskop: "Was erbij",
            links: data.deelnemers.filter((g) => !gekozenAanwezig.includes(String(g.id))).map(rij),
            rechts: data.deelnemers.filter((g) => gekozenAanwezig.includes(String(g.id))).map(rij),
          })}
        </div>
      </div>
    </div>`;

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(cyclus.label)} — gesprek van ${toonDatum(moment.datum)}</span>
      <span class="recordmelding" id="umelding"></span>
      ${vastgelegd ? "" : `<span class="recordacties">
        <button class="knop" id="vastleggen">Uitkomst vastleggen</button>
      </span>`}
    </div>
    ${tijdlijnHtml}
    ${splitHtml}
    ${chartHtml}
    ${uitkomstHtml}
    ${portefeuilleHtml}`;

  plaatsTijdkaarten(inhoud);

  // De twee lijsten in de split zijn de echte lijsten van de applicatie:
  // zelfde kolommen, zelfde zoekvensters, alleen niets dat hier nieuw mag.
  lijstscherm(inhoud.querySelector("#vak_events"), { textContent: "" }, "cyclus_event", meta, {
    q: "", sorteer: null, richting: "asc", offset: 0,
    filters: {}, idfilters: { cyclus: String(cyclus.id) },
    ingebed: { ouder: { tabel: "cyclus", id: cyclus.id }, kolom: "cyclus",
               label: "Events in de looptijd", magNieuw: false },
  });
  // Voorwaarden zijn instapvoorwaarden: wat je gemeten hebt vóór je schrijft.
  // Het exitplan hoort bij de tranche en staat daar, niet hier — tijdens het
  // gesprek is er nog geen tranche om een stoploss aan te hangen.
  lijstscherm(inhoud.querySelector("#vak_voorwaarden"), { textContent: "" }, "voorwaarde", meta, {
    q: "", sorteer: null, richting: "asc", offset: 0,
    filters: {}, idfilters: { cyclus: String(cyclus.id) },
    ingebed: { ouder: { tabel: "cyclus", id: cyclus.id }, kolom: "cyclus",
               label: "Instapvoorwaarden", magNieuw: false },
  });

  // ---------------------------------------------------------------- gedrag

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

  // De balk volgt het inzetveld terwijl je typt: je ziet meteen wat dit besluit
  // van de portefeuille zou vragen en of het boven het plafond uitkomt. Het is
  // een rekensom, geen oordeel — het systeem adviseert niets.
  const inzetveld = inhoud.querySelector("#u_inzet");
  if (inzetveld && kapitaal) {
    const balk = inhoud.querySelector("#kvoorstel");
    const regel = inhoud.querySelector("#kvoorstelregel");
    const bedrag = inhoud.querySelector("#kvoorstelbedrag");
    const noot = inhoud.querySelector("#kvoorstelnoot");
    const vlak = regel ? regel.querySelector(".vlak") : null;
    const vrijB = inhoud.querySelector("#kvrijbedrag");
    const vrijN = inhoud.querySelector("#kvrijnoot");
    const plafond = plafondPct;

    const teken = () => {
      const pct = Number(inzetveld.value);
      const erbij = Number.isFinite(pct) && pct > 0 ? pct : 0;
      const samen = margePct + erbij;
      // De balk kan niet meer dan vol; het getal eronder zegt wél wat je typte.
      const breedte = binnen(Math.min(erbij, Math.max(plafond - margePct, 0)));
      const over = samen > plafond;
      if (balk) {
        balk.style.width = `${breedte}%`;
        balk.classList.toggle("over", over);
      }
      if (regel) regel.hidden = !erbij;
      if (vlak) vlak.classList.toggle("over", over);
      if (erbij && bedrag) bedrag.textContent = euro((kapitaal * erbij) / 100);
      if (erbij && noot) {
        noot.textContent = over
          ? `${getal(erbij, 1)} % — samen ${getal(samen, 1)} %, dat is ${getal(samen - plafond, 1)} % boven het plafond`
          : `${getal(erbij, 1)} % — samen ${getal(samen, 1)} %, ${getal(plafond - samen, 1)} % onder het plafond`;
      }
      if (vrijB) {
        vrijB.textContent = euro(Math.max((kapitaal * plafond) / 100 - marge - (kapitaal * erbij) / 100, 0));
      }
      if (vrijN) vrijN.textContent = `${getal(Math.max(plafond - samen, 0), 1)} % van het kapitaal`;
    };
    inzetveld.addEventListener("input", teken);
    if (keuze) keuze.addEventListener("change", () => { if (keuze.value !== "go") { inzetveld.value = ""; } teken(); });
    teken();
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
        : !body.wat_veranderde ? "Vul het commentaar in; ook 'niets veranderd' is een antwoord."
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
        // De uitkomst is vastgelegd; het besluit is daarmee af. Wat je daarna
        // wilt zien is de cyclus — met de positie die er bij een go net onder
        // ontstaan is.
        location.hash = `/t/cyclus/${cyclus.id}`;
      } catch (fout) {
        knop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "recordmelding fouttekst";
      }
    });
  }

  // ------------------------------------------------- de technische analyse
  // De regels bewaren zichzelf zodra je iets wijzigt. Een schermafdruk die je
  // plakt en een gesprek dat daarna anders loopt, mag je niet kwijtraken omdat
  // de uitkomst nog niet is vastgelegd.
  const rijenvak = inhoud.querySelector("#chartrijen");
  const chartmelding = inhoud.querySelector("#chartmelding");
  if (rijenvak && !vastgelegd) {
    const archief = [];
    let bezig = false, nogEens = false, wachten = null;

    const zegChart = (tekst, soort = "") => {
      if (!chartmelding) return;
      chartmelding.textContent = tekst;
      chartmelding.className = `paneelmeta ${soort}`;
    };

    const regels = () => [...rijenvak.querySelectorAll(".chartregel")].map((rij, n) => {
      const beeld = rij.querySelector(".chartbeeld img");
      const naam = rij.querySelector(".chartnaam");
      return {
        id: rij.dataset.id || null,
        onderwerp: naam ? naam.value : "",
        afbeelding: beeld ? beeld.src : null,
        commentaar: rij.querySelector(".chartcommentaar").value,
        volgorde: (n + 1) * 10,
      };
    }).concat(archief.map((id) => ({ id, archief: true })));

    const bewaarChart = async () => {
      if (bezig) { nogEens = true; return; }
      bezig = true;
      zegChart("bewaren…");
      try {
        const uit = await besluitChart(momentId, regels());
        archief.length = 0;
        // De server kent de nummers van nieuwe regels; zonder dat zou een
        // tweede keer bewaren dezelfde regel nog eens aanmaken.
        const rijen = [...rijenvak.querySelectorAll(".chartregel")];
        (uit.regels || []).forEach((r, n) => { if (rijen[n]) rijen[n].dataset.id = r.id; });
        zegChart("bewaard");
      } catch (fout) {
        zegChart(fout.message, "fouttekst");
      } finally {
        bezig = false;
        if (nogEens) { nogEens = false; bewaarChart(); }
      }
    };
    const straksBewaren = () => { clearTimeout(wachten); wachten = setTimeout(bewaarChart, 700); };

    const zetBeeld = async (rij, bestand) => {
      if (!bestand) return;
      const vak = rij.querySelector(".chartbeeld");
      try {
        const data = await verkleinChart(bestand);
        vak.classList.add("gevuld");
        vak.querySelector("img, .chartleeg").outerHTML =
          `<img src="${data}" alt="chart">`;
        if (!vak.querySelector(".chartvervang")) {
          const knop = document.createElement("button");
          knop.type = "button";
          knop.className = "chartvervang";
          knop.textContent = "Vervangen";
          vak.appendChild(knop);
        }
        bewaarChart();
      } catch (fout) {
        zegChart(fout.message, "fouttekst");
      }
    };

    const sluitRijAan = (rij) => {
      const vak = rij.querySelector(".chartbeeld");
      const bestand = rij.querySelector(".chartbestand");
      if (vak && bestand) {
        vak.addEventListener("click", (e) => {
          if (e.target.classList.contains("chartvervang")) { bestand.click(); return; }
          const beeld = vak.querySelector("img");
          if (beeld) toonGroot(beeld.src, rij.querySelector(".chartnaam").value);
          else bestand.click();
        });
        vak.addEventListener("paste", (e) => {
          const b = uitKlembord(e);
          if (b) { e.preventDefault(); zetBeeld(rij, b); }
        });
        bestand.addEventListener("change", () => zetBeeld(rij, bestand.files[0]));
      }
      rij.querySelectorAll(".chartcommentaar, .chartnaam.invulbaar")
        .forEach((el) => el.addEventListener("input", straksBewaren));
    };
    rijenvak.querySelectorAll(".chartregel").forEach(sluitRijAan);

    const erbij = inhoud.querySelector("#chartbij");
    if (erbij) erbij.addEventListener("click", () => {
      const rij = document.createElement("div");
      rij.className = "chartregel";
      rij.dataset.vast = "0";
      rij.innerHTML = `
        <div class="chartkop">
          <input class="chartnaam invulbaar" placeholder="Waar kijk je naar?">
        </div>
        <div class="chartbeeld" tabindex="0">
          <span class="chartleeg">Plak hier een schermafdruk, of <b>kies een bestand</b></span>
          <input type="file" class="chartbestand" accept="image/*" hidden>
        </div>
        <textarea class="chartcommentaar" placeholder="Wat lees je in deze chart?"></textarea>`;
      rijenvak.appendChild(rij);
      sluitRijAan(rij);
      rij.querySelector(".chartnaam").focus();
    });

    // Vlak voor het vastleggen gaat de chartlezing nog één keer mee, zodat een
    // regel die je net typte niet achterblijft in het wachtvenster.
    const vk = inhoud.querySelector("#vastleggen");
    if (vk) vk.addEventListener("click", () => { clearTimeout(wachten); bewaarChart(); }, true);
  }
}

