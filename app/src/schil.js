// De schil: balk bovenaan, menu uit db_module, en een werkvlak.
// Het menu komt uit de database — een tabel toevoegen is een regel daar,
// geen wijziging hier (BOUWSPEC 10.0).

const LOGO = `<svg viewBox="0 0 296.1 251.9" width="15" height="13" aria-hidden="true">
  <polygon points="226.6 133.8 108.7 67.1 148.1 0 226.6 133.8" fill="#FFFFFF"/>
  <polygon points="296.1 251.9 139.2 251.9 256.9 185.1 296.1 251.9" fill="#FFFFFF"/>
  <polygon points="76.9 251.9 0 251.9 76.7 121.6 76.9 251.9" fill="#FFFFFF"/></svg>`;

import { avatar, verklein } from "./avatar.js";
import { zetAvatar, leesVoorkeur, zetVoorkeur } from "./api.js";
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
      <span class="merk">Delta Blueprint</span>
      <span class="sub">Cockpit</span>
      <span class="rechts">
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
