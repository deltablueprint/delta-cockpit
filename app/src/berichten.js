// Wat er klaarstaat om naar de leden te gaan.
//
// Een positie die opent of sluit levert een concept op met de feiten er al in.
// Wat ontbreekt is het enige deel dat je leden werkelijk lezen: wat jullie
// gedaan hebben en waarom. Dat schrijf je hier, en pas als je verstuurt gaat de
// positie door naar 'bewaken'.
//
// Versturen is onomkeerbaar. Daarom is het een aparte knop die om bevestiging
// vraagt, en niet iets wat gebeurt omdat een veld gevuld raakt.

import { conceptberichten, verstuurBericht, bewaar } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";

const punten = (n) =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(1).replace(".", ",")} pt` : "—";

function feitenHtml(b) {
  const regels = [
    ["Contract", ontsnap(b.contract || "—")],
    ["Aantal", b.aantal ?? "—"],
    ["Geschreven op", punten(b.premie_pt)],
  ];
  if (b.soort === "sluiting") regels.push(["Resultaat", punten(b.resultaat_pt)]);
  if (b.cyclusnaam) regels.push(["Cyclus", ontsnap(b.cyclusnaam)]);
  return regels.map(([k, v]) => `<div class="feitrij"><span>${k}</span><b>${v}</b></div>`).join("");
}

export async function berichtenscherm(inhoud, kruimel) {
  kruimel.innerHTML = `<span>Vastlegging</span> <span class="pijlje">&rsaquo;</span> <span>Klaar voor de leden</span>`;
  document.title = "Klaar voor de leden · Delta Wave Cockpit";
  inhoud.innerHTML = "";

  let data;
  try {
    data = await conceptberichten();
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
    return;
  }

  if (!data.berichten.length) {
    inhoud.innerHTML = `<div class="paneel">
      <div class="paneelkop">Klaar voor de leden</div>
      <p class="paneelleeg">Er staat niets te wachten. Zodra er een positie opent of sluit,
        komt hier een concept klaar te staan.</p></div>`;
    return;
  }

  inhoud.innerHTML = `
    <div class="paneel">
      <div class="paneelkop">Klaar voor de leden
        <span class="paneelmeta">${data.berichten.length} ${
          data.berichten.length === 1 ? "bericht wacht" : "berichten wachten"} op een tekst</span></div>
      <div class="berichtrijen">
        ${data.berichten.map((b) => `
          <div class="berichtkaart" data-id="${b.id}">
            <div class="berichtkop">
              <span class="berichtsoort ${b.soort}">${
                b.soort === "opening" ? "Nieuwe positie" : "Positie gesloten"}</span>
              <span class="berichtnaam">${ontsnap(b.contract || "—")}</span>
              <a class="berichtlink" href="#/t/positie/${b.positie}">naar de positie</a>
            </div>
            <div class="berichtinhoud">
              <div class="berichtfeiten">${feitenHtml(b)}</div>
              <div class="berichttekst">
                <label class="veldlabel">Wat we deden en waarom</label>
                <textarea data-veld="tekst" placeholder="Het enige deel dat je leden echt lezen."
                  >${ontsnap(b.tekst || "")}</textarea>
                <div class="berichtknoppen">
                  <span class="berichtmelding"></span>
                  <button class="knop tweede" data-bewaar>Bewaren</button>
                  <button class="knop" data-verstuur>Versturen</button>
                </div>
              </div>
            </div>
          </div>`).join("")}
      </div>
    </div>`;

  for (const kaart of inhoud.querySelectorAll(".berichtkaart")) {
    const id = Number(kaart.dataset.id);
    const tekst = kaart.querySelector('[data-veld="tekst"]');
    const melding = kaart.querySelector(".berichtmelding");
    const bewaarknop = kaart.querySelector("[data-bewaar]");
    const stuurknop = kaart.querySelector("[data-verstuur]");

    const zeg = (w, soort = "") => {
      melding.textContent = w;
      melding.className = `berichtmelding ${soort}`;
    };

    bewaarknop.addEventListener("click", async () => {
      bewaarknop.disabled = true;
      zeg("Bezig met bewaren…");
      try {
        await bewaar("publicatie", id, { tekst: tekst.value }, null);
        zeg("Bewaard");
      } catch (fout) {
        zeg(fout.message, "fouttekst");
      } finally {
        bewaarknop.disabled = false;
      }
    });

    stuurknop.addEventListener("click", async () => {
      if (!tekst.value.trim()) {
        zeg("Schrijf eerst wat jullie gedaan hebben en waarom.", "fouttekst");
        tekst.focus();
        return;
      }
      // Versturen gaat niet terug. Dat hoort één vraag waard te zijn.
      if (stuurknop.dataset.zeker !== "ja") {
        stuurknop.dataset.zeker = "ja";
        stuurknop.textContent = "Zeker weten?";
        zeg("Dit gaat naar je leden en is niet terug te nemen.");
        return;
      }
      stuurknop.disabled = true;
      zeg("Bezig met versturen…");
      try {
        await bewaar("publicatie", id, { tekst: tekst.value }, null);
        await verstuurBericht(id);
        kaart.classList.add("verstuurd");
        kaart.querySelector(".berichtinhoud").innerHTML =
          `<p class="berichtklaar">Verstuurd. De positie staat nu op <b>bewaken</b>.</p>`;
      } catch (fout) {
        stuurknop.disabled = false;
        stuurknop.dataset.zeker = "";
        stuurknop.textContent = "Versturen";
        zeg(fout.message, "fouttekst");
      }
    });
  }
}
