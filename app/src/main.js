import { isAangemeld, aanmeldingWissen, ik, meta as haalMeta } from "./api.js";
import { aanmeldscherm } from "./aanmelden.js";
import { schil, menuBijwerken, schilVergeten } from "./schil.js";
import { lijstscherm, toestandUitUrl, huidigeLijst } from "./lijst.js";
import { recordscherm } from "./record.js";
import { importscherm } from "./importeren.js";
import { gonogoscherm } from "./gonogo.js";
import { uitkomstscherm } from "./uitkomst.js";
import { favorietenscherm } from "./favorieten.js";
import { koppelingscherm } from "./koppeling.js";
import { onverdeeldscherm } from "./onverdeeld.js";
import { berichtenscherm } from "./berichten.js";
import { werkbankscherm } from "./werkbank.js";
import { zetBezoek } from "./api.js";
import { stopLive } from "./live.js";
import { opstellerscherm } from "./opsteller.js";

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
// Waar een bezoek bij hoort, in één woord: de naam van de tabel of het scherm.
function soortVanRoute(route) {
  const t = route.match(/^\/t\/([a-z_]+)/);
  if (t) {
    const tabel = (meta && meta.tabellen || []).find((x) => x.naam === t[1]);
    return tabel ? tabel.label : t[1].replace(/_/g, " ");
  }
  if (route === "/werkbank") return "werkbank";
  if (route.startsWith("/bericht/")) return "bericht";
  if (route.startsWith("/uitkomst/")) return "gesprek";
  if (route.startsWith("/gonogo/")) return "go / no-go";
  return null;
}

function teken() {
  // Elke navigatie zet eerst alle verversing stil. Een timer van het vorige
  // scherm die daarna nog één keer tekent, zet je terug waar je vandaan kwam —
  // precies wat er gebeurde bij "nieuwe voorwaarde".
  stopLive();

  const { pad, zoekdeel } = huidigeRoute();
  const geheel = schil(persoon, meta, pad, afmelden);
  const { kruimel, inhoud } = geheel;

  menuBijwerken(pad);

  // De geschiedenis onthoudt waar je was. De titel van het scherm is pas bekend
  // als het geladen is, dus we kijken even later — en we schrijven alleen weg
  // wat ook echt een scherm werd.
  clearTimeout(teken.bezoekklok);
  teken.bezoekklok = setTimeout(() => {
    const route = location.hash.slice(1);
    const titel = (document.title || "").split(" · ")[0];
    if (!route || !titel || titel === "Delta Wave Cockpit") return;
    zetBezoek({ route, titel, soort: soortVanRoute(route) }).catch(() => {});
  }, 1200);

  if (pad === "/werkbank") {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    werkbankscherm(inhoud, kruimel);
    return;
  }

  if (pad === "/berichten") {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    berichtenscherm(inhoud, kruimel);
    return;
  }

  // De opsteller: één bericht, één scherm.
  const berichtRoute = pad.match(/^\/bericht\/(\d+)$/);
  if (berichtRoute) {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    opstellerscherm(inhoud, kruimel, Number(berichtRoute[1]));
    return;
  }


  if (pad === "/onverdeeld") {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    onverdeeldscherm(inhoud, kruimel);
    return;
  }

  if (pad === "/koppeling") {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    koppelingscherm(inhoud, kruimel);
    return;
  }

  if (pad === "/favorieten") {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    favorietenscherm(inhoud, kruimel, () => {
      if (geheel.navtabs) geheel.navtabs.tekenFavorieten();
    });
    return;
  }

  if (pad === "/import/event") {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    importscherm(inhoud, kruimel, meta);
    return;
  }

  // Het gesprek: één scherm met alles wat op dat moment bekend is.
  const uitkomstRoute = pad.match(/^\/uitkomst\/(\d+)$/);
  if (uitkomstRoute) {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    uitkomstscherm(inhoud, kruimel, Number(uitkomstRoute[1]), meta);
    return;
  }

  // Het actiescherm van de go/no-go hangt aan één cyclus (etappe 10).
  const gonogoRoute = pad.match(/^\/gonogo\/(\d+)$/);
  if (gonogoRoute) {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    gonogoscherm(inhoud, kruimel, Number(gonogoRoute[1]), meta);
    return;
  }

  // /t/<tabel>/nieuw  en  /t/<tabel>/<id>
  const recordRoute = pad.match(/^\/t\/([a-z_]+)\/(nieuw|\d+)$/);
  if (recordRoute) {
    huidigeLijst.tabelnaam = null;
    huidigeLijst.url = null;
    const p = new URLSearchParams(zoekdeel);
    const ouderParam = p.get("ouder");
    recordscherm(inhoud, kruimel, recordRoute[1], recordRoute[2] === "nieuw" ? "nieuw" : Number(recordRoute[2]), meta, {
      tab: p.get("tab"),
      ouder: ouderParam && ouderParam.includes(":")
        ? { tabel: ouderParam.split(":")[0], id: ouderParam.split(":")[1] }
        : null,
    });
    return;
  }

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
  // Eén navigatie mag maar één keer tekenen. Een sprong naar een nieuwe hash
  // meldt zich bij sommige browsers twee keer — als 'hashchange' én als
  // 'popstate' — en dan bouwde het scherm zich twee keer op: je zag de lijst
  // verschijnen, weggaan en opnieuw verschijnen.
  let laatsteUrl = null;
  const navigatie = () => {
    const url = "#" + location.hash.slice(1);
    if (huidigeLijst.url && url === huidigeLijst.url) return;
    if (url === laatsteUrl) return;
    laatsteUrl = url;
    teken();
  };
  addEventListener("hashchange", navigatie);
  addEventListener("popstate", navigatie);
  laatsteUrl = "#" + location.hash.slice(1);
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
