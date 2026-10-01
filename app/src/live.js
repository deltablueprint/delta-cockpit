// Live waarden.
//
// Regel: alleen velden die in de definitielaag als live gemarkeerd staan
// worden ververst, en alleen díé waarden worden op het scherm bijgewerkt.
// Het scherm zelf wordt nooit opnieuw opgebouwd — je mag er niets van merken.
//
// Staat er geen enkel live veld op het scherm, dan loopt er ook geen timer.
// In fase 1 is dat overal het geval; er beweegt dus niets.

const SNEL = 5000;    // in een lopende cyclus
const TRAAG = 60000;  // daarbuiten

let timer = null;
let haalWaarden = null;
let laatste = null;

export const HARTSLAG =
  `<svg class="hartje" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 12h4l2-5 4 10 2-5h8"/></svg>`;

function toonTijd() {
  const tekst = document.getElementById("hartslagtekst");
  const bol = document.getElementById("hartslag");
  if (!tekst || !bol) return;
  if (!haalWaarden) {
    bol.className = "hartslag stil";
    tekst.textContent = "";
    return;
  }
  bol.className = "hartslag bijgewerkt";
  tekst.textContent = laatste ? `Bijgewerkt ${laatste.toTimeString().slice(0, 8)}` : "";
}

// Alleen de elementen met data-live worden aangeraakt; de rest van het scherm
// blijft staan zoals hij staat.
async function tik() {
  if (!haalWaarden || document.hidden) return;
  const doelen = [...document.querySelectorAll("[data-live]")];
  if (!doelen.length) return stopLive();
  try {
    const waarden = await haalWaarden(doelen.map((d) => d.dataset.live));
    for (const doel of doelen) {
      const nieuw = waarden[doel.dataset.live];
      if (nieuw === undefined) continue;
      const vak = doel.querySelector(".livewaarde") || doel;
      if (vak.textContent === String(nieuw)) continue;
      vak.textContent = nieuw;
      doel.classList.add("verversen");
      setTimeout(() => doel.classList.remove("verversen"), 700);
    }
    laatste = new Date();
    toonTijd();
  } catch {
    const bol = document.getElementById("hartslag");
    if (bol) bol.className = "hartslag offline";
  }
}

// Een scherm meldt zich hiermee aan. Zijn er geen live velden, dan gebeurt
// er niets — geen timer, geen verzoeken, geen beweging.
export function volgLive(functie, snel = false) {
  stopLive();
  if (!document.querySelector("[data-live]")) { toonTijd(); return; }
  haalWaarden = functie;
  timer = setInterval(tik, snel ? SNEL : TRAAG);
  laatste = new Date();
  toonTijd();
}

export function stopLive() {
  if (timer) clearInterval(timer);
  timer = null;
  haalWaarden = null;
  toonTijd();
}

document.addEventListener("visibilitychange", () => { if (!document.hidden) tik(); });
