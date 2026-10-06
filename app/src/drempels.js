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

// Twee voorbeelden, en met opzet ver uit elkaar. Eén premie laat niet zien wat
// hier het verschil maakt: een grens in punten staat voor élke tranche op
// hetzelfde niveau, een grens in procenten schuift mee. Naast elkaar zie je in
// één blik of je schaal ook klopt voor een put die veel minder opbrengt.
const VOORBEELDEN = [
  { premie: 38.5, naam: "dure put" },
  { premie: 15.0, naam: "goedkope put" },
];

export async function drempelscherm(inhoud, kruimel) {
  document.title = "Barometer instellingen · Delta Wave Cockpit";
  kruimel.innerHTML = `<span>Beheer</span> <span class="pijlje">&rsaquo;</span> <span>Barometer instellingen</span>`;
  inhoud.innerHTML = `<div class="drempels"><p class="wbleeg">Bezig met ophalen&hellip;</p></div>`;

  let data = await haalDrempels();
  let melding = "";

  const askVan = (d, premie) => (d.grens_eenheid === "punten" ? Number(d.grens_waarde)
                                                             : premie * Number(d.grens_waarde) / 100);
  // Hoeveel keer de premie die ask is. Dat getal zegt wat de grens wérkelijk
  // betekent: 'ask 60' bij een premie van 15 is vier keer je premie, en dat is
  // geen stoploss meer.
  const keer = (d, premie) => askVan(d, premie) / premie;

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
        ${VOORBEELDEN.map((v) => `<span class="dvoorbeeld">= ask ${getal(askVan(d, v.premie))}<i>${
          getal(keer(d, v.premie))}× de premie</i></span>`).join("")}
        ${vast ? `<span class="dvastlabel">break-even</span>` : ""}
      </div>`;
    }).join("");

    // De schaal als balk, met het voorbeeld eronder: zo zie je meteen of de
    // vakken nog aflopen van verlies naar winst.
    // De schaal moet voor béide voorbeelden aflopen van verlies naar winst.
    // Klopt hij voor de ene premie en niet voor de andere, dan is dat precies
    // het geval dat je wil zien voordat er een bericht uitgaat.
    const scheef = VOORBEELDEN.filter((v) => {
      const g = data.drempels.map((d) => askVan(d, v.premie));
      return !g.every((x, i) => i === 0 || g[i - 1] > x);
    });
    const klopt = scheef.length === 0;

    inhoud.innerHTML = `<div class="drempels">
      <div class="titelrij"><h1>Barometer instellingen</h1></div>
      <section class="paneel">
        <div class="paneelkop">De vijf standen</div>
        <div class="paneelbody">
          <div class="drijen">${rijen}</div>
          <p class="dvoet">De twee kolommen rechts zijn voorbeelden: een tranche met een ontvangen premie van
            ${getal(VOORBEELDEN[0].premie)} punten en een van ${getal(VOORBEELDEN[1].premie)} punten.
            Elke tranche rekent met haar eigen premie. Een grens in punten staat voor allebei op hetzelfde
            niveau; een grens in procenten schuift mee. Een tranche met een eigen stoploss gebruikt die in
            plaats van stand 1.</p>
          ${klopt ? "" : `<p class="wbnoot wblet">Bij een premie van ${
            scheef.map((v) => getal(v.premie)).join(" en ")} punten loopt deze schaal niet af van verlies
            naar winst: dan ligt een stand onder een stand die lager hoort te staan.</p>`}
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
