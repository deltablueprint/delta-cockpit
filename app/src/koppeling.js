// De brokerkoppeling: leeft ze, en wat ziet ze?
//
// Een koppeling die stil kan uitvallen hoort een plek te hebben waar je ziet
// dat ze leeft. Bovenaan daarom geen tabel maar één zin die klopt: live, of
// hoe lang het al stil is. Daaronder wat de brug op dit moment ziet, het spoor
// van wat er gebeurde, en de weinige dingen die je mag veranderen.
//
// Wat je hier níét vindt: tokens, sleutels en wachtwoorden. Die staan in
// Cloudflare en op de brugmachine. Een veld dat een geheim kan tonen, is een
// veld dat het ooit toont.

import { brugStand, brugInstelling, brugFlex } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";

// Leeg is leeg. Number(null) is nul, en nul is een antwoord dat hier niet
// gegeven is — dan hoort er een streepje te staan.
const getal = (n, c = 0) =>
  n === null || n === undefined || n === "" || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("nl-BE", { minimumFractionDigits: c, maximumFractionDigits: c });
const euro = (n) => (getal(n, 0) === "—" ? "—" : `€ ${getal(n, 0)}`);

// 'net' · '40 seconden' · '12 minuten' · '3 uur'. Preciezer helpt niet.
function sinds(seconden) {
  const s = Number(seconden);
  if (!Number.isFinite(s)) return "nog nooit iets gehoord";
  if (s < 15) return "zojuist";
  if (s < 90) return `${Math.round(s)} seconden geleden`;
  if (s < 5400) return `${Math.round(s / 60)} minuten geleden`;
  if (s < 172800) return `${Math.round(s / 3600)} uur geleden`;
  return `${Math.round(s / 86400)} dagen geleden`;
}

