// ============================================================================
// Events inlezen uit een document, in vier stappen:
//
//   1. bestand kiezen (CSV, TSV, of tekst uit Excel geplakt)
//   2. kolommen koppelen: welke kolom van het document hoort bij welk veld
//   3. botsingen oplossen: staat er al iets op die dag, dan kies je per regel
//      toevoegen, het origineel behouden, of het origineel vervangen
//   4. inlezen
//
// Er wordt niets overschreven zonder dat je dat per regel hebt gezegd.
// ============================================================================

import { importVoorbereiden, importUitvoeren } from "./api.js";
import { ontsnap, toonDatum } from "./veld.js";

const VELDEN = [
  { kolom: "datum",       label: "Datum",       verplicht: true,  hint: "jjjj-mm-dd, of 14/09/2026" },
  { kolom: "tijdstip",    label: "Tijdstip",    verplicht: false, hint: "14:15" },
  { kolom: "naam",        label: "Event",       verplicht: true,  hint: "de naam van de gebeurtenis" },
  { kolom: "soort",       label: "Soort",       verplicht: false, hint: "macro · centrale_bank · expiratie · bedrijf · politiek" },
  { kolom: "zwaarte",     label: "Zwaarte",     verplicht: false, hint: "licht · middel · zwaar" },
  { kolom: "tijdzone",    label: "Tijdzone",    verplicht: false, hint: "Europe/Brussels · America/New_York — leeg = Brussel" },
  { kolom: "toelichting", label: "Toelichting", verplicht: false, hint: "" },
];

