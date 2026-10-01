import { isAangemeld, aanmeldingWissen, ik, meta as haalMeta } from "./api.js";
import { aanmeldscherm } from "./aanmelden.js";
import { schil } from "./schil.js";

let persoon = null;
let meta = null;

function huidigeRoute() {
  return location.hash.slice(1) || "/dashboard";
}

// Etappe 1 kent nog geen schermen: elke route toont wat er komt.
// Etappe 2 vult /t/<tabel> met de lijst, etappe 3 het record.
function teken() {
  const route = huidigeRoute();
  const { kruimel, inhoud } = schil(persoon, meta, route, afmelden);

  const item = meta.menu.flatMap((g) => g.items).find((i) => i.route === route);
  const titel = item ? item.label : "Onbekend scherm";
  const tabel = item && item.tabel ? meta.tabellen.find((t) => t.naam === item.tabel) : null;

  kruimel.textContent = titel;
  inhoud.innerHTML = `
    <div class="titelrij">
      <h1>${titel}</h1>
      <span class="sub">${tabel ? `tabel ${tabel.naam} · ${tabel.label_mv}` : "scherm zonder tabel"}</span>
    </div>
    <div class="kaart leeg">
      ${tabel
        ? `Dit wordt de lijst van <b>${tabel.label_mv.toLowerCase()}</b>, met het record eronder in tabbladen.
           Er zijn nog <b>${tabel.velden.length}</b> velden gedefinieerd voor deze tabel.
           Lijsten komen in etappe 2, het recordscherm in etappe 3.`
        : `Dit scherm heeft geen tabel; het wordt afgeleid of samengesteld.`}
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