export async function koppelingscherm(inhoud, kruimel) {
  kruimel.innerHTML = `<span>Beheer</span> <span class="pijlje">&rsaquo;</span> <span>Brokerkoppeling</span>`;
  document.title = "Brokerkoppeling · Delta Wave Cockpit";
  inhoud.innerHTML = `<div class="kaart leeg">Bezig met ophalen&hellip;</div>`;

  let data;
  let flex = null;
  try {
    [data, flex] = await Promise.all([brugStand(), brugFlex().catch(() => null)]);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  const teken = () => {
    const live = Boolean(data.live);
    const nooit = data.laatste_bericht === null || data.laatste_bericht === undefined;

    // De kop zegt in één zin wat er aan de hand is. Geen vinkje zonder tekst:
    // wie hier komt kijken wil weten of hij iets moet doen.
    const kopHtml = `
      <div class="paneel">
        <div class="paneelkop">De verbinding met Lynx
          <span class="paneelmeta">via IB Gateway en de brug</span></div>
        <div class="verbindingvak">
          <span class="verbindinglamp ${live ? "live" : nooit ? "nooit" : "weg"}"></span>
          <div class="verbindingtekst">
            <b>${live ? "Live" : nooit ? "Nog nooit verbinding gehad" : "Geen verbinding"}</b>
            <span>${live
              ? `De brug meldde zich ${ontsnap(sinds(data.stil_seconden))}. Wat hieronder staat, is wat er nú open staat.`
              : nooit
                ? "De brug heeft zich nog niet gemeld. Staat hij aan, en staat de sleutel aan beide kanten gelijk?"
                : `Laatste bericht ${ontsnap(sinds(data.stil_seconden))}${
                    data.verbonden ? "" : " — en toen was de verbinding met IB Gateway al weg"
                  }. Wat hieronder staat kan achterhaald zijn.`}</span>
          </div>
          <div class="verbindingcijfers">
            <span><b>${ontsnap(data.rekening || "—")}</b> rekening</span>
            <span><b>${euro(data.kapitaal)}</b> nettowaarde</span>
            <span><b>${data.posities.length}</b> open ${data.posities.length === 1 ? "contract" : "contracten"}</span>
          </div>
        </div>
      </div>`;

    const positiesHtml = `
      <div class="paneel">
        <div class="paneelkop">Wat de brug ziet
          <span class="paneelmeta">rechtstreeks van de broker — de cockpit rekent hier niets bij</span></div>
        ${!data.posities.length
          ? `<p class="paneelleeg">Geen open contracten${live ? "." : ", voor zover het laatste bericht wist."}</p>`
          : `<table class="feittabel">
              <thead><tr><th>Contract</th><th class="rechts">Aantal</th><th class="rechts">Kostprijs</th>
                <th class="rechts">Markt</th><th class="rechts">Waarde</th><th>Bijgewerkt</th></tr></thead>
              <tbody>${data.posities.map((p) => `
                <tr><td class="feitnaam">${ontsnap(p.contract || p.conid)}</td>
                  <td class="rechts">${getal(p.aantal)}</td>
                  <td class="rechts">${p.gem_kostprijs === null ? "—" : getal(p.gem_kostprijs, 2)}</td>
                  <td class="rechts">${p.marktprijs === null ? "—" : getal(p.marktprijs, 2)}</td>
                  <td class="rechts">${p.waarde === null ? "—" : euro(p.waarde)}</td>
                  <td class="faint">${ontsnap(p.gewijzigd_op || "")}</td></tr>`).join("")}
              </tbody></table>`}
      </div>`;

    const spoorHtml = `
      <div class="paneel">
        <div class="paneelkop">Wat er gebeurde
          <span class="paneelmeta">het spoor van de broker — wordt nooit overschreven</span></div>
        ${!data.gebeurtenissen.length
          ? `<p class="paneelleeg">Nog niets gezien.</p>`
          : `<table class="feittabel">
              <thead><tr><th>Wanneer</th><th>Wat</th><th>Contract</th><th class="rechts">Aantal</th><th class="rechts">Prijs</th></tr></thead>
              <tbody>${data.gebeurtenissen.map((g) => `
                <tr><td class="faint">${ontsnap(g.moment || g.ontvangen_op || "")}</td>
                  <td>${g.soort === "uitvoering"
                        ? `<b>${ontsnap(g.richting || "uitvoering")}</b>`
                        : g.van === null || g.van === undefined
                          ? `nieuw — ${getal(g.naar)}`
                          : Number(g.naar) === 0
                            ? `gesloten — was ${getal(g.van)}`
                            : `van ${getal(g.van)} naar ${getal(g.naar)}`}</td>
                  <td class="feitnaam">${ontsnap(g.contract || g.conid || "")}</td>
                  <td class="rechts">${g.aantal === null ? "—" : getal(g.aantal)}</td>
                  <td class="rechts">${g.prijs === null ? "—" : getal(g.prijs, 2)}</td></tr>`).join("")}
              </tbody></table>`}
      </div>`;

    const r = flex && flex.rapport;
    const flexHtml = `
      <div class="paneel">
        <div class="paneelkop">Het vangnet
          <span class="paneelmeta">Flex-rapport — niet de bron waar de cockpit op werkt, wel de controle achteraf</span></div>
        <p class="paneelnoot">${r
          ? `Laatste rapport binnengekomen op ${ontsnap(r.opgehaald_op)}, met ${getal(r.regels)} regels.
             Het vult aan wat de brug gemist heeft als hij eruit lag, en corrigeert prijzen en commissies met
             wat er werkelijk afgerekend is.`
          : `Er is nog geen Flex-rapport aangeleverd. Zolang dat zo is, is de brug de enige bron — en wat er
             gebeurt terwijl hij eruit ligt, ziet niemand terug.`}</p>
      </div>`;

    const inst = data.instellingen || [];
    const instellingHtml = `
      <div class="paneel">
        <div class="paneelkop">Instellingen
          <span class="paneelmeta">de brug haalt ze op in het antwoord op zijn eigen zending — binnen één hartslag aangekomen</span></div>
        <div class="formsectie">
          <div class="formkolommen een">
            <div class="formkolom">
              ${inst.map((i) => `
                <label class="veldlabel" for="k_${i.sleutel}">${ontsnap(i.label)}</label>
                <div class="veldwaarde${i.uitleg ? " metnoot" : ""}">
                  ${i.soort === "ja_nee"
                    ? `<select id="k_${i.sleutel}" data-sleutel="${i.sleutel}">
                         <option value="1"${i.waarde === "1" ? " selected" : ""}>Ja</option>
                         <option value="0"${i.waarde !== "1" ? " selected" : ""}>Nee</option>
                       </select>`
                    : `<span class="metteken"><input id="k_${i.sleutel}" data-sleutel="${i.sleutel}"
                         type="number" min="1" value="${ontsnap(i.waarde)}"><span class="teken">seconden</span></span>`}
                  ${i.uitleg ? `<span class="veldnoot">${ontsnap(i.uitleg)}</span>` : ""}
                </div>`).join("")}
            </div>
          </div>
          <div class="knoprij">
            <button class="knop" id="kopslaan">Opslaan</button>
            <span class="paneelmeta" id="kmelding"></span>
          </div>
        </div>
        <p class="paneelnoot">Tokens, sleutels en wachtwoorden staan hier met opzet niet: die horen in Cloudflare
          en op de brugmachine. Een veld dat een geheim kan tonen, is een veld dat het ooit toont.</p>
      </div>`;

    inhoud.innerHTML = `
      <div class="recordbalk">
        <span class="recordnaam">Brokerkoppeling</span>
        <span class="recordmelding" id="kstatus"></span>
        <span class="recordacties">
          <button class="knop tweede" id="kvernieuw">Nu ophalen</button>
        </span>
      </div>
      ${kopHtml}${positiesHtml}${spoorHtml}${flexHtml}${instellingHtml}`;

    inhoud.querySelector("#kvernieuw").addEventListener("click", vernieuw);

    const melding = inhoud.querySelector("#kmelding");
    inhoud.querySelector("#kopslaan").addEventListener("click", async () => {
      const waarden = {};
      inhoud.querySelectorAll("[data-sleutel]").forEach((el) => { waarden[el.dataset.sleutel] = el.value; });
      melding.textContent = "Bezig met opslaan…";
      melding.className = "paneelmeta";
      try {
        data = await brugInstelling(waarden);
        teken();
        const m = inhoud.querySelector("#kmelding");
        m.textContent = "Bewaard. De brug pakt het op bij zijn volgende hartslag.";
      } catch (fout) {
        melding.textContent = fout.message;
        melding.className = "paneelmeta fouttekst";
      }
    });
  };

  async function vernieuw() {
    try {
      [data, flex] = await Promise.all([brugStand(), brugFlex().catch(() => flex)]);
      teken();
    } catch { /* een mislukte verversing mag het scherm niet leegmaken */ }
  }

  teken();

  // Het scherm ververst zichzelf: dit is de plek waar je komt kijken óf het
  // leeft, en dan moet het meebewegen in plaats van te bevriezen op het moment
  // dat je het opende.
  const klok = setInterval(() => {
    if (!document.body.contains(inhoud) || !location.hash.startsWith("#/koppeling")) {
      clearInterval(klok);
      return;
    }
    vernieuw();
  }, 5000);
}
