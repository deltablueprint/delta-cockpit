import { isAangemeld, aanmeldingWissen, ik, meta as haalMeta } from "./api.js";
import { aanmeldscherm } from "./aanmelden.js";
import { schil } from "./schil.js";
import { lijstscherm } from "./lijst.js";

let persoon = null;
let meta = null;

function huidigeRoute() {
  return location.hash.slice(1) || "/dashboard";
}

// Etappe 1 kent nog geen schermen: elke route toont wat er komt.
// Etappe 2 vult /t/<tabel> met de lijst, etappe 3 het record.
const lijsttoestand = {};   // onthoudt zoekterm en sortering per tabel

function teken() {
  const route = huidigeRoute();
  const { kruimel, inhoud } = schil(persoon, meta, route, afmelden);

  const lijstRoute = route.match(/^\/t\/([a-z_]+)$/);
  if (lijstRoute) {
    const tabelnaam = lijstRoute[1];
    lijsttoestand[tabelnaam] ||= { q: "", sorteer: null, richting: "asc" };
    lijstscherm(inhoud, kruimel, tabelnaam, meta, lijsttoestand[tabelnaam]);
    return;
  }

  const item = meta.menu.flatMap((g) => g.items).find((i) => i.route === route);
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
  persoon = null;
  meta = null;
  start();
}

async function binnen() {
  meta = await haalMeta();
  addEventListener("hashchange", teken);
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
