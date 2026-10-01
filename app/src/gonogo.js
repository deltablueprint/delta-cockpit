// Etappe 10 — het actiescherm van de go/no-go.
//
// Eén scherm met twee gezichten: zolang de inzendingen dicht zijn, vul je je
// eigen oordeel in; zodra het quorum gehaald is, staan ze open en komt het
// blok *Uitkomst van het gesprek* eronder. Hetzelfde beeld, dezelfde feiten —
// wat verschilt is of er open is en of er een uitkomst vastgelegd wordt
// (BOUWSPEC 5.4, 10.0e).
//
// Het scherm rekent niets uit. Er staat geen score en geen advies: een getal
// dat er staat voordat iemand oordeelt, stuurt dat oordeel.

import { gonogoStand, gonogoMoment, gonogoVersturen, gonogoUitkomst } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";
import { avatar, avatarMetNaam } from "./avatar.js";
import { inBrussel } from "./tijdzone.js";

const KLEURBADGE = {
  groen: ["#1B6B3A", "#E3F2E7"], rood: ["#A1281F", "#FBE6E3"],
  oranje: ["#8A5A00", "#FBEFD8"], blauw: ["#136289", "#E1EFF6"], grijs: ["#595349", "#EDEAE3"],
};

const badge = (tekst, kleur = "grijs") => {
  const [fg, bg] = KLEURBADGE[kleur] || KLEURBADGE.grijs;
  return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(tekst)}</span>`;
};

const STATUSKLEUR = { groen: "groen", oranje: "oranje", rood: "rood" };

export async function gonogoscherm(inhoud, kruimel, cyclusId, meta) {
  inhoud.innerHTML = `<div class="kaart leeg">Bezig met ophalen…</div>`;

  let data;
  try {
    data = await gonogoStand(cyclusId);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  const { cyclus, moment, quorum } = data;
  const open = data.open;
  const vastgelegd = moment && moment.status === "uitkomst vastgelegd";
  const titel = open ? "Go / no-go meeting" : "Positie blind versturen";

  kruimel.innerHTML = `<a href="#/t/cyclus">Cycli</a> <span class="pijlje">&rsaquo;</span>
    <a href="#/t/cyclus/${cyclus.id}">${ontsnap(cyclus.label)}</a>
    <span class="pijlje">&rsaquo;</span> <span>${titel}</span>`;
  document.title = `${titel} · ${cyclus.label}`;

  // ---- nog geen moment ----
  // Staat de cyclus al op *go / no-go*, dan is het moment er alleen nog niet
  // omdat deze cyclus van vóór die regel is: dan openen we het stilletjes.
  // Staat de cyclus ergens anders, dan hoort hier geen knop maar uitleg — de
  // stap begint op het cyclusrecord, niet hier.
  if (!moment) {
    if (cyclus.status === "go-nogo") {
      try {
        await gonogoMoment(cyclusId);
        gonogoscherm(inhoud, kruimel, cyclusId, meta);
      } catch (fout) {
        inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
      }
      return;
    }

    inhoud.innerHTML = `
      <div class="recordbalk">
        <span class="recordnaam">${ontsnap(cyclus.label)}</span>
        <span class="recordacties">
          <a class="knop tweede" href="#/t/cyclus/${cyclus.id}">Terug naar ${ontsnap(cyclus.label)}</a>
        </span>
      </div>
      <div class="kaart leeg">
        Deze cyclus staat op <em>${ontsnap(cyclus.status)}</em>. Een go/no-go begint op het
        cyclusrecord: zet de status op <em>go / no-go</em>, en het beoordelingsmoment staat klaar.
      </div>`;
    return;
  }

  // ---- de stappenbalk van dit moment ----
  const standen = [
    ["blind versturen", "Blind versturen"],
    ["inzendingen open", "Inzendingen open"],
    ["uitkomst vastgelegd", "Uitkomst vastgelegd"],
  ];
  const nu = standen.findIndex(([w]) => w === moment.status);
  const chevrons = `<div class="chevrons">${standen.map(([, label], i) => {
    const stand = i < nu ? "gedaan" : i === nu ? "nu" : "straks";
    return `<span class="chevron ${stand}">${label}</span>`;
  }).join("")}</div>`;

  // ---- de feiten waartegen geoordeeld wordt ----
  const instap = data.voorwaarden.filter((v) => v.soort === "instap");
  const voorwaardenHtml = `
    <div class="feitpaneel">
      <div class="feitkop">Instapvoorwaarden<span class="feitmeta">alleen lezen — bijwerken gebeurt op de cyclus</span></div>
      ${instap.length === 0 ? `<p class="feitleeg">Nog geen instapvoorwaarden ingevuld.</p>` : `
      <table class="feittabel">
        <thead><tr><th>Voorwaarde</th><th>Waar gekeken</th><th>Gemeten</th><th>Status</th><th>Door</th></tr></thead>
        <tbody>${instap.map((v) => `
          <tr>
            <td class="feitnaam">${ontsnap(v.naam)}</td>
            <td>${ontsnap(v.bron || "—")}</td>
            <td>${ontsnap(v.gemeten_waarde || "—")}</td>
            <td>${badge(v.status, STATUSKLEUR[v.status] || "grijs")}</td>
            <td>${v.gemeten_door && meta.gebruikers[v.gemeten_door]
                  ? avatarMetNaam(meta.gebruikers[v.gemeten_door]) : "—"}</td>
          </tr>`).join("")}</tbody>
      </table>`}
    </div>`;

  const gewogen = data.events.filter((e) => e.behandeling && e.behandeling !== "nog te wegen").length;
  const eventsHtml = `
    <div class="feitpaneel">
      <div class="feitkop">Events in de looptijd
        <span class="feitmeta">behandeling vastgelegd voor ${gewogen} van ${data.events.length}</span></div>
      ${data.events.length === 0 ? `<p class="feitleeg">Geen events in deze looptijd.</p>` : `
      <table class="feittabel">
        <thead><tr><th>Datum</th><th>Tijdstip</th><th>Event</th><th>Zwaarte</th><th>Behandeling</th></tr></thead>
        <tbody>${data.events.map((e) => {
          const om = e.tijdstip ? inBrussel(e.datum, e.tijdstip, e.tijdzone || "Europe/Brussels") : null;
          return `
          <tr>
            <td>${toonDatum(e.datum)}</td>
            <td>${om ? `${om.tijd} <span class="zonetekst">${om.afkorting}</span>` : "—"}</td>
            <td class="feitnaam">${ontsnap(e.naam)}</td>
            <td>${badge(e.zwaarte || "niet gewogen",
                        e.zwaarte === "zwaar" ? "rood" : e.zwaarte === "middel" ? "oranje" : "grijs")}</td>
            <td>${e.behandeling === "nog te wegen"
                  ? `<span class="faint">nog te wegen</span>` : ontsnap(e.behandeling || "—")}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`}
    </div>`;

  // ---- wie er al verstuurd heeft: dát, niet wát ----
  const perPersoon = data.deelnemers.map((g) => {
    const i = data.inzendingen.find((x) => x.deelnemer === g.id);
    return { g, i };
  });
  const verstuurdHtml = `
    <div class="quorumbalk">
      <span class="quorumtelling">${quorum.verstuurd} van ${quorum.nodig} verstuurd</span>
      ${perPersoon.map(({ g, i }) => `
        <span class="quorumpersoon ${i && i.status === "verstuurd" ? "klaar" : ""}">
          ${avatar(g, 22)}<span>${ontsnap(g.korte_naam || g.naam)}</span>
          ${i && i.status === "verstuurd"
            ? `<span class="quorumtijd">${String(i.verstuurd_op || "").slice(11, 16)}</span>`
            : `<span class="quorumtijd faint">nog niet</span>`}
        </span>`).join("")}
      ${open ? "" : `<span class="quorumnote">Wat erin staat blijft dicht tot ${quorum.nodig} van ${quorum.van} verstuurd heeft — ook voor wie als eerste was.</span>`}
    </div>`;

  // ---- mijn eigen inzending ----
  const mijn = data.mijn;
  const alVerstuurd = mijn && mijn.status === "verstuurd";
  const toon = (w) => (w === null || w === undefined || w === "" ? "—" : ontsnap(String(w)));

  const mijnHtml = alVerstuurd
    ? `<div class="formsectie">
         <div class="formsectiekop">Mijn inzending — verstuurd en vastgezet</div>
         <div class="formkolommen">
           <div class="formkolom">
             <span class="veldlabel">Beslissing</span><div class="veldwaarde">${badge(mijn.positie || "—", mijn.positie === "go" ? "groen" : "rood")}</div>
             <span class="veldlabel">Strike</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.strike)}</span></div>
             <span class="veldlabel">Expiratiedatum</span><div class="veldwaarde"><span class="alleenlezen">${mijn.expiratiedatum ? toonDatum(mijn.expiratiedatum) : "—"}</span></div>
           </div>
           <div class="formkolom">
             <span class="veldlabel">Inzet in % van het kapitaal</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.inzet_pct)}</span></div>
             <span class="veldlabel">Reden bij no-go</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.reden)}</span></div>
             <span class="veldlabel">Verstuurd op</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.verstuurd_op)}</span></div>
           </div>
         </div>
         <div class="formbreed">
           <span class="veldlabel">Motivering</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.motivering)}</span></div>
           <span class="veldlabel">Intuïtieve waarneming</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.intuitie)}</span></div>
           <span class="veldlabel">Wat ik zag in de markt</span><div class="veldwaarde"><span class="alleenlezen">${toon(mijn.wat_ik_zag)}</span></div>
         </div>
       </div>`
    : `<div class="formsectie">
         <div class="formsectiekop">Mijn oordeel</div>
         <div class="formkolommen">
           <div class="formkolom">
             <label class="veldlabel" for="positie"><span class="ster">*</span> Beslissing</label>
             <div class="veldwaarde">
               <select id="positie" data-kolom="positie">
                 <option value="">&mdash;</option>
                 <option value="go">Go</option>
                 <option value="no-go">No-go</option>
               </select>
             </div>
             <label class="veldlabel" for="reden" data-alleen="no-go" hidden>Reden bij no-go</label>
             <div class="veldwaarde" data-alleen="no-go" hidden><input id="reden" data-kolom="reden" type="text"></div>
             <label class="veldlabel" for="strike" data-alleen="go" hidden><span class="ster">*</span> Strike</label>
             <div class="veldwaarde" data-alleen="go" hidden><input id="strike" data-kolom="strike" type="number" step="25"></div>
           </div>
           <div class="formkolom">
             <label class="veldlabel" for="expiratiedatum" data-alleen="go" hidden><span class="ster">*</span> Expiratiedatum</label>
             <div class="veldwaarde" data-alleen="go" hidden><input id="expiratiedatum" data-kolom="expiratiedatum" type="date"></div>
             <label class="veldlabel" for="inzet_pct" data-alleen="go" hidden>Inzet in % van het kapitaal</label>
             <div class="veldwaarde" data-alleen="go" hidden><input id="inzet_pct" data-kolom="inzet_pct" type="number" step="0.1"></div>
           </div>
         </div>
         <div class="formbreed">
           <label class="veldlabel" for="motivering">Motivering</label>
           <div class="veldwaarde"><textarea id="motivering" data-kolom="motivering"></textarea></div>
           <label class="veldlabel" for="intuitie">Intuïtieve waarneming</label>
           <div class="veldwaarde"><textarea id="intuitie" data-kolom="intuitie"></textarea></div>
           <label class="veldlabel" for="wat_ik_zag">Wat ik zag in de markt</label>
           <div class="veldwaarde"><textarea id="wat_ik_zag" data-kolom="wat_ik_zag"></textarea></div>
         </div>
         <div class="knoprij" style="padding-left:20px">
           <button class="knop" id="versturen">Versturen</button>
           <span class="feitmeta">Versturen vergrendelt je inzending. Daarna wijzig je haar niet meer — wie van mening verandert, doet dat in het gesprek.</span>
         </div>
       </div>`;

  // ---- de inzendingen naast elkaar, zodra ze open zijn ----
  const inzendingenHtml = !open ? "" : `
    <div class="feitpaneel">
      <div class="feitkop">De inzendingen<span class="feitmeta">open sinds ${ontsnap(String(moment.quorum_gehaald_op || "").slice(0, 16))}</span></div>
      <div class="inzendingen">
        ${perPersoon.filter(({ i }) => i).map(({ g, i }) => `
          <div class="inzending">
            <div class="inzendkop">${avatar(g, 24)}<span class="inzendnaam">${ontsnap(g.naam)}</span>
              ${badge(i.positie || "—", i.positie === "go" ? "groen" : "rood")}</div>
            <dl class="inzendfeiten">
              <dt>Strike</dt><dd>${toon(i.strike)}</dd>
              <dt>Expiratie</dt><dd>${i.expiratiedatum ? toonDatum(i.expiratiedatum) : "—"}</dd>
              <dt>Inzet</dt><dd>${i.inzet_pct === null || i.inzet_pct === undefined ? "—" : `${toon(i.inzet_pct)} %`}</dd>
              ${i.reden ? `<dt>Reden</dt><dd>${ontsnap(i.reden)}</dd>` : ""}
            </dl>
            ${i.motivering ? `<p class="inzendtekst"><strong>Motivering.</strong> ${ontsnap(i.motivering)}</p>` : ""}
            ${i.intuitie ? `<p class="inzendtekst"><strong>Intuïtie.</strong> ${ontsnap(i.intuitie)}</p>` : ""}
            ${i.wat_ik_zag ? `<p class="inzendtekst"><strong>Wat ik zag.</strong> ${ontsnap(i.wat_ik_zag)}</p>` : ""}
          </div>`).join("")}
      </div>
    </div>`;

  // ---- de uitkomst van het gesprek ----
  const uitkomstHtml = !open ? "" : vastgelegd
    ? `<div class="formsectie">
         <div class="formsectiekop">Uitkomst van het gesprek — vastgelegd</div>
         <div class="formkolommen">
           <div class="formkolom">
             <span class="veldlabel">Uitkomst</span><div class="veldwaarde">${badge(moment.uitkomst || "—", moment.uitkomst === "go" ? "groen" : "rood")}</div>
             <span class="veldlabel">Strike</span><div class="veldwaarde"><span class="alleenlezen">${toon(moment.strike)}</span></div>
             <span class="veldlabel">Expiratiedatum</span><div class="veldwaarde"><span class="alleenlezen">${moment.expiratiedatum ? toonDatum(moment.expiratiedatum) : "—"}</span></div>
           </div>
           <div class="formkolom">
             <span class="veldlabel">Aantal contracten</span><div class="veldwaarde"><span class="alleenlezen">${toon(moment.aantal_contracten)}</span></div>
             <span class="veldlabel">Aanwezigen</span><div class="veldwaarde"><span class="alleenlezen">${toon(moment.aanwezigen)}</span></div>
             <span class="veldlabel">Vastgelegd op</span><div class="veldwaarde"><span class="alleenlezen">${toon(moment.vastgelegd_op)}</span></div>
           </div>
         </div>
         <div class="formbreed">
           <span class="veldlabel">Wat het gesprek veranderde</span><div class="veldwaarde"><span class="alleenlezen">${toon(moment.wat_veranderde)}</span></div>
         </div>
       </div>`
    : `<div class="formsectie">
         <div class="formsectiekop">Uitkomst van het gesprek</div>
         <div class="formkolommen">
           <div class="formkolom">
             <label class="veldlabel" for="u_uitkomst"><span class="ster">*</span> Uitkomst</label>
             <div class="veldwaarde">
               <select id="u_uitkomst"><option value="">&mdash;</option><option value="go">Go</option><option value="no-go">No-go</option></select>
             </div>
             <label class="veldlabel" for="u_strike">Strike</label>
             <div class="veldwaarde"><input id="u_strike" type="number" step="25"></div>
             <label class="veldlabel" for="u_expiratiedatum">Expiratiedatum</label>
             <div class="veldwaarde"><input id="u_expiratiedatum" type="date"></div>
           </div>
           <div class="formkolom">
             <label class="veldlabel" for="u_aantal">Aantal contracten</label>
             <div class="veldwaarde"><input id="u_aantal" type="number" step="1"></div>
             <label class="veldlabel" for="u_aanwezigen">Aanwezigen</label>
             <div class="veldwaarde"><input id="u_aanwezigen" type="text"></div>
             <label class="veldlabel" for="u_volgend">Volgend moment bij no-go</label>
             <div class="veldwaarde"><input id="u_volgend" type="date"></div>
           </div>
         </div>
         <div class="formbreed">
           <label class="veldlabel" for="u_veranderde">Wat het gesprek veranderde</label>
           <div class="veldwaarde"><textarea id="u_veranderde"></textarea></div>
         </div>
         <div class="knoprij" style="padding-left:20px">
           <button class="knop" id="vastleggen">Uitkomst vastleggen</button>
           <span class="feitmeta">Voor uitvoering zijn drie go's nodig (5.5). Het systeem rekent niets uit en plaatst nooit zelf een order: een go zet de cyclus op <em>uitvoering ophalen</em>.</span>
         </div>
       </div>`;

  inhoud.innerHTML = `
    <div class="recordbalk">
      <span class="recordnaam">${ontsnap(cyclus.label)} — ${titel}</span>
      <span class="recordmelding" id="gmelding"></span>
      <span class="recordacties">
        <a class="knop tweede" href="#/t/cyclus/${cyclus.id}">Terug naar ${ontsnap(cyclus.label)}</a>
      </span>
    </div>
    ${chevrons}
    <div class="formulier">
      ${open ? "" : mijnHtml}
      ${open && !alVerstuurd ? mijnHtml : ""}
    </div>
    ${verstuurdHtml}
    <div class="feiten">${eventsHtml}${voorwaardenHtml}</div>
    ${inzendingenHtml}
    ${open ? `<div class="formulier">${uitkomstHtml}</div>` : ""}`;

  const melding = inhoud.querySelector("#gmelding");

  // Wat je kiest bepaalt wat er verder gevraagd wordt: bij een go de positie,
  // bij een no-go de reden. Velden die niet van toepassing zijn, staan er niet
  // — ze leiden alleen maar af van de keuze die je maakt.
  const keuze = inhoud.querySelector("#positie");
  if (keuze) {
    const toonBijKeuze = () => {
      inhoud.querySelectorAll("[data-alleen]").forEach((el) => {
        el.hidden = el.dataset.alleen !== keuze.value;
      });
    };
    keuze.addEventListener("change", toonBijKeuze);
    toonBijKeuze();
  }

  const verstuurknop = inhoud.querySelector("#versturen");
  if (verstuurknop) {
    verstuurknop.addEventListener("click", async () => {
      verstuurknop.disabled = true;
      melding.textContent = "Bezig met versturen…";
      melding.className = "recordmelding";
      const body = {};
      inhoud.querySelectorAll(".formulier [data-kolom]").forEach((el) => {
        body[el.dataset.kolom] = el.value === "" ? null : el.value;
      });
      try {
        await gonogoVersturen(cyclusId, body);
        gonogoscherm(inhoud, kruimel, cyclusId, meta);
      } catch (fout) {
        verstuurknop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "recordmelding fouttekst";
      }
    });
  }

  const vastknop = inhoud.querySelector("#vastleggen");
  if (vastknop) {
    vastknop.addEventListener("click", async () => {
      vastknop.disabled = true;
      melding.textContent = "Bezig met vastleggen…";
      melding.className = "recordmelding";
      const lees = (id) => {
        const el = inhoud.querySelector(id);
        return el && el.value !== "" ? el.value : null;
      };
      try {
        await gonogoUitkomst(cyclusId, {
          uitkomst: lees("#u_uitkomst"),
          strike: lees("#u_strike"),
          expiratiedatum: lees("#u_expiratiedatum"),
          aantal_contracten: lees("#u_aantal"),
          aanwezigen: lees("#u_aanwezigen"),
          volgend_moment: lees("#u_volgend"),
          wat_veranderde: lees("#u_veranderde"),
        });
        gonogoscherm(inhoud, kruimel, cyclusId, meta);
      } catch (fout) {
        vastknop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "recordmelding fouttekst";
      }
    });
  }
}
