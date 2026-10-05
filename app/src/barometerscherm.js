// De barometer van één cyclus.
//
// Twee vragen, en ze staan bewust naast elkaar in plaats van in één meter:
//   - hoeveel aandacht vraagt deze cyclus van een lid?  (1 tot 5, 1 is rustig)
//   - stappen we in?                                     (open, wacht, dicht)
//
// Eén meter voor allebei zou moeten liegen zodra ze uit elkaar lopen: rustige
// markt, maar het kapitaal zit vast in de lopende cyclus.
//
// Het scherm toont ook wat de leden ervan weten. Dat is bijna altijd iets anders
// dan wat wij weten, en juist dat verschil is het werk.

import { haalBarometer, zetBarometer, record, lijst } from "./api.js";
import { ontsnap } from "./veld.js";

const KLEURKLASSE = { groen: "k-groen", oranje: "k-oranje", rood: "k-rood", grijs: "k-grijs" };

export async function barometerscherm(inhoud, kruimel, cyclusId) {
  inhoud.innerHTML = `<div class="baro">Bezig…</div>`;
  let keuze = null;   // wat je op dit scherm aan het kiezen bent

  async function teken() {
    let b, c;
    try {
      [b, c] = await Promise.all([
        haalBarometer(cyclusId),
        record("cyclus", cyclusId).then((r) => r.waarden || {}).catch(() => ({})),
      ]);
    } catch (fout) {
      inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
      return;
    }

    const label = c.label || `Cyclus ${cyclusId}`;
    document.title = `Barometer · ${label} · Delta Blueprint Cockpit`;
    kruimel.innerHTML = `<span>Werken</span> <span class="pijlje">&rsaquo;</span>
      <a href="#/berichten">Berichten</a> <span class="pijlje">&rsaquo;</span>
      <span>Barometer · ${ontsnap(label)}</span>`;

    // Wat je kiest begint bij wat er staat. Een scherm dat leeg opent dwingt je
    // alles opnieuw te zeggen om één ding te veranderen.
    if (!keuze) {
      keuze = b.wij
        ? { stand: String(b.wij.stand.waarde), venster: b.wij.venster.waarde }
        : { stand: "", venster: "" };
    }

    inhoud.innerHTML = `
      <div class="baro">
        ${nu(b)}

        <section class="barovak">
          <h2>Wat wij van een lid vragen</h2>
          <div class="baroschaal">
            ${b.schaal.map((s) => `
              <button type="button" class="barostand ${KLEURKLASSE[s.kleur] || "k-grijs"}
                      ${keuze.stand === String(s.waarde) ? "gekozen" : ""}"
                      data-stand="${ontsnap(s.waarde)}">
                <span class="baronr">${ontsnap(s.waarde)}</span>
                <span class="baronaam">${ontsnap(s.label)}</span>
              </button>`).join("")}
          </div>
        </section>

        <section class="barovak">
          <h2>Het venster</h2>
          <div class="barovensters">
            ${b.vensters.map((v) => `
              <button type="button" class="barovenster v-${ontsnap(v.waarde)}
                      ${keuze.venster === v.waarde ? "gekozen" : ""}"
                      data-venster="${ontsnap(v.waarde)}">${ontsnap(v.label)}</button>`).join("")}
          </div>
        </section>

        <section class="barovak">
          <h2>Waarom</h2>
          <textarea id="baroreden" rows="3"
            placeholder="Dit is wat de leden lezen. Zonder dit is het een getal zonder verhaal."></textarea>
          <div class="baroknoppen">
            <button type="button" class="knop" id="barovast" disabled>Stand vastleggen</button>
          </div>
          <p class="baromelding" hidden></p>
        </section>

        ${verloop(cyclusId)}
      </div>`;

    bind(b, keuze, cyclusId, async () => { keuze = null; await teken(); });
    await vulVerloop(cyclusId, b);
  }

  await teken();
}

// Wat wij weten en wat de leden weten, naast elkaar. Als ze gelijk zijn staat er
// één blok; lopen ze uiteen, dan twee — want dan is dat het nieuws.
function nu(b) {
  if (!b.wij) {
    return `<div class="baronu leeg">Er is nog geen stand vastgesteld voor deze cyclus.</div>`;
  }
  const blok = (titel, s, extra = "") => `
    <div class="baronublok">
      <span class="baronulabel">${titel}</span>
      <span class="baronustand ${KLEURKLASSE[s.stand.kleur] || "k-grijs"}">
        ${ontsnap(s.stand.waarde)} · ${ontsnap(s.stand.label)}</span>
      <span class="baronuvenster v-${ontsnap(s.venster.waarde)}">${ontsnap(s.venster.label)}</span>
      ${extra}
    </div>`;

  if (b.gelijk) return `<div class="baronu">${blok("Nu", b.wij, `<span class="barogemeld">gemeld</span>`)}</div>`;

  return `
    <div class="baronu uiteen">
      ${blok("Wat wij weten", b.wij, `<span class="baroniet">nog niet gemeld</span>`)}
      ${b.leden
        ? blok("Wat de leden zien", b.leden)
        : `<div class="baronublok">
             <span class="baronulabel">Wat de leden zien</span>
             <span class="baronustand k-grijs">nog niets</span>
           </div>`}
    </div>`;
}

