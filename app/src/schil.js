// De schil: balk bovenaan, menu uit db_module, en een werkvlak.
// Het menu komt uit de database — een tabel toevoegen is een regel daar,
// geen wijziging hier (BOUWSPEC 10.0).

const LOGO = `<svg viewBox="0 0 296.1 251.9" width="28" height="24" aria-hidden="true">
  <polygon points="226.6 133.8 108.7 67.1 148.1 0 226.6 133.8" fill="#FFFFFF"/>
  <polygon points="296.1 251.9 139.2 251.9 256.9 185.1 296.1 251.9" fill="#FFFFFF"/>
  <polygon points="76.9 251.9 0 251.9 76.7 121.6 76.9 251.9" fill="#FFFFFF"/></svg>`;

import { avatar, verklein } from "./avatar.js";
import { zetAvatar, leesVoorkeur, zetVoorkeur, brugStand, brugInstelling } from "./api.js";
import { navtabsHtml, navpanelenHtml, navtabsAansluiten,
         favorietenKaart, wisselFavoriet, STERTJE } from "./navtabs.js";

const TRECHTER = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
  <path d="M1.5 2.5h13L9.5 8.4v4.3l-3 1.8V8.4z" fill="none" stroke="currentColor" stroke-width="1.3"
        stroke-linejoin="round"/></svg>`;

let gebouwd = null;

// Markeert het actieve menu-item zonder de schil opnieuw te bouwen.
export function menuBijwerken(route) {
  if (!gebouwd) return;
  gebouwd.wortel.querySelectorAll(".menu a").forEach((a) => {
    a.classList.toggle("actief", a.getAttribute("href") === "#" + route);
  });
}

export function schil(persoon, meta, actieveRoute, afmelden) {
  // De schil wordt één keer gebouwd. Hem bij elke klik opnieuw opbouwen laat
  // het scherm knipperen alsof de pagina herlaadt — dat mag niet.
  if (gebouwd && gebouwd.persoon === persoon) {
    menuBijwerken(actieveRoute);
    return gebouwd;
  }

  const wortel = document.getElementById("app");
  wortel.className = "";

  const mijnAvatar = () => avatar(persoon, 24);

  // Het menu is opgebouwd zoals de navigator die iedereen kent: bovenaan een
  // filter, daaronder per toepassingsgroep een kop die je open- en dichtklapt,
  // met de modules eronder. De groepen komen uit db_module; hier staat alleen
  // hoe ze getoond worden.
  const menu = meta.menu.map((groep, i) => `
    <div class="menugroep" data-groep="${i}">
      <button class="groepkop" type="button" aria-expanded="true">
        <span class="groepnaam">${groep.groep}</span><span class="groeppijl">&rsaquo;</span>
      </button>
      <div class="groepitems">
        ${groep.items.map((item) => `
          <span class="menuregel" data-zoek="${(item.label + " " + groep.groep).toLowerCase()}">
            <a href="#${item.route}" class="${item.route === actieveRoute ? "actief" : ""}">${item.label}</a>
            <button class="menuster" type="button" data-route="${item.route}" data-label="${item.label}"
              title="Toevoegen aan favorieten" aria-label="Toevoegen aan favorieten">${STERTJE}</button>
          </span>
        `).join("")}
      </div>
    </div>`).join("");

  wortel.innerHTML = `
    <div class="appbar">
      ${LOGO}
      <span class="merk">Delta Wave</span>
      <span class="sub">Cockpit</span>
      <span class="golf" aria-hidden="true"><svg viewBox="0 0 240 20" preserveAspectRatio="none">
        <defs><linearGradient id="golffade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity=".9"/>
          <stop offset=".45" stop-color="#fff" stop-opacity=".4"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="M0 10h26l7-6 9 12 8-9 7 3h183" fill="none" stroke="url(#golffade)"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg></span>
      <span class="rechts">
        <div class="brugstand" id="brugstand" hidden role="group" aria-label="De brug">
          <button class="bsknop" data-aan="0" type="button">Trading</button>
          <button class="bsknop" data-aan="1" type="button"><span class="brugstip"></span><span class="bslabel">Sync</span></button>
        </div>
        <span class="hartslagvak" title="Hoe vers wat je ziet is">
          <span id="hartslag" class="hartslag bijgewerkt"></span>
          <span id="hartslagtekst" class="hartslagtekst"></span>
        </span>
        <button class="avatarknop" id="mijnavatar" title="Je foto wijzigen" aria-label="Je foto wijzigen">${mijnAvatar()}</button>
        <span>${persoon.naam}</span>
        <a href="#afmelden" id="afmelden" style="color: var(--navdim); text-decoration: none;">afmelden</a>
      </span>
    </div>
    <div class="romp">
      <nav class="menu">
        ${navtabsHtml()}
        <div class="menufilter">
          ${TRECHTER}
          <input id="menufilter" type="text" placeholder="Filter menu" aria-label="Filter menu" autocomplete="off">
        </div>
        <div class="menulijst" id="menulijst">${menu}</div>
        <p class="menuleeg" id="menuleeg" hidden>Niets gevonden.</p>
        ${navpanelenHtml()}
      </nav>
      <div class="werkvlak">
        <div class="kruimel" id="kruimel"></div>
        <div class="inhoud" id="inhoud"></div>
      </div>
    </div>`;

  wortel.querySelector("#afmelden").addEventListener("click", (e) => {
    e.preventDefault();
    afmelden();
  });

  brugschakelaar(wortel);

  // Op je eigen foto klikken opent de bestandskiezer. De afbeelding wordt
  // eerst verkleind tot 128 bij 128, zodat er geen megabytes in de database
  // belanden; alleen je eigen foto kun je wijzigen.
  const avatarknop = wortel.querySelector("#mijnavatar");
  avatarknop.addEventListener("click", () => {
    const kiezer = document.createElement("input");
    kiezer.type = "file";
    kiezer.accept = "image/*";
    kiezer.addEventListener("change", async () => {
      const bestand = kiezer.files && kiezer.files[0];
      if (!bestand) return;
      try {
        const klein = await verklein(bestand, 128);
        await zetAvatar(klein);
        persoon.avatar = klein;
        avatarknop.innerHTML = avatar(persoon, 24);
      } catch (fout) {
        alert(fout.message);
      }
    });
    kiezer.click();
  });

  // ---- open- en dichtklappen, en onthouden wat jij dicht liet staan ----
  const groepen = [...wortel.querySelectorAll(".menugroep")];
  const dicht = new Set();

  const toepassen = () => {
    groepen.forEach((g) => {
      const uit = dicht.has(g.querySelector(".groepnaam").textContent);
      g.classList.toggle("dicht", uit);
      g.querySelector(".groepkop").setAttribute("aria-expanded", uit ? "false" : "true");
    });
  };

  leesVoorkeur("menu.dicht")
    .then(({ waarde }) => { (waarde || []).forEach((n) => dicht.add(n)); toepassen(); })
    .catch(() => {});

  groepen.forEach((g) => {
    g.querySelector(".groepkop").addEventListener("click", () => {
      const naam = g.querySelector(".groepnaam").textContent;
      if (dicht.has(naam)) dicht.delete(naam); else dicht.add(naam);
      toepassen();
      zetVoorkeur("menu.dicht", [...dicht]).catch(() => {});
    });
  });

  // ---- filteren ----
  // Typen zoekt in de naam van de module en van haar groep. Wat past blijft
  // staan, met zijn groep opengeklapt; de rest verdwijnt zolang je typt.
  const filter = wortel.querySelector("#menufilter");
  const leegmelding = wortel.querySelector("#menuleeg");
  filter.addEventListener("input", () => {
    const woord = filter.value.trim().toLowerCase();
    let gevonden = 0;
    groepen.forEach((g) => {
      let raak = 0;
      g.querySelectorAll(".menuregel").forEach((r) => {
        const past = !woord || r.dataset.zoek.includes(woord);
        r.hidden = !past;
        if (past) raak++;
      });
      g.hidden = raak === 0;
      g.classList.toggle("zoekt", Boolean(woord));
      gevonden += raak;
    });
    leegmelding.hidden = gevonden > 0;
    if (!woord) toepassen();
  });
  filter.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    filter.value = "";
    filter.dispatchEvent(new Event("input"));
  });

  const navtabs = navtabsAansluiten(wortel);

  // Het sterretje naast een menu-item: zichtbaar zodra je erover zweeft, gevuld
  // als deze lijst al in je favorieten staat. Eén klik zet hem erbij of haalt
  // hem eruit — het hele menu is daarmee ook de plek waar je favorieten maakt.
  const sterren = [...wortel.querySelectorAll(".menuster")];
  const sterrenBijwerken = async () => {
    const kaart = await favorietenKaart();
    sterren.forEach((s) => s.classList.toggle("vast", kaart.has(s.dataset.route)));
  };
  sterrenBijwerken();
  sterren.forEach((ster) => {
    ster.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      ster.disabled = true;
      try {
        const nu = await wisselFavoriet(ster.dataset.route, ster.dataset.label);
        ster.classList.toggle("vast", nu);
      } catch { /* een favoriet die niet lukt mag het menu niet breken */ }
      ster.disabled = false;
    });
  });

  gebouwd = {
    wortel,
    persoon,
    navtabs,
    kruimel: wortel.querySelector("#kruimel"),
    inhoud: wortel.querySelector("#inhoud"),
  };
  return gebouwd;
}

export function schilVergeten() { gebouwd = null; }

// --------------------------------------- de brug: Trading of Sync
//
// Eén paper account, één actieve gebruiker — dat is de keuze. IBKR laat per
// login maar één sessie toe, dus zijn het twee standen die elkaar uitsluiten:
//
//   Trading — de Gateway is afgemeld. Jij bent de sessie en kunt orders
//             plaatsen in LYNX. De cockpit leest niets bij; wat er staat is van
//             het laatste moment dat de brug luisterde.
//   Sync    — de Gateway is aangemeld en de brug luistert. De cockpit haalt
//             posities en uitvoeringen op. Inloggen in LYNX lukt dan niet.
//
// Daarom staat hij in de kop en niet drie schermen diep: het is het laatste wat
// je doet voordat je een order plaatst, en het eerste daarna.
//
// De schakelaar stuurt niets naar de brug. Hij zet een instelling; de brug leest
// die af in het antwoord op zijn eigen zending, binnen één hartslag. Het verkeer
// blijft één kant op, en het systeem plaatst nooit zelf een order.
function brugschakelaar(wortel) {
  const vak = wortel.querySelector("#brugstand");
  if (!vak) return;
  const knoppen = [...vak.querySelectorAll(".bsknop")];
  const kSync = knoppen.find((k) => k.dataset.aan === "1");
  const kTrade = knoppen.find((k) => k.dataset.aan === "0");
  const stip = kSync.querySelector(".brugstip");
  const label = kSync.querySelector(".bslabel");
  let aan = null;
  let bezig = false;

  // Hoe lang het stil is, in woorden. Staat de brug op Trading, dan is dat geen
  // storing maar het gevolg van de stand — en dan hoort er wél te staan hoe oud
  // het beeld is, want daarop kijk je.
  const geleden = (sec) => {
    if (sec === null || sec === undefined) return "nog nooit";
    if (sec < 90) return "net nog";
    if (sec < 5400) return `${Math.round(sec / 60)} min geleden`;
    if (sec < 172800) return `${Math.round(sec / 3600)} uur geleden`;
    return `${Math.round(sec / 86400)} dagen geleden`;
  };

  const teken = (stand, live, stil) => {
    aan = stand;
    vak.hidden = false;
    vak.classList.toggle("bezig", bezig);
    kSync.classList.toggle("actief", Boolean(stand));
    kTrade.classList.toggle("actief", !stand);
    kSync.setAttribute("aria-pressed", stand ? "true" : "false");
    kTrade.setAttribute("aria-pressed", stand ? "false" : "true");

    // Op Sync zegt het woord wat de brug doet: aangemeld en gehoord, of nog
    // bezig met opstarten. Dat duurt ongeveer een minuut, en zonder dat woord
    // lijkt die minuut op een storing.
    label.textContent = !stand ? "Sync" : live ? "Sync" : bezig ? "Aanmelden…" : "Verbinden…";
    stip.className = `brugstip ${stand ? (live ? "live" : "wacht") : "uit"}`;

    kSync.title = stand
      ? (live
        ? "De Gateway is aangemeld en de brug hoort haar. De cockpit leest posities en uitvoeringen bij."
        : "De Gateway start op en meldt zich aan; dat duurt ongeveer een minuut.")
      : "Zet de brug aan: de cockpit leest weer bij. Inloggen in LYNX lukt dan niet meer.";
    kTrade.title = stand
      ? "Meld de Gateway af, zodat jij de sessie bent en kunt handelen in LYNX. De cockpit leest dan niets bij."
      : `De Gateway is afgemeld; jij kunt handelen in LYNX. De cockpit las voor het laatst bij: ${geleden(stil)}.`;
  };

  const kijk = async () => {
    if (bezig) return;
    try {
      const d = await brugStand();
      const inst = (d.instellingen || []).find((r) => r.sleutel === "gateway_aan");
      // Staat de instelling er niet, dan draait deze omgeving nog op een oudere
      // migratie: dan tonen we de schakelaar niet in plaats van iets te verzinnen.
      if (!inst) { vak.hidden = true; return; }
      teken(Number(inst.waarde) === 1, Boolean(d.live), d.stil_seconden);
    } catch { /* niet aangemeld of even niet bereikbaar; de volgende ronde weer */ }
  };

  for (const k of knoppen) {
    k.addEventListener("click", async () => {
      const naar = k.dataset.aan === "1";
      // De stand waar je al op staat is geen knop. Twee keer op Sync drukken
      // mag de Gateway niet opnieuw laten opstarten.
      if (bezig || aan === null || naar === aan) return;
      bezig = true;
      teken(naar, false, null);
      try {
        await brugInstelling({ gateway_aan: naar ? "1" : "0" });
      } catch {
        bezig = false;
        teken(!naar, false, null);
        return;
      }
      bezig = false;
      teken(naar, false, null);
      setTimeout(kijk, 2000);
    });
  }

  kijk();
  setInterval(kijk, 15000);
}
