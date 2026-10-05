// Het einde van een tranche.
//
// Doorrollen, vervroegd terugkopen en een stoploss die raakt zijn
// tijdsgevoelig: wie daarvoor eerst een overleg moet beleggen is het moment
// kwijt. De handeling gebeurt dus bij Lynx, en dit scherm doet het andere deel
// — lezen wat er gebeurd is en vragen om duiding (BOUWSPEC 6).
//
// Het systeem stelt voor en zet erbij wát het gezien heeft. Het legt niets
// vast: dat doe jij, per tranche, en je kunt het voorstel wijzigen. Rolt een
// tranche door, dan ontstaat bij het vastleggen de volgende tranche van
// dezelfde cyclus — dat is de enige plek waar dit scherm iets aanmaakt.

import { afloopVoorstellen, afloopVastleggen, neemPositieOver } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";

const UITKOMSTEN = [
  ["waardeloos geexpireerd", "Waardeloos geëxpireerd"],
  ["doorgerold", "Doorgerold"],
  ["vervroegd teruggekocht", "Vervroegd teruggekocht"],
  ["exitplan uitgevoerd", "Exitplan uitgevoerd"],
];

const punten = (n) => {
  const w = Number(n);
  if (!Number.isFinite(w)) return "—";
  const kleur = w > 0 ? "var(--grn)" : w < 0 ? "var(--red)" : "var(--ink2)";
  return `<span style="color:${kleur};font-weight:600">${w > 0 ? "+" : w < 0 ? "−" : ""} ${
    Math.abs(w).toFixed(1).replace(".", ",")} pt</span>`;
};