function verloop() {
  return `
    <section class="barovak">
      <h2>Het verloop</h2>
      <ol class="baroverloop" id="baroverloop"><li class="baroleeg">Bezig…</li></ol>
    </section>`;
}

// Het verloop komt uit de gewone lijst. Een eigen route erbij zou hetzelfde
// doen met een tweede stuk code dat achter kan gaan lopen.
async function vulVerloop(cyclusId, b) {
  const vak = document.getElementById("baroverloop");
  if (!vak) return;
  let rijen = [];
  try {
    const uit = await lijst("barometerstand", { "fid.cyclus": cyclusId, sorteer: "vastgesteld_op", richting: "desc", limiet: 25 });
    rijen = uit.rijen || [];
  } catch {
    vak.innerHTML = `<li class="baroleeg">Het verloop is nu niet op te halen.</li>`;
    return;
  }
  if (!rijen.length) {
    vak.innerHTML = `<li class="baroleeg">Nog geen standen vastgelegd.</li>`;
    return;
  }

  const naam = (w) => {
    const k = b.schaal.find((s) => String(s.waarde) === String(w));
    return k ? k.label : String(w);
  };
  const venster = (w) => {
    const k = b.vensters.find((v) => v.waarde === w);
    return k ? k.label : String(w);
  };

  vak.innerHTML = rijen.map((r) => `
    <li class="baroregel ${r.gepubliceerd_op ? "gemeld" : ""}">
      <span class="barorstand">${ontsnap(r.stand)} · ${ontsnap(naam(r.stand))}</span>
      <span class="barorvenster v-${ontsnap(r.venster)}">${ontsnap(venster(r.venster))}</span>
      <span class="barorreden">${ontsnap(r.reden || "")}</span>
      <span class="barortijd">${ontsnap(String(r.vastgesteld_op || "").slice(0, 16))}</span>
      <span class="barorgemeld">${r.gepubliceerd_op ? "gemeld" : "—"}</span>
    </li>`).join("");
}

// ------------------------------------------------------------- de handeling
function bind(b, keuze, cyclusId, opnieuw) {
  const knop = document.getElementById("barovast");
  const reden = document.getElementById("baroreden");
  const melding = document.querySelector(".baromelding");
  let bezig = false;

  // De knop gaat pas aan als er echt iets te leggen valt: een stand, een
  // venster, een reden, en samen iets anders dan wat er al staat. Een knop die
  // aanklikbaar is en dan 'de barometer staat al zo' zegt, had dat eerder
  // kunnen weten.
  const kijk = () => {
    const vol = keuze.stand && keuze.venster && String(reden.value || "").trim();
    const anders = !b.wij
      || String(b.wij.stand.waarde) !== String(keuze.stand)
      || b.wij.venster.waarde !== keuze.venster;
    knop.disabled = bezig || !vol || !anders;
    knop.textContent = !anders && keuze.stand ? "Dit is de huidige stand" : "Stand vastleggen";
  };

  document.querySelectorAll(".barostand").forEach((el) => {
    el.addEventListener("click", () => {
      keuze.stand = el.dataset.stand;
      document.querySelectorAll(".barostand").forEach((x) => x.classList.toggle("gekozen", x === el));
      kijk();
    });
  });

  document.querySelectorAll(".barovenster").forEach((el) => {
    el.addEventListener("click", () => {
      keuze.venster = el.dataset.venster;
      document.querySelectorAll(".barovenster").forEach((x) => x.classList.toggle("gekozen", x === el));
      kijk();
    });
  });

  reden.addEventListener("input", kijk);
  kijk();

  knop.addEventListener("click", async () => {
    if (bezig) return;
    bezig = true;
    kijk();
    try {
      await zetBarometer(cyclusId, {
        stand: Number(keuze.stand), venster: keuze.venster, reden: reden.value.trim(),
      });
      // Vastleggen is niet melden. De leden weten het pas als er een bericht
      // over uit is, en dat is een eigen handeling — vandaar de verwijzing in
      // plaats van een tweede knop die het stilletjes ook doet.
      melding.className = "baromelding goed";
      melding.textContent = "Vastgelegd. De leden weten het nog niet: daar hoort een bericht bij.";
      melding.hidden = false;
      await opnieuw();
    } catch (fout) {
      melding.className = "baromelding";
      melding.textContent = fout.message;
      melding.hidden = false;
      bezig = false;
      kijk();
    }
  });
}
