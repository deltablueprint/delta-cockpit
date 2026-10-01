import { isAangemeld, aanmeldingWissen, ik, meta as haalMeta } from "./api.js";
import { aanmeldscherm } from "./aanmelden.js";
import { schil, menuBijwerken, schilVergeten } from "./schil.js";
import { lijstscherm, toestandUitUrl, huidigeLijst } from "./lijst.js";

let persoon = null;
let meta = null;

function huidigeRoute() {
  const heel = location.hash.slice(1) || "/dashboard";
  const vraagteken = heel.indexOf("?");
  return vraagteken === -1
    ? { pad: heel, zoekdeel: "" }
    : { pad: heel.slice(0, vraagteken), zoekdeel: heel.slice(vraagteken + 1) };
}

// Etappe 1 kent nog geen schermen: elke route toont wat er komt.
// Etappe 2 vult /t/<tabel> met de lijst, etappe 3 het record.
function teken() {
  const { pad, zoekdeel } = huidigeRoute();
  const { kruimel, inhoud } = schil(persoon, meta, pad, afmelden);

  menuBijwerken(pad);

  const lijstRoute = pad.match(/^\/t\/([a-z_]+)$/);
  if (lijstRoute) {
    huidigeLijst.tabelnaam = lijstRoute[1];
    huidigeLijst.url = "#" + pad + (zoekdeel ? "?" + zoekdeel : "");
    lijstscherm(inhoud, kruimel, lijstRoute[1], meta, toestandUitUrl(zoekdeel));
    return;
  }
  huidigeLijst.tabelnaam = null;
  huidigeLijst.url = null;

  const item = meta.menu.flatMap((g) => g.items).find((i) => i.route === pad);
  const titel = item ? item.label : "Onbekend scherm";

  kruimel.textContent = titel;
  inhoud.innerHTML = `
    <div class="titelrij">
      <h1>${titel}</h1>
      <span class="sub">scherm zonder tabel</span>
    </div>
    <div class="kaart leeg">
      Dit scherm wordt afgeleid of samengesteld en komt later: het dashboard in etappe 12,
      Mijn taken daarna.
    </div>`;
}

function afmelden() {
  aanmeldingWissen();
  schilVergeten();
  persoon = null;
  meta = null;
  start();
}

async function binnen() {
  meta = await haalMeta();
  // Alleen opnieuw tekenen als de navigatie érgens anders vandaan komt dan de
  // lijst zelf: anders zou elke sortering of zoekactie het scherm herbouwen.
  const navigatie = () => {
    const url = "#" + location.hash.slice(1);
    if (huidigeLijst.url && url === huidigeLijst.url) return;
    teken();
  };
  addEventListener("hashchange", navigatie);
  addEventListener("popstate", navigatie);
  teken();
}

async function start() {
  if (!isAangemeld()) {
    aanmeldscherm(async (p) => {
      persoon = p;
      await binnen();
    });
    return;
  }
  try {
    persoon = await ik();
    await binnen();
  } catch {
    aanmeldscherm(async (p) => {
      persoon = p;
      await binnen();
    });
  }
}

start();