const prijs = (n) =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(2).replace(".", ",")} pt` : "—";

// Wat het systeem zag, in gewone zinnen. Een voorstel zonder bewijs is een
// mening; met bewijs is het een waarneming waar jij iets van kunt vinden.
function bewijsHtml(r) {
  const regels = [];
  if (r.bewijs && r.bewijs.open_bij_lynx === true) {
    regels.push("Staat open bij Lynx.");
  }
  if (r.bewijs && r.bewijs.open_bij_lynx === false) {
    regels.push("Staat niet meer open bij Lynx.");
  }
  if (r.sluiting) {
    regels.push(`Teruggekocht op ${toonDatum(r.sluiting.datum)} tegen ${prijs(r.sluiting.prijs_pt)}.`);
  }
  if (r.opvolger) {
    regels.push(`Dezelfde dag geschreven: ${ontsnap(r.opvolger.contract)} tegen ${prijs(r.opvolger.prijs_pt)}.`);
  }
  if (!regels.length) regels.push("Geen transacties in het rapport.");
  return regels.map((z) => `<li>${z}</li>`).join("");
}

function regelHtml(r) {
  const voorstel = r.voorstel || "";
  return `
    <div class="afloopregel" data-id="${r.tranche}">
      <div class="afloopkop">
        <span class="afloopnaam">${ontsnap(r.cyclusnaam || "")} &middot; tranche ${r.nummer ?? "?"}</span>
        <span class="afloopcontract">${ontsnap(r.contract || `${r.strike} / ${r.expiratiedatum}`)}</span>
        <span class="afloopaantal">${r.aantal ?? "?"} ×</span>
      </div>
      <div class="afloopinhoud">
        <div class="afloopbewijs">
          <div class="afloopkopje">Wat het rapport laat zien</div>
          <ul>${bewijsHtml(r)}</ul>
          ${r.waarom ? `<p class="afloopwaarom">${ontsnap(r.waarom)}</p>` : ""}
        </div>
        <div class="afloopvorm">
          <label class="veldlabel">Wat het werd</label>
          <div class="veldwaarde">
            <select data-veld="uitkomst">
              <option value="">&mdash;</option>
              ${UITKOMSTEN.map(([w, l]) =>
                `<option value="${w}"${w === voorstel ? " selected" : ""}>${l}</option>`).join("")}
            </select>
          </div>

          <label class="veldlabel">Op</label>
          <div class="veldwaarde">
            <input type="date" data-veld="sluittijdstip"
              value="${ontsnap((r.sluiting && r.sluiting.datum) || r.expiratiedatum || "")}">
          </div>

          <label class="veldlabel">Resultaat</label>
          <div class="veldwaarde">
            <input type="number" step="0.1" data-veld="resultaat_pt"
              value="${r.resultaat_pt ?? ""}"><span class="teken">pt</span>
          </div>

          <label class="veldlabel" data-rol hidden>In de plaats kwam</label>
          <div class="veldwaarde" data-rol hidden>
            <select data-veld="opvolger"><option value="">&mdash; nog niet gekozen &mdash;</option></select>
          </div>

          <label class="veldlabel">Toelichting</label>
          <div class="veldwaarde"><input type="text" data-veld="reden_exit" placeholder="optioneel"></div>

          <div class="afloopknoppen">
            <span class="afloopmelding"></span>
            <button class="knop" data-leg-vast>Vastleggen</button>
          </div>
        </div>
      </div>
    </div>`;
}

// Een contract dat bij Lynx openstaat en dat de cockpit niet kent. Het feit —
// premie, strike, expiratie, aantal — staat vast; alleen het verband niet. Dus
// vraagt het scherm precies dat ene ding, en verder niets.
function nieuwHtml(p, cycli) {
  const herkomst = p.mogelijk_vervolg_op || [];
  return `
    <div class="afloopregel" data-conid="${ontsnap(String(p.conid || ""))}">
      <div class="afloopkop">
        <span class="afloopnaam">Nieuw bij Lynx</span>
        <span class="afloopcontract">${ontsnap(p.contract || `${p.strike} / ${p.expiratiedatum}`)}</span>
        <span class="afloopaantal">${p.aantal ?? "?"} × &middot; ${prijs(p.premie_pt)}</span>
      </div>
      <div class="afloopinhoud">
        <div class="afloopbewijs">
          <div class="afloopkopje">Wat het rapport laat zien</div>
          <ul>
            <li>Dit contract staat open bij Lynx en hoort bij geen enkele tranche.</li>
            <li>${p.premie_pt === null || p.premie_pt === undefined
                  ? "De prijs waartegen het geschreven werd staat er niet bij — publiceren kan pas als die er is."
                  : `Geschreven tegen ${prijs(p.premie_pt)}${p.datum ? ` op ${toonDatum(p.datum)}` : ""}.`}</li>
          </ul>
          <p class="afloopwaarom">Het systeem weet wát er open staat, maar niet waar het bij hoort.</p>
        </div>
        <div class="afloopvorm">
          <label class="veldlabel">Hoort bij</label>
          <div class="veldwaarde">
            <select data-veld="vervolg">
              <option value="">een nieuwe tranche op zichzelf</option>
              ${herkomst.map((k) => `<option value="${k.id}">het vervolg van ${
                ontsnap(k.cyclusnaam)} &middot; tranche ${k.tranche}</option>`).join("")}
            </select>
          </div>

          <label class="veldlabel">In cyclus</label>
          <div class="veldwaarde">
            <select data-veld="cyclus">
              ${(cycli || []).map((c) => `<option value="${c.id}">${ontsnap(c.label)}</option>`).join("")}
            </select>
          </div>

          <div class="afloopknoppen">
            <span class="afloopmelding"></span>
            <button class="knop" data-neem-over>Overnemen</button>
          </div>
        </div>
      </div>
    </div>`;
}

// Kies je zelf 'Doorgerold', dan moet het systeem weten wélk contract ervoor in
// de plaats kwam. Zag het die zelf al, dan staat hij er; zo niet, dan kies je
// hem uit wat er nú bij Lynx openstaat en de cockpit nog niet kent.
function vulOpvolgers(vak, regel, nieuw) {
  const keuze = vak.querySelector('[data-veld="opvolger"]');
  if (!keuze) return;
  const opties = [];
  if (regel && regel.opvolger) opties.push(regel.opvolger);
  for (const p of nieuw || []) {
    if (!opties.some((o) => String(o.conid) === String(p.conid))) opties.push(p);
  }
  keuze.innerHTML = `<option value="">&mdash; kies het nieuwe contract &mdash;</option>` +
    opties.map((o) => `<option value="${ontsnap(String(o.conid))}">${
      ontsnap(o.contract || `${o.strike} / ${o.expiratiedatum}`)}</option>`).join("");
  if (regel && regel.opvolger) keuze.value = String(regel.opvolger.conid);
  keuze.dataset.opties = JSON.stringify(opties);
}

// Wat je in dat rolmenu koos, als contract.
function gekozenOpvolger(vak) {
  const keuze = vak.querySelector('[data-veld="opvolger"]');
  if (!keuze || !keuze.value) return null;
  const opties = JSON.parse(keuze.dataset.opties || "[]");
  const o = opties.find((x) => String(x.conid) === keuze.value);
  if (!o) return null;
  return {
    contract: o.contract, strike: o.strike, expiratiedatum: o.expiratiedatum,
    aantal: o.aantal, premie_pt: o.prijs_pt ?? o.premie_pt ?? null,
    conid: o.conid, datum: o.datum,
  };
}

export async function afloopscherm(inhoud, kruimel) {
  kruimel.innerHTML = `<span>Vastlegging</span> <span class="pijlje">&rsaquo;</span> <span>Einde van een tranche</span>`;
  document.title = "Einde van een tranche · Delta Blueprint Cockpit";
  inhoud.innerHTML = "";

  let data;
  try {
    data = await afloopVoorstellen();
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  if (!data.koppeling) {
    inhoud.innerHTML = `<div class="paneel"><div class="paneelkop">Einde van een tranche</div>
      <p class="paneelleeg">${ontsnap(data.reden || "Er is geen rapport van Lynx.")}</p></div>`;
    return;
  }

  // Een tranche waar niets mee gebeurd is, hoort hier niet te staan te wachten
  // op een handeling. Hij staat er wel, onderaan, zodat je ziet dat het systeem
  // hem gezien heeft en niets verzwijgt.
  const teDuiden = data.regels.filter((r) => r.gewijzigd);
  const lopend = data.regels.filter((r) => !r.gewijzigd);

  inhoud.innerHTML = `
    <div class="paneel">
      <div class="paneelkop">Einde van een tranche
        <span class="paneelmeta">${teDuiden.length} ${teDuiden.length === 1 ? "tranche vraagt" : "tranches vragen"} om duiding
          &middot; ${data.bron === "brug"
            ? `live van de brug, ${ontsnap(data.opgehaald_op || "")}`
            : `uit het Flex-rapport van ${ontsnap(data.opgehaald_op || "onbekend")}`}</span></div>
      ${teDuiden.length
        ? `<div class="afloopregels">${teDuiden.map(regelHtml).join("")}</div>`
        : `<p class="paneelleeg">Er is niets veranderd aan je lopende tranches.</p>`}
    </div>
    ${(data.nieuw || []).length ? `
    <div class="paneel">
      <div class="paneelkop">Nieuw bij Lynx
        <span class="paneelmeta">${data.nieuw.length} ${
          data.nieuw.length === 1 ? "contract staat" : "contracten staan"} open zonder dat de cockpit ze kent</span></div>
      <div class="afloopregels">${data.nieuw.map((p) => nieuwHtml(p, data.cycli)).join("")}</div>
    </div>` : ""}
    ${lopend.length ? `
    <div class="paneel">
      <div class="paneelkop">Loopt gewoon door
        <span class="paneelmeta">${lopend.length} ${lopend.length === 1 ? "tranche" : "tranches"}</span></div>
      <table class="lijsttabel">
        <thead><tr><th>Cyclus</th><th>Tranche</th><th>Contract</th><th class="rechts">Aantal</th><th>Expiratie</th></tr></thead>
        <tbody>${lopend.map((r) => `
          <tr><td>${ontsnap(r.cyclusnaam || "")}</td><td>${r.nummer ?? ""}</td>
              <td>${ontsnap(r.contract || "")}</td><td class="rechts">${r.aantal ?? ""}</td>
              <td>${toonDatum(r.expiratiedatum)}</td></tr>`).join("")}</tbody>
      </table>
    </div>` : ""}`;

  // Overnemen wat de cockpit niet kent: het feit vastleggen, en het verband
  // dat jij eraan geeft.
  for (const vak of inhoud.querySelectorAll(".afloopregel[data-conid]")) {
    const p = (data.nieuw || []).find((x) => String(x.conid) === vak.dataset.conid);
    const melding = vak.querySelector(".afloopmelding");
    const knop = vak.querySelector("[data-neem-over]");
    const vervolgVeld = vak.querySelector('[data-veld="vervolg"]');
    const cyclusVeld = vak.querySelector('[data-veld="cyclus"]');

    // Kies je een voorganger, dan ligt de cyclus daarmee vast.
    vervolgVeld.addEventListener("change", () => {
      const k = (p.mogelijk_vervolg_op || []).find((x) => String(x.id) === vervolgVeld.value);
      if (k) cyclusVeld.value = String(k.cyclus);
      cyclusVeld.disabled = Boolean(k);
    });

    knop.addEventListener("click", async () => {
      const k = (p.mogelijk_vervolg_op || []).find((x) => String(x.id) === vervolgVeld.value);
      knop.disabled = true;
      melding.textContent = "Bezig met overnemen…";
      melding.className = "afloopmelding";
      try {
        const uit = await neemPositieOver({
          cyclus: k ? k.cyclus : Number(cyclusVeld.value),
          vervolg_op: k ? k.id : null,
          sluittijdstip: k && k.sluiting ? k.sluiting.datum : null,
          resultaat_pt: k && k.sluiting && Number.isFinite(Number(k.ontvangen_premie_pt))
            ? Math.round((Number(k.ontvangen_premie_pt) - Number(k.sluiting.prijs_pt)) * 10) / 10
            : null,
          teruggekocht_pt: k && k.sluiting ? k.sluiting.prijs_pt : null,
          positie: {
            contract: p.contract, strike: p.strike, expiratiedatum: p.expiratiedatum,
            aantal: p.aantal, premie_pt: p.premie_pt, conid: p.conid, datum: p.datum,
          },
        });
        vak.classList.add("afgerond");
        vak.querySelector(".afloopvorm").innerHTML = `
          <p class="afloopklaar">Overgenomen als tranche.
            <a href="#/t/positie/${uit.tranche}">Naar de tranche</a></p>`;
      } catch (fout) {
        knop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "afloopmelding fouttekst";
      }
    });
  }

  for (const vak of inhoud.querySelectorAll(".afloopregel[data-id]")) {
    const id = Number(vak.dataset.id);
    const regel = data.regels.find((r) => r.tranche === id);
    const melding = vak.querySelector(".afloopmelding");
    const knop = vak.querySelector("[data-leg-vast]");
    const lees = (naam) => {
      const el = vak.querySelector(`[data-veld="${naam}"]`);
      return el && el.value !== "" ? el.value : null;
    };

    // Het veld voor de opvolger verschijnt alleen bij een rol.
    const keuzeVeld = vak.querySelector('[data-veld="uitkomst"]');
    vulOpvolgers(vak, regel, data.nieuw);
    const toonRol = () => vak.querySelectorAll("[data-rol]").forEach((el) => {
      el.hidden = keuzeVeld.value !== "doorgerold";
    });
    keuzeVeld.addEventListener("change", toonRol);
    toonRol();

    knop.addEventListener("click", async () => {
      const uitkomst = lees("uitkomst");
      if (!uitkomst) {
        melding.textContent = "Kies wat er met deze tranche gebeurd is.";
        melding.className = "afloopmelding fouttekst";
        return;
      }
      knop.disabled = true;
      melding.textContent = "Bezig met vastleggen…";
      melding.className = "afloopmelding";
      try {
        const uit = await afloopVastleggen(id, {
          uitkomst,
          sluittijdstip: lees("sluittijdstip"),
          resultaat_pt: lees("resultaat_pt"),
          teruggekocht_pt: regel ? regel.teruggekocht_pt : null,
          reden_exit: lees("reden_exit"),
          // Bij een rol gaat het contract mee dat het systeem in het rapport
          // vond. Vond het er geen, dan weigert de server — en terecht: een rol
          // zonder opvolger laat de keten in de post-analyse afbreken.
          opvolger: uitkomst === "doorgerold" ? gekozenOpvolger(vak) : null,
        });
        vak.classList.add("afgerond");
        vak.querySelector(".afloopvorm").innerHTML = `
          <p class="afloopklaar">Vastgelegd als <b>${ontsnap(uitkomst)}</b>${
            uit.opvolger ? ` &middot; tranche ${uit.opvolger ? "aangemaakt" : ""}` : ""}.
          <a href="#/t/cyclus/${uit.cyclus}">Naar de cyclus</a></p>`;
      } catch (fout) {
        knop.disabled = false;
        melding.textContent = fout.message;
        melding.className = "afloopmelding fouttekst";
      }
    });
  }
}
