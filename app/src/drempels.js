// Barometer instellingen: de vijf standen onder elkaar met hun grens.
//
// Waarom dit een eigen scherm is en geen rij in een tabel: drie getallen in een
// lijst met sleutels vertellen niet wat ze doen. Hier zie je de schaal zoals de
// leden hem straks zien — vijf standen, van onder druk tot veilig — en wat de
// ask moet doen om van de ene in de andere te komen.
import { haalDrempels, zetDrempels } from "./api.js";

const ontsnap = (t) =>
  String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const KLEUR = ["#D7261E", "#F26A21", "#FBC02D", "#8DC63F", "#0A9D4E"];
const getal = (n) => Number(n).toFixed(1).replace(".", ",").replace(/,0$/, "");

export async function drempelscherm(inhoud, kruimel) {
  document.title = "Barometer instellingen · Delta Wave Cockpit";
  kruimel.innerHTML = `<span>Beheer</span> <span class="pijlje">&rsaquo;</span> <span>Barometer instellingen</span>`;
  inhoud.innerHTML = `<div class="drempels"><p class="wbleeg">Bezig met ophalen&hellip;</p></div>`;

  let data = await haalDrempels();
  let melding = "";


  function teken() {
    const rijen = data.drempels.map((d, i) => {
      const vast = Number(d.vast) === 1;
      return `<div class="drij${vast ? " vast" : ""}" data-stand="${d.stand}">
        <span class="dkleur" style="background:${KLEUR[d.stand - 1]}"></span>
        <span class="dnaam">${ontsnap(d.label || `Stand ${d.stand}`)}</span>
        <span class="dzin">zodra de ask onder</span>
        <input class="dgetal" type="text" inputmode="decimal" data-waarde="${d.stand}"
               value="${getal(d.grens_waarde)}"${vast ? " disabled" : ""}>
        <select class="deenheid" data-eenheid="${d.stand}"${vast ? " disabled" : ""}>
          <option value="punten"${d.grens_eenheid === "punten" ? " selected" : ""}>punten</option>
          <option value="pct_premie"${d.grens_eenheid === "pct_premie" ? " selected" : ""}>% van de premie</option>
        </select>
        <span class="dkomt">komt</span>
        <span class="dvastlabel">${vast ? "break-even" : ""}</span>
      </div>`;
    }).join("");

    // De schaal als balk, met het voorbeeld eronder: zo zie je meteen of de
    // vakken nog aflopen van verlies naar winst.

    inhoud.innerHTML = `<div class="drempels">
      <div class="titelrij"><h1>Barometer instellingen</h1></div>
      <section class="paneel">
        <div class="paneelkop">De vijf standen</div>
        <div class="paneelbody">
          <div class="drijen">${rijen}</div>
          <p class="dvoet">Elke tranche rekent met haar eigen premie: een grens in punten staat voor elke
            tranche op hetzelfde niveau, een grens in procenten schuift mee met wat je ontving. Een tranche
            met een eigen stoploss gebruikt die in plaats van stand 1.</p>
        </div>
        <div class="publiceerbalk open">
          <div class="pubrij">
            <span class="pubtekst">${melding ? ontsnap(melding) : "Wat je hier zet, bepaalt de stand die de leden te zien krijgen."}</span>
            <button class="knop" id="dbewaar">Bewaren</button>
          </div>
        </div>
      </section>
    </div>`;

    for (const el of inhoud.querySelectorAll(".dgetal, .deenheid")) {
      el.addEventListener("change", () => {
        const stand = Number(el.dataset.waarde || el.dataset.eenheid);
        const d = data.drempels.find((x) => Number(x.stand) === stand);
        if (!d) return;
        if (el.dataset.waarde) d.grens_waarde = String(el.value).replace(",", ".");
        else d.grens_eenheid = el.value;
        melding = "";
        teken();
      });
    }

    const knop = inhoud.querySelector("#dbewaar");
    knop.addEventListener("click", async () => {
      knop.disabled = true;
      try {
        data = await zetDrempels(data.drempels.map((d) => ({
          stand: d.stand, waarde: d.grens_waarde, eenheid: d.grens_eenheid,
        })));
        melding = "Bewaard. De balken en de barometer rekenen hier vanaf nu mee.";
      } catch (fout) {
        melding = fout.message;
      }
      teken();
    });
  }

  teken();
}
