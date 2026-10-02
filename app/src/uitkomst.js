// Het gesprek: één scherm waarop alles staat wat op dat moment bekend is.
//
// De eventtijdlijn, wat ieder blind heeft ingestuurd, de instapvoorwaarden
// zoals ze er nu bij staan, en wat er al van de portefeuille uitstaat. Het
// systeem rekent hier niets uit en adviseert niets: het legt naast elkaar wat
// er is, zodat drie mensen naar hetzelfde beeld kijken. Onderaan wordt één
// uitkomst vastgelegd (BOUWSPEC 5.4).

import { besluitOverzicht, besluitUitkomst } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";
import { avatar } from "./avatar.js";

const KLEUR = {
  groen: ["#1B6B3A", "#E3F2E7"], rood: ["#A1281F", "#FBE6E3"],
  oranje: ["#8A5A00", "#FBEFD8"], blauw: ["#136289", "#E1EFF6"], grijs: ["#595349", "#EDEAE3"],
};
const badge = (tekst, kleur = "grijs") => {
  const [fg, bg] = KLEUR[kleur] || KLEUR.grijs;
  return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(tekst)}</span>`;
};

const dag = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`) : null);
const getal = (n, cijfers = 0) =>
  Number(n).toLocaleString("nl-BE", { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });

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

  // ---------------------------------------------------------------- tijdlijn
  // Van de opening van de cyclus tot de doelexpiratie, met vandaag erin en de
  // voorgestelde expiraties erop. Zo zie je waar de events vallen ten opzichte
  // van wat ieder wil schrijven.
  const begin = dag(cyclus.geopend_op) || dag(data.events[0] && data.events[0].datum) || Date.now();
  const eind = Math.max(
    dag(cyclus.doelexpiratie) || 0,
    ...data.inzendingen.map((i) => dag(i.expiratiedatum) || 0),
    begin + 86400000
  );
  const plek = (d) => {
    const t = dag(d);
    if (!t) return null;
    return Math.max(0, Math.min(100, ((t - begin) / (eind - begin)) * 100));
  };

  const zwaarteKleur = { zwaar: "rood", middel: "oranje", licht: "grijs" };
  const tijdlijnHtml = `
    <div class="paneel">
      <div class="paneelkop">Events in de looptijd
        <span class="paneelmeta">${data.events.length} events · van ${toonDatum(cyclus.geopend_op)} tot ${
          cyclus.doelexpiratie ? toonDatum(cyclus.doelexpiratie) : "onbepaald"}</span></div>
      <div class="tijdlijn">
        <div class="tijdas"></div>
        ${plek(new Date().toISOString().slice(0, 10)) !== null
          ? `<span class="vandaag" style="left:${plek(new Date().toISOString().slice(0, 10))}%" title="vandaag"></span>` : ""}
        ${data.events.filter((e) => plek(e.datum) !== null).map((e) => `
          <span class="tijdpunt ${e.zwaarte === "zwaar" ? "zwaar" : e.zwaarte === "middel" ? "middel" : "licht"}"
                style="left:${plek(e.datum)}%"
                title="${ontsnap(`${e.datum} · ${e.naam} · ${e.zwaarte || "niet gewogen"} · ${e.behandeling}`)}"></span>`).join("")}
        ${data.inzendingen.filter((i) => i.expiratiedatum).map((i) => `
          <span class="tijdexpiratie" style="left:${plek(i.expiratiedatum)}%"
                title="${ontsnap(`${naamVan(i.deelnemer)} wil expiratie ${i.expiratiedatum}`)}">
            <span class="tijdvlag">${ontsnap(kortVan(i.deelnemer))}</span></span>`).join("")}
      </div>
      <div class="tijdlegenda">
        <span><i class="bol zwaar"></i> zwaar</span>
        <span><i class="bol middel"></i> middel</span>
        <span><i class="bol licht"></i> licht</span>
        <span><i class="streep"></i> voorgestelde expiratie</span>
      </div>
      ${zwareEvents().length ? `<p class="paneelnoot">Zwaar in deze looptijd: ${
        zwareEvents().map((e) => `${toonDatum(e.datum)} — ${ontsnap(e.naam)}${
          e.behandeling && e.behandeling !== "nog te wegen" ? ` (${ontsnap(e.behandeling)})` : ""}`).join(" · ")}</p>` : ""}
    </div>`;

  function zwareEvents() {
    return data.events.filter((e) => e.zwaarte === "zwaar");
  }
  function naamVan(id) {
    const g = data.deelnemers.find((d) => d.id === id);
    return g ? g.naam : id;
  }
  function kortVan(id) {
    const g = data.deelnemers.find((d) => d.id === id);
    return g ? (g.korte_naam || g.naam) : id;
  }

  // ------------------------------------------------------------ inzendingen
  // Wie wil wat schrijven. De strikes staan op één as, zodat je in één blik
  // ziet hoe ver ze uit elkaar liggen.
  const strikes = data.inzendingen.map((i) => Number(i.strike)).filter((n) => Number.isFinite(n));
  const laag = strikes.length ? Math.min(...strikes) : 0;
  const hoog = strikes.length ? Math.max(...strikes) : 0;
  const marge = Math.max((hoog - laag) * 0.4, 50);
  const strikePlek = (s) => {
    if (!Number.isFinite(Number(s)) || !strikes.length) return null;
    const van = laag - marge;
    const tot = hoog + marge;
    return ((Number(s) - van) / (tot - van)) * 100;
  };

  const goTellen = data.inzendingen.filter((i) => i.positie === "go").length;
  const nogoTellen = data.inzendingen.filter((i) => i.positie === "no-go").length;

  const inzendingenHtml = `
    <div class="paneel">
      <div class="paneelkop">Wat ieder zou schrijven
        <span class="paneelmeta">${goTellen} go · ${nogoTellen} no-go${
          strikes.length > 1 ? ` · strikes ${getal(laag)} tot ${getal(hoog)}` : ""}</span></div>
      ${!data.inzendingen.length ? `<p class="paneelleeg">Nog geen inzendingen.</p>` : `
      <div class="inzendbalken">
        ${data.inzendingen.map((i) => {
          const g = data.deelnemers.find((d) => d.id === i.deelnemer);
          const links = strikePlek(i.strike);
          return `
          <div class="inzendbalk">
            <div class="inzendwie">${g ? avatar(g, 22) : ""}<span>${ontsnap(kortVan(i.deelnemer))}</span>
              ${badge(i.positie || "—", i.positie === "go" ? "groen" : "rood")}</div>
            <div class="inzendas">
              ${links === null ? `<span class="inzendgeen">${ontsnap(i.reden || "geen positie")}</span>` : `
                <span class="inzendmerk" style="left:${links}%">
                  <span class="inzendstrike">${getal(i.strike)}</span></span>`}
            </div>
            <div class="inzendcijfers">
              ${i.expiratiedatum ? `<span>${toonDatum(i.expiratiedatum)}</span>` : `<span class="faint">—</span>`}
              ${i.inzet_pct !== null && i.inzet_pct !== undefined
                ? `<span class="inzetbalk" title="${getal(i.inzet_pct, 1)} % van het kapitaal">
                     <i style="width:${Math.min(100, Number(i.inzet_pct) * 2)}%"></i>
                     <b>${getal(i.inzet_pct, 1)} %</b></span>`
                : `<span class="faint">—</span>`}
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="motiveringen">
        ${data.inzendingen.map((i) => `
          <div class="motivering">
            <div class="motkop">${ontsnap(kortVan(i.deelnemer))}</div>
            ${i.motivering ? `<p>${ontsnap(i.motivering)}</p>` : `<p class="faint">Geen motivering.</p>`}
            ${i.intuitie ? `<p class="motintuitie"><strong>Intuïtie.</strong> ${ontsnap(i.intuitie)}</p>` : ""}
            ${i.wat_ik_zag ? `<p class="motintuitie"><strong>Wat ik zag.</strong> ${ontsnap(i.wat_ik_zag)}</p>` : ""}
          </div>`).join("")}
      </div>`}
    </div>`;

  // ---------------------------------------------------------- portefeuille
  const p = portefeuille;
  const voorgenomen = data.inzendingen
    .map((i) => Number(i.inzet_pct))
    .filter((n) => Number.isFinite(n));
  const gemiddeld = voorgenomen.length
    ? Math.round((voorgenomen.reduce((a, b) => a + b, 0) / voorgenomen.length) * 10) / 10
    : null;

  const portefeuilleHtml = !p.kapitaal ? "" : `
    <div class="paneel strook">
      <div class="paneelkop">Portefeuille
        <span class="paneelmeta">kapitaal € ${getal(p.kapitaal)} · multiplier € ${getal(p.multiplier)} per punt</span></div>
      <div class="strookregel">
        <span class="strookdeel"><b>${getal(p.ingezet_pct ?? 0, 1)} %</b> staat uit
          <span class="faint">${p.open_tranches.length} open ${p.open_tranches.length === 1 ? "tranche" : "tranches"}</span></span>
        ${gemiddeld !== null ? `<span class="strookdeel"><b>${getal(gemiddeld, 1)} %</b> voorgenomen
          <span class="faint">gemiddelde van de inzendingen</span></span>` : ""}
        ${p.max_inzet_pct ? `<span class="strookdeel"><b>${getal(p.max_inzet_pct, 0)} %</b> plafond
          <span class="faint">minimaal ${getal(p.min_reserve_pct || 0, 0)} % reserve</span></span>` : ""}
      </div>
      ${p.open_tranches.length ? `<p class="paneelnoot">Open: ${p.open_tranches.map((t) =>
        `${ontsnap(t.cyclusnaam)} — strike ${getal(t.strike)} × ${t.aantal} tot ${toonDatum(t.expiratiedatum)}`).join(" · ")}</p>` : ""}
    </div>`;

  // ------------------------------------------------------------ voorwaarden
  const instap = data.voorwaarden.filter((v) => v.soort === "instap");
  const uitstap = data.voorwaarden.filter((v) => v.soort !== "instap");
  const statuskleur = { groen: "groen", oranje: "oranje", rood: "rood" };
  const voorwaardenTabel = (lijst) => `
    <table class="feittabel">
      <thead><tr><th>Voorwaarde</th><th>Waar gekeken</th><th>Gemeten</th><th>Status</th></tr></thead>
      <tbody>${lijst.map((v) => `
        <tr><td class="feitnaam">${ontsnap(v.naam)}</td><td>${ontsnap(v.bron || "—")}</td>
          <td>${ontsnap(v.gemeten_waarde || "—")}</td>
          <td>${badge(v.status, statuskleur[v.status] || "grijs")}</td></tr>`).join("")}
      </tbody></table>`;

  const voorwaardenHtml = `
    <div class="paneel">
      <div class="paneelkop">Instapvoorwaarden
        <span class="paneelmeta">${instap.filter((v) => v.status === "groen").length} groen ·
          ${instap.filter((v) => v.status === "rood").length} rood ·
          ${instap.filter((v) => v.status === "niet gemeten").length} niet gemeten —
          alleen lezen, bijwerken gebeurt op de cyclus</span></div>
      ${instap.length ? voorwaardenTabel(instap) : `<p class="paneelleeg">Nog geen instapvoorwaarden.</p>`}
    </div>
    ${uitstap.length ? `<div class="paneel">
      <div class="paneelkop">Uitstapvoorwaarden<span class="paneelmeta">alleen lezen</span></div>
      ${voorwaardenTabel(uitstap)}</div>` : ""}
    <div class="paneel">
      <div class="paneelkop">Technische analyse<span class="paneelmeta">chartlezing met niveaus</span></div>
      <p class="paneelleeg">De chartanalyse is nog niet gebouwd (etappe 11b). Tot dan hoort de lezing van de
        charts in de motivering van de inzendingen.</p>
    </div>`;

  // --------------------------------------------------------------- uitkomst
  const uitkomstHtml = vastgelegd ? `
    <div class="paneel">
      <div class="paneelkop">Uitkomst van het gesprek<span class="paneelmeta">vastgelegd op ${
        ontsnap(moment.vastgelegd_op || "")}</span></div>
      <div class="uitkomstvast">
        ${badge(moment.uitkomst || "—", moment.uitkomst === "go" ? "groen" : "rood")}
        ${moment.uitkomst === "go" ? `<span>strike ${getal(moment.strike)} · expiratie ${
          toonDatum(moment.expiratiedatum)} · inzet ${getal(moment.inzet_pct, 1)} %</span>` : ""}
        ${moment.wat_veranderde ? `<p>${ontsnap(moment.wat_veranderde)}</p>` : ""}
      </div>
    </div>` : `
    <div class="paneel">
      <div class="paneelkop">Uitkomst van het gesprek<span class="paneelmeta">één uitkomst voor de groep</span></div>
      <div class="formsectie">
        <div class="formkolommen">
          <div class="formkolom">
            <label class="veldlabel" for="u_uitkomst"><span class="ster">*</span> Uitkomst</label>
            <div class="veldwaarde"><select id="u_uitkomst">
              <option value="">&mdash;</option><option value="go">Go</option><option value="no-go">No-go</option>
            </select></div>
            <label class="veldlabel" for="u_expiratie" data-alleen="go" hidden>Expiratiedatum</label>
            <div class="veldwaarde" data-alleen="go" hidden><input id="u_expiratie" type="date"></div>
            <label class="veldlabel" for="u_strike" data-alleen="go" hidden>Strike</label>
            <div class="veldwaarde" data-alleen="go" hidden><input id="u_strike" type="number" step="25"></div>
            <label class="veldlabel" for="u_inzet" data-alleen="go" hidden>Inzet in % van het kapitaal</label>
            <div class="veldwaarde" data-alleen="go" hidden>
              <span class="metteken"><input id="u_inzet" type="number" step="0.1"><span class="teken">%</span></span></div>
            <label class="veldlabel" for="u_volgend" data-alleen="no-go" hidden>Volgend analysemoment</label>
            <div class="veldwaarde" data-alleen="no-go" hidden><input id="u_volgend" type="date"></div>
          </div>
          <div class="formkolom">
            <label class="veldlabel" for="u_aanwezigen">Aanwezigen</label>
            <div class="veldwaarde"><input id="u_aanwezigen" type="text"
              value="${ontsnap(data.aanwezigen.map(kortVan).join(", "))}"></div>
          </div>
        </div>
        <div class="formbreed">
          <label class="veldlabel" for="u_veranderde">Wat het gesprek veranderde</label>
          <div class="veldwaarde"><textarea id="u_veranderde" placeholder="Wat is er gezegd dat iemands oordeel heeft verschoven?"></textarea></div>
        </div>
        <div class="knoprij" style="padding-left:20px">
          <button class="knop" id="vastleggen">Uitkomst vastleggen</button>
          <span class="paneelmeta">Bij een go ontstaat het positierecord vanzelf, met dit besluit eronder.</span>
        </div>
      </div>
    </div>`;

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(cyclus.label)} — gesprek van ${toonDatum(moment.datum)}</span>
      <span class="recordmelding" id="umelding"></span>
      <span class="recordacties">
        <a class="knop tweede" href="#/t/beoordelingsmoment/${moment.id}">Terug naar het besluit</a>
      </span>
    </div>
    ${tijdlijnHtml}
    ${inzendingenHtml}
    ${portefeuilleHtml}
    ${voorwaardenHtml}
    ${uitkomstHtml}`;

  // ---------------------------------------------------------------- gedrag
  const keuze = inhoud.querySelector("#u_uitkomst");
  if (keuze) {
    const toon = () => inhoud.querySelectorAll("[data-alleen]").forEach((el) => {
      el.hidden = el.dataset.alleen !== keuze.value;
    });
    keuze.addEventListener("change", toon);
    toon();
  }

  const melding = inhoud.querySelector("#umelding");
  const knop = inhoud.querySelector("#vastleggen");
  if (knop) {
    knop.addEventListener("click", async () => {
      knop.disabled = true;
      melding.textContent = "Bezig met vastleggen…";
      melding.className = "recordmelding";
      const lees = (id) => {
        const el = inhoud.querySelector(id);
        return el && el.value !== "" ? el.value : null;
      };
      try {
        await besluitUitkomst(momentId, {
          uitkomst: lees("#u_uitkomst"),
          strike: lees("#u_strike"),
          expiratiedatum: lees("#u_expiratie"),
          inzet_pct: lees("#u_inzet"),
          aanwezigen: lees("#u_aanwezigen"),
          volgend_moment: lees("#u_volgend"),
          wat_veranderde: lees("#u_veranderde"),
        });
        location.hash = `/t/beoordelingsmoment/${momentId}`;
      } catch (fout) {
        knop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "recordmelding fouttekst";
      }
    });
  }
}