// --------------------------------------------------------------- inlezen
function splits(tekst) {
  const regels = tekst.replace(/\r\n?/g, "\n").split("\n").filter((r) => r.trim());
  if (!regels.length) return { kop: [], rijen: [] };
  const scheiding = [";", "\t", ","]
    .map((s) => ({ s, n: regels[0].split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s;

  const ontleed = (regel) => {
    const uit = []; let nu = ""; let tussen = false;
    for (let i = 0; i < regel.length; i++) {
      const teken = regel[i];
      if (teken === '"') { if (tussen && regel[i + 1] === '"') { nu += '"'; i++; } else tussen = !tussen; }
      else if (teken === scheiding && !tussen) { uit.push(nu); nu = ""; }
      else nu += teken;
    }
    uit.push(nu);
    return uit.map((w) => w.trim());
  };

  const kop = ontleed(regels[0]);
  return { kop, rijen: regels.slice(1).map(ontleed) };
}

// Datums uit het document naar jjjj-mm-dd. Lukt het niet, dan blijft de waarde
// staan en meldt de volgende stap dat die regel niet klopt.
const MAANDEN = { jan:1, feb:2, mrt:3, maa:3, mar:3, apr:4, mei:5, may:5, jun:6, jul:7, aug:8, sep:9, okt:10, oct:10, nov:11, dec:12 };
function naarDatum(tekst) {
  const t = String(tekst || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  let m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = /^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  m = /^(\d{1,2})\s+([a-z]{3,})\.?\s+(\d{4})$/i.exec(t);
  if (m) {
    const maand = MAANDEN[m[2].slice(0, 3).toLowerCase()];
    if (maand) return `${m[3]}-${String(maand).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  return t;
}

// Raadt welke documentkolom bij welk veld hoort, op basis van de kopregel.
function raad(kop, kolom) {
  const woorden = {
    datum: ["datum", "date", "day", "dag"],
    tijdstip: ["tijd", "time", "uur", "hour"],
    naam: ["naam", "name", "event", "gebeurtenis", "omschrijving", "description", "title", "titel"],
    soort: ["soort", "type", "category", "categorie", "kind"],
    zwaarte: ["zwaarte", "impact", "importance", "belang", "gewicht"],
    tijdzone: ["tijdzone", "timezone", "zone", "tz"],
    toelichting: ["toelichting", "opmerking", "note", "comment", "detail"],
  }[kolom];
  const i = kop.findIndex((k) => woorden.some((w) => k.toLowerCase().includes(w)));
  return i;
}

// =========================================================== het scherm
export function importscherm(inhoud, kruimel, meta) {
  kruimel.innerHTML = `<a href="#/t/event">Eventskalender</a> <span class="pijlje">&rsaquo;</span> <span>Inlezen uit een document</span>`;
  document.title = "Events inlezen · Delta Blueprint Cockpit";

  const toestand = { kop: [], rijen: [], koppeling: {}, voorbereid: null, keuzes: {} };

  stap1();

  function omhulsel(stap, binnenin) {
    const stappen = ["Bestand", "Kolommen koppelen", "Botsingen", "Klaar"];
    const vink = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`;
    return `
      <div class="titelrij"><h1>Events inlezen uit een document</h1></div>
      <div class="chevrons los">${stappen.map((naam, i) => {
        const stand = i + 1 < stap ? "gedaan" : i + 1 === stap ? "nu" : "straks";
        return `<span class="chevron ${stand}">${naam}${stand === "gedaan" ? vink : ""}</span>`;
      }).join("")}</div>
      <div class="kaart">${binnenin}</div>`;
  }

  // ---- 1. bestand ----
  function stap1() {
    inhoud.innerHTML = omhulsel(1, `
      <p class="uitleg">Kies een bestand met komma's, puntkomma's of tabs als scheiding — een CSV uit
      Excel of een export uit je kalenderbron. Je mag de inhoud ook gewoon plakken.</p>
      <div class="bestandsrij">
        <label class="knop tweede" for="bestand">Bestand kiezen</label>
        <input type="file" id="bestand" class="verborgeninvoer" accept=".csv,.tsv,.txt,text/csv,text/plain">
        <span class="bestandsnaam" id="bestandsnaam">Geen bestand gekozen</span>
      </div>
      <p class="uitleg">Of plak de inhoud:</p>
      <textarea id="geplakt" rows="6" placeholder="datum;tijdstip;event;impact&#10;2026-10-08;14:15;ECB-rentebesluit;zwaar"></textarea>
      <div class="knoprij"><button class="knop" id="verder">Verder</button></div>`);

    inhoud.querySelector("#bestand").addEventListener("change", (e) => {
      const bestand = e.target.files[0];
      if (!bestand) return;
      inhoud.querySelector("#bestandsnaam").textContent = bestand.name;
      const lezer = new FileReader();
      lezer.onload = () => { inhoud.querySelector("#geplakt").value = lezer.result; };
      lezer.readAsText(bestand);
    });

    inhoud.querySelector("#verder").addEventListener("click", () => {
      const tekst = inhoud.querySelector("#geplakt").value;
      if (!tekst.trim()) return alert("Kies een bestand of plak de inhoud.");
      const { kop, rijen } = splits(tekst);
      if (!rijen.length) return alert("Er staan geen regels onder de kopregel.");
      toestand.kop = kop;
      toestand.rijen = rijen;
      for (const v of VELDEN) toestand.koppeling[v.kolom] = raad(kop, v.kolom);
      stap2();
    });
  }

  // ---- 2. kolommen koppelen ----
  function stap2() {
    const voorbeeld = (i) => (i >= 0 && toestand.rijen[0] ? toestand.rijen[0][i] ?? "" : "");
    inhoud.innerHTML = omhulsel(2, `
      <p class="uitleg">${toestand.rijen.length} regels gevonden. Zeg welke kolom van je document bij
      welk veld hoort. Wat het systeem zelf herkende, staat al ingevuld.</p>
      <div class="koppeltabel">
        <div class="koppelkop">Veld</div><div class="koppelkop">Kolom in het document</div><div class="koppelkop">Eerste regel uit het document</div>
        ${VELDEN.map((v) => `
          <div class="koppelveld"><span class="koppelnaam">${v.verplicht ? '<span class="ster">*</span> ' : ""}${v.label}</span>
            ${v.hint ? `<span class="koppelhint">${ontsnap(v.hint)}</span>` : ""}</div>
          <div><select data-veld="${v.kolom}">
            <option value="-1">— niet gebruiken —</option>
            ${toestand.kop.map((k, i) => `<option value="${i}"${toestand.koppeling[v.kolom] === i ? " selected" : ""}>${ontsnap(k || `kolom ${i + 1}`)}</option>`).join("")}
          </select></div>
          <div class="koppelvoorbeeld" data-voorbeeld="${v.kolom}">${ontsnap(voorbeeld(toestand.koppeling[v.kolom]))}</div>`).join("")}
      </div>
      <div class="knoprij">
        <button class="knop tweede" id="terug">Terug</button>
        <button class="knop" id="verder">Controleren</button>
      </div>`);

    inhoud.querySelectorAll("select[data-veld]").forEach((el) => {
      el.addEventListener("change", () => {
        toestand.koppeling[el.dataset.veld] = Number(el.value);
        inhoud.querySelector(`[data-voorbeeld="${el.dataset.veld}"]`).textContent = voorbeeld(Number(el.value));
      });
    });
    inhoud.querySelector("#terug").addEventListener("click", stap1);
    inhoud.querySelector("#verder").addEventListener("click", async () => {
      for (const v of VELDEN.filter((v) => v.verplicht)) {
        if (!(toestand.koppeling[v.kolom] >= 0)) return alert(`${v.label} moet gekoppeld zijn.`);
      }
      const rijen = toestand.rijen.map((r) => {
        const uit = {};
        for (const v of VELDEN) {
          const i = toestand.koppeling[v.kolom];
          uit[v.kolom] = i >= 0 ? (r[i] ?? "") : "";
        }
        uit.datum = naarDatum(uit.datum);
        return uit;
      });
      inhoud.querySelector("#verder").disabled = true;
      try {
        toestand.voorbereid = await importVoorbereiden(rijen);
        toestand.keuzes = {};
        stap3();
      } catch (fout) {
        alert(fout.message);
        inhoud.querySelector("#verder").disabled = false;
      }
    });
  }

  // ---- 3. botsingen ----
  function stap3() {
    const regels = toestand.voorbereid.regels;
    const fout = regels.filter((r) => r.fouten.length);
    const botsing = regels.filter((r) => !r.fouten.length && r.keuze_nodig);
    const schoon = regels.filter((r) => !r.fouten.length && !r.keuze_nodig);

    for (const r of botsing) if (!toestand.keuzes[r.nummer]) toestand.keuzes[r.nummer] = { actie: "toevoegen" };

    inhoud.innerHTML = omhulsel(3, `
      <p class="uitleg">
        <b>${schoon.length}</b> ${schoon.length === 1 ? "regel komt" : "regels komen"} er zonder meer bij.
        ${botsing.length ? `<b>${botsing.length}</b> ${botsing.length === 1 ? "regel valt" : "regels vallen"} op een dag waar al iets staat — kies per regel wat er moet gebeuren.` : ""}
        ${fout.length ? `<b>${fout.length}</b> ${fout.length === 1 ? "regel wordt" : "regels worden"} overgeslagen omdat er iets ontbreekt.` : ""}
      </p>

      ${fout.length ? `<div class="botsinggroep">
        <div class="botsingkop">Overgeslagen</div>
        ${fout.map((r) => `<div class="botsingregel fout">
          <span>regel ${r.nummer + 2}: ${ontsnap(r.rij.naam || "(zonder naam)")}</span>
          <span class="faint">${ontsnap(r.fouten.join(" · "))}</span></div>`).join("")}
      </div>` : ""}

      ${botsing.map((r) => `
        <div class="botsinggroep" data-regel="${r.nummer}">
          <div class="botsingkop">${toonDatum(r.rij.datum)} — er staat hier al ${r.bestaand.length === 1 ? "een event" : `${r.bestaand.length} events`}</div>
          <div class="botsingvergelijk">
            <div class="botsingkant">
              <div class="botsinglabel">In de database</div>
              ${r.bestaand.map((b) => `<div class="botsingitem">${ontsnap(b.tijdstip || "")} ${ontsnap(b.naam)}
                <span class="faint">${ontsnap(b.zwaarte)}</span></div>`).join("")}
            </div>
            <div class="botsingkant">
              <div class="botsinglabel">Uit het document</div>
              <div class="botsingitem nieuw">${ontsnap(r.rij.tijdstip || "")} ${ontsnap(r.rij.naam)}
                <span class="faint">${ontsnap(r.rij.zwaarte || "middel")}</span></div>
            </div>
          </div>
          <div class="botsingkeuzes">
            <label><input type="radio" name="k${r.nummer}" value="toevoegen" checked> Allebei houden — het is een ander event op dezelfde dag</label>
            <label><input type="radio" name="k${r.nummer}" value="behouden"> Het origineel houden, deze regel overslaan</label>
            ${r.bestaand.map((b) => `
              <label><input type="radio" name="k${r.nummer}" value="vervangen:${b.id}">
                <span>Vervangen: &ldquo;${ontsnap(b.naam)}&rdquo; wordt &ldquo;${ontsnap(r.rij.naam)}&rdquo;</span></label>`).join("")}
          </div>
        </div>`).join("")}

      <div class="knoprij">
        <button class="knop tweede" id="terug">Terug</button>
        <button class="knop" id="inlezen">Inlezen</button>
      </div>`);

    inhoud.querySelectorAll('input[type="radio"]').forEach((el) => {
      el.addEventListener("change", () => {
        const nummer = Number(el.name.slice(1));
        const [actie, id] = el.value.split(":");
        toestand.keuzes[nummer] = { actie, vervangt: id ? Number(id) : null };
      });
    });

    inhoud.querySelector("#terug").addEventListener("click", stap2);
    inhoud.querySelector("#inlezen").addEventListener("click", async () => {
      const knop = inhoud.querySelector("#inlezen");
      knop.disabled = true;
      const teDoen = regels
        .filter((r) => !r.fouten.length)
        .map((r) => ({ rij: r.rij, ...(toestand.keuzes[r.nummer] || { actie: "toevoegen" }) }));
      try {
        const uitkomst = await importUitvoeren(teDoen);
        stap4(uitkomst, fout.length);
      } catch (f) {
        alert(f.message);
        knop.disabled = false;
      }
    });
  }

  // ---- 4. klaar ----
  function stap4(uitkomst, overgeslagenDoorFout) {
    inhoud.innerHTML = omhulsel(4, `
      <p class="uitleg">Klaar.</p>
      <ul class="uitkomstlijst">
        <li><b>${uitkomst.toegevoegd}</b> ${uitkomst.toegevoegd === 1 ? "event toegevoegd" : "events toegevoegd"}</li>
        <li><b>${uitkomst.vervangen}</b> vervangen</li>
        <li><b>${uitkomst.overgeslagen}</b> overgeslagen op jouw keuze</li>
        ${overgeslagenDoorFout ? `<li><b>${overgeslagenDoorFout}</b> overgeslagen omdat er iets ontbrak</li>` : ""}
      </ul>
      <p class="uitleg">Elke vervanging staat met naam en tijdstip in het auditlog.</p>
      <div class="knoprij">
        <a class="knop" href="#/t/event">Naar de eventskalender</a>
        <button class="knop tweede" id="nogmaals">Nog een document inlezen</button>
      </div>`);
    inhoud.querySelector("#nogmaals").addEventListener("click", stap1);
  }
}
