// Live waarden (etappe 6). In fase 1 hangen er nog geen feeds achter: wat het
// scherm ververst, zijn de wijzigingen van de anderen. Dat is precies waar je
// het voor nodig hebt als drie mensen in dezelfde cyclus werken.
//
// Vier toestanden, zichtbaar in de balk bovenaan:
//   live       · net ververst, de klok loopt
//   bijgewerkt · stil, maar binnen de verversingstijd
//   gepauzeerd · dit tabblad staat op de achtergrond, of je bent aan het typen
//   offline    · de laatste poging mislukte
//
// Verversen gebeurt nooit terwijl je in een veld staat of een cel bewerkt:
// dan zou je eigen invoer onder je handen vandaan verdwijnen.

const SNEL = 5000;    // in een lopende cyclus
const TRAAG = 60000;  // daarbuiten

let timer = null;
let tempo = TRAAG;
let ververs = null;
let toestand = "bijgewerkt";
let laatste = null;

function elementen() {
  return {
    bol: document.getElementById("hartslag"),
    tekst: document.getElementById("hartslagtekst"),
  };
}

function tijd(d) {
  return d.toTimeString().slice(0, 8);
}

export function toonToestand(nieuw) {
  toestand = nieuw;
  const { bol, tekst } = elementen();
  if (!bol || !tekst) return;
  bol.className = `hartslag ${nieuw}`;
  const omschrijving = {
    live: laatste ? `Live · ${tijd(laatste)}` : "Live",
    bijgewerkt: laatste ? `Bijgewerkt ${tijd(laatste)}` : "Bijgewerkt",
    gepauzeerd: "Gepauzeerd",
    offline: "Geen verbinding",
  }[nieuw];
  tekst.textContent = omschrijving;
}

function magVerversen() {
  if (document.hidden) return false;
  const a = document.activeElement;
  if (!a) return true;
  const typt = ["INPUT", "SELECT", "TEXTAREA"].includes(a.tagName);
  // In het zoekveld van een lijst mag wél ververst worden; in een formulier of
  // een cel die je aan het bewerken bent niet.
  if (!typt) return true;
  return a.id === "zoek";
}

async function tik() {
  if (!ververs) return;
  if (!magVerversen()) { toonToestand("gepauzeerd"); return; }
  try {
    await ververs();
    laatste = new Date();
    toonToestand("live");
    setTimeout(() => { if (toestand === "live") toonToestand("bijgewerkt"); }, 1200);
  } catch {
    toonToestand("offline");
  }
}

// Het scherm meldt hier wat er ververst moet worden, en hoe vaak.
export function volgLive(functie, lopendeCyclus = false) {
  ververs = functie;
  tempo = lopendeCyclus ? SNEL : TRAAG;
  if (timer) clearInterval(timer);
  timer = setInterval(tik, tempo);
  laatste = new Date();
  toonToestand("bijgewerkt");
}

export function stopLive() {
  ververs = null;
  if (timer) clearInterval(timer);
  timer = null;
  toonToestand("gepauzeerd");
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) toonToestand("gepauzeerd");
  else if (ververs) tik();
});
