// De schil: balk bovenaan, menu uit db_module, en een werkvlak.
// Het menu komt uit de database — een tabel toevoegen is een regel daar,
// geen wijziging hier (BOUWSPEC 10.0).

const LOGO = `<svg viewBox="0 0 296.1 251.9" width="15" height="13" aria-hidden="true">
  <polygon points="226.6 133.8 108.7 67.1 148.1 0 226.6 133.8" fill="#FFFFFF"/>
  <polygon points="296.1 251.9 139.2 251.9 256.9 185.1 296.1 251.9" fill="#FFFFFF"/>
  <polygon points="76.9 251.9 0 251.9 76.7 121.6 76.9 251.9" fill="#FFFFFF"/></svg>`;

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

  const initialen = (persoon.korte_naam || persoon.naam || "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const menu = meta.menu.map((groep) => `
    <div class="groep">${groep.groep}</div>
    ${groep.items.map((item) => `
      <a href="#${item.route}" class="${item.route === actieveRoute ? "actief" : ""}">${item.label}</a>
    `).join("")}
  `).join("");

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
        <span class="bol">${initialen}</span>
        <span>${persoon.naam}</span>
        <a href="#afmelden" id="afmelden" style="color: var(--navdim); text-decoration: none;">afmelden</a>
      </span>
    </div>
    <div class="romp">
      <nav class="menu">${menu}</nav>
      <div class="werkvlak">
        <div class="kruimel" id="kruimel"></div>
        <div class="inhoud" id="inhoud"></div>
      </div>
    </div>`;

  wortel.querySelector("#afmelden").addEventListener("click", (e) => {
    e.preventDefault();
    afmelden();
  });

  gebouwd = {
    wortel,
    persoon,
    kruimel: wortel.querySelector("#kruimel"),
    inhoud: wortel.querySelector("#inhoud"),
  };
  return gebouwd;
}

export function schilVergeten() { gebouwd = null; }
