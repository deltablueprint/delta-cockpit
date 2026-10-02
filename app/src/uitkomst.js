// Het gesprek: één scherm waarop alles staat wat op dat moment bekend is.
//
// De eventtijdlijn met daaronder, op dezelfde as, wat ieder zou schrijven: een
// balk per inzending die eindigt op de expiratiedatum die die persoon voorstelt.
// Daarnaast de instapvoorwaarden zoals ze er nu bij staan en wat er van de
// portefeuille uitstaat. Het systeem rekent hier niets uit en adviseert niets:
// het legt naast elkaar wat er is, zodat drie mensen naar hetzelfde beeld
// kijken. Onderaan wordt één uitkomst vastgelegd (BOUWSPEC 5.4).

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

const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const dag = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`) : null);
const kortDatum = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  return m ? `${Number(m[3])} ${MND[Number(m[2]) - 1]}` : "";
};
const strike = (n) => (Number.isFinite(Number(n)) ? String(Number(n)) : "?");
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
  const vandaag = new Date().toISOString().slice(0, 10);

  function wie(id) {
    return data.deelnemers.find((d) => d.id === id) || null;
  }
  function kortVan(id) {
    const g = wie(id);
    return g ? (g.korte_naam || g.naam) : id;
  }

  // ================================================================ de as
  // Eén tijdas voor het hele blok: de events erop, de voorstellen eronder.
  // Beide zitten in dezelfde grid-kolom, zodat het einde van een balk precies
  // boven de datum op de as valt.
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
  const rand = (p) => (p < 7 ? " randlinks" : p > 93 ? " randrechts" : "");

  // De maandstreepjes geven de as schaal: je ziet waar de maanden liggen zonder
  // dat elk eventlabel daarvoor hoeft te zorgen.
  const ijkpunten = (() => {
    const uit = [];
    const d = new Date(begin);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() <= eind) {
      uit.push(d.toISOString().slice(0, 10));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    const uitgedund = uit.length > 9 ? uit.filter((_, i) => i % 2 === 0) : uit;
    return uitgedund.filter((d) => Math.abs(plek(d) - (plek(vandaag) ?? 0)) > 3.5);
  })();
  const ijkLabel = (s) => {
    const m = /^(\d{4})-(\d{2})/.exec(s);
    return Number(m[2]) === 1 ? `${MND[0]} '${m[1].slice(2)}` : MND[Number(m[2]) - 1];
  };

  // Eventlabels botsen als twee events dicht bij elkaar liggen; dan gaat de
  // tweede een regel hoger staan.
  const gesorteerd = data.events
    .filter((e) => plek(e.datum) !== null)
    .map((e) => ({ ...e, p: plek(e.datum) }))
    .sort((a, b) => a.p - b.p);
  let vorige = -99;
  let hoog = false;
  for (const e of gesorteerd) {
    hoog = e.p - vorige < 9 ? !hoog : false;
    e.hoog = hoog;
    vorige = e.p;
  }

  const zwaarte = (z) => (z === "zwaar" ? "zwaar" : z === "middel" ? "middel" : "licht");
  const eventHtml = gesorteerd.map((e) => `
    <span class="tijdpunt ${zwaarte(e.zwaarte)}${e.hoog ? " hoog" : ""}" style="left:${e.p}%" tabindex="0">
      <span class="tijdlabel">${ontsnap(kortDatum(e.datum))}</span>
      <span class="tijdkaart${rand(e.p)}">
        <b>${ontsnap(e.naam)}</b>
        <span class="tijdkaartregel">${ontsnap(toonDatum(e.datum))}${
          e.tijdstip ? ` · ${ontsnap(e.tijdstip)}${e.tijdzone ? ` ${ontsnap(e.tijdzone)}` : ""}` : ""}</span>
        <span class="tijdkaartregel">${badge(e.zwaarte || "niet gewogen",
          e.zwaarte === "zwaar" ? "rood" : e.zwaarte === "middel" ? "oranje" : "grijs")}
          ${e.soort ? `<span class="faint">${ontsnap(e.soort)}</span>` : ""}</span>
        <span class="tijdkaartregel">Behandeling: ${ontsnap(e.behandeling || "nog te wegen")}</span>
        ${e.motivering ? `<span class="tijdkaartnoot">${ontsnap(e.motivering)}</span>` : ""}
      </span>
    </span>`).join("");

  // Wat ieder zou schrijven, op diezelfde as: een balk van vandaag tot de
  // expiratie die hij voorstelt, met het contract erin.
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
        <span class="schrijfbalk" style="left:${links}%;width:${breed}%;--k:${ontsnap(kleur)}">
          <b>OESX ${strike(i.strike)} PUT</b>
        </span>
        <span class="balkeind${rand(tot)}" style="left:${tot}%">${ontsnap(kortDatum(i.expiratiedatum))}</span>
      </div></div>`;
  };

  const goTellen = data.inzendingen.filter((i) => i.positie === "go").length;
  const nogoTellen = data.inzendingen.filter((i) => i.positie === "no-go").length;
  const zwareEvents = data.events.filter((e) => e.zwaarte === "zwaar");

  const tijdlijnHtml = `
    <div class="paneel">
      <div class="paneelkop">Events in de looptijd
        <span class="paneelmeta">${data.events.length} events · ${goTellen} go · ${nogoTellen} no-go ·
          van ${toonDatum(cyclus.geopend_op)} tot ${
            cyclus.doelexpiratie ? toonDatum(cyclus.doelexpiratie) : "onbepaald"}</span></div>
      <div class="tijdblok">
        <div class="tijdrij asrij">
          <div class="tijdnaam"><span class="faint">Looptijd</span></div>
          <div class="tijdspoor">
            <div class="tijdas"></div>
            ${ijkpunten.map((s) => `<span class="tijdijk" style="left:${plek(s)}%"><i></i>${
              ontsnap(ijkLabel(s))}</span>`).join("")}
            <span class="vandaag${rand(vandaagP)}" style="left:${vandaagP}%"></span>
            ${eventHtml}
          </div>
        </div>
        ${data.inzendingen.length
          ? `<div class="tijdkopje">Wat ieder zou schrijven</div>${data.inzendingen.map(schrijfrij).join("")}`
          : ""}
      </div>
      <div class="tijdlegenda">
        <span><i class="bol zwaar"></i> zwaar</span>
        <span><i class="bol middel"></i> middel</span>
        <span><i class="bol licht"></i> licht</span>
        <span class="faint">hover over een bolletje voor de weging en de behandeling</span>
      </div>
      ${zwareEvents.length ? `<p class="paneelnoot">Zwaar in deze looptijd: ${
        zwareEvents.map((e) => `${toonDatum(e.datum)} — ${ontsnap(e.naam)}${
          e.behandeling && e.behandeling !== "nog te wegen" ? ` (${ontsnap(e.behandeling)})` : ""}`).join(" · ")}</p>` : ""}
    </div>`;

  // ------------------------------------------------------------ inzendingen
  // De cijfers en de motivering per persoon, naast elkaar. De strike en de
  // expiratie staan al op de as hierboven; hier staat waarom.
  const inzendingenHtml = !data.inzendingen.length
    ? `<div class="paneel"><div class="paneelkop">Wat ieder erbij zei</div>
         <p class="paneelleeg">Nog geen inzendingen.</p></div>`
    : `<div class="paneel">
      <div class="paneelkop">Wat ieder erbij zei<span class="paneelmeta">blind ingestuurd, nu open</span></div>
      <div class="motiveringen">
        ${data.inzendingen.map((i) => {
          const g = wie(i.deelnemer);
          return `
          <div class="motivering">
            <div class="motkop">${g ? avatar(g, 22) : ""}<span>${ontsnap(kortVan(i.deelnemer))}</span>
              ${badge(i.positie || "—", i.positie === "go" ? "groen" : "rood")}</div>
            <div class="motcijfers">
              ${Number.isFinite(Number(i.strike)) ? `<span><b>${strike(i.strike)}</b> strike</span>` : ""}
              ${i.expiratiedatum ? `<span><b>${toonDatum(i.expiratiedatum)}</b> expiratie</span>` : ""}
              ${i.inzet_pct !== null && i.inzet_pct !== undefined
                ? `<span><b>${getal(i.inzet_pct, 1)} %</b> inzet</span>` : ""}
            </div>
            ${i.motivering ? `<p>${ontsnap(i.motivering)}</p>` : `<p class="faint">Geen motivering.</p>`}
            ${i.intuitie ? `<p class="motintuitie"><strong>Intuïtie.</strong> ${ontsnap(i.intuitie)}</p>` : ""}
            ${i.wat_ik_zag ? `<p class="motintuitie"><strong>Wat ik zag.</strong> ${ontsnap(i.wat_ik_zag)}</p>` : ""}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  // ---------------------------------------------------------- portefeuille
  // Wat uitstaat en waar het plafond ligt, en daaronder per inzending wat dat
  // voorstel er bovenop zou leggen. Geen gemiddelde: ieder voorstel apart,
  // want je kiest er één.
  const p = portefeuille;
  const uit = Number(p.ingezet_pct ?? 0);
  const metInzet = data.inzendingen.filter((i) => Number.isFinite(Number(i.inzet_pct)));

  const portefeuilleHtml = !p.kapitaal ? "" : `
    <div class="paneel strook">
      <div class="paneelkop">Portefeuille
        <span class="paneelmeta">kapitaal € ${getal(p.kapitaal)} · multiplier € ${getal(p.multiplier)} per punt</span></div>
      <div class="strookregel">
        <span class="strookdeel"><b>${getal(uit, 1)} %</b> staat uit
          <span class="faint">${p.open_tranches.length} open ${p.open_tranches.length === 1 ? "tranche" : "tranches"}</span></span>
        ${p.max_inzet_pct ? `<span class="strookdeel"><b>${getal(p.max_inzet_pct, 0)} %</b> plafond
          <span class="faint">minimaal ${getal(p.min_reserve_pct || 0, 0)} % reserve</span></span>` : ""}
        ${p.max_inzet_cyclus_pct ? `<span class="strookdeel"><b>${getal(p.max_inzet_cyclus_pct, 0)} %</b> per cyclus
          <span class="faint">plafond voor deze cyclus</span></span>` : ""}
      </div>
      ${metInzet.length ? `
      <table class="feittabel">
        <thead><tr><th>Voorstel van</th><th>Legt erbij</th><th>Dan staat uit</th><th>Tegen het plafond</th></tr></thead>
        <tbody>${metInzet.map((i) => {
          const erbij = Number(i.inzet_pct);
          const samen = Math.round((uit + erbij) * 10) / 10;
          const plafond = p.max_inzet_pct ? Number(p.max_inzet_pct) : null;
          return `<tr>
            <td class="feitnaam">${ontsnap(kortVan(i.deelnemer))}</td>
            <td>${getal(erbij, 1)} %</td>
            <td>${getal(samen, 1)} %</td>
            <td>${plafond === null ? `<span class="faint">geen plafond ingesteld</span>`
              : samen > plafond
                ? badge(`${getal(samen - plafond, 1)} % boven het plafond`, "rood")
                : badge(`${getal(plafond - samen, 1)} % ruimte over`, "groen")}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>` : ""}
      ${p.open_tranches.length ? `<p class="paneelnoot">Open: ${p.open_tranches.map((t) =>
        `${ontsnap(t.cyclusnaam)} — strike ${strike(t.strike)} × ${t.aantal} tot ${toonDatum(t.expiratiedatum)}`).join(" · ")}</p>` : ""}
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
        ${moment.uitkomst === "go" ? `<span>strike ${strike(moment.strike)} · expiratie ${
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
        <div class="knoprij">
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
    <div class="gesprek">
      ${tijdlijnHtml}
      ${inzendingenHtml}
      ${portefeuilleHtml}
      ${voorwaardenHtml}
      ${uitkomstHtml}
    </div>`;

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
