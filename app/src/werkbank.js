// De werkbank: wat er nu van ons gevraagd wordt.
//
// Eén scherm, en het opent met de vraag die ertoe doet — hoe ver lopen de leden
// achter op wat wij weten. Daaronder de kaarten die dat gat dichten, en daar
// weer onder wat er in deze cyclus gebeurd is.
//
// Drie regels waar dit scherm zich aan houdt:
//   - Knoppen staan alleen op een kaart. Een scherm vol knoppen is een scherm
//     waarop je moet zoeken wat je moet doen.
//   - Geen uitleg in lopende zinnen. Een kaart draagt zijn reden in één regel;
//     wie meer wil weten klikt door naar het record.
//   - Groen betekent 'in orde'. Een kaart die openstaat is dat nooit, dus de
//     prioriteiten zijn rood, amber en grijs.

import {
  haalWachtrij, beantwoordKaart, conceptUitKaart, haalAchterstand,
  haalBarometer, werkbankCycli, haalStroom, wachtrijStand, haalTedoen,
} from "./api.js";
import { ontsnap } from "./veld.js";

const PRULLENBAK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>`;

const PRIOLABEL = { hoog: "Hoog", medium: "Medium", laag: "Laag" };
const STATUSWOORD = {
  concept: "in concept", nalezen: "ligt bij de nalezer",
  klaar: "klaar om te versturen", verstuurd: "verstuurd",
};

// Hoe lang iets al wacht, in woorden. '36 uur' leest slechter dan 'anderhalve
// dag', maar onder de dag is het uur juist het enige dat telt.
function sinds(uren) {
  const n = Number(uren) || 0;
  if (n < 1) return "zojuist";
  if (n < 24) return `${Math.round(n)} uur`;
  const d = Math.floor(n / 24);
  return `${d} ${d === 1 ? "dag" : "dagen"}`;
}

// Welke werkbank de levende is. Elk bezoek verhoogt dit nummer; een peiling die
// van een ouder bezoek komt, legt zichzelf neer.
//
// Zonder dit bleef de klok van een verlaten werkbank gewoon doortikken, en tien
// seconden later tekende hij zichzelf over het scherm waar je inmiddels was.
// Dat zag eruit als een omleiding naar de werkbank, maar het was erger: op een
// formulier waar je in zat te typen was je je werk kwijt.
let bezoek = 0;

export async function werkbankscherm(inhoud, kruimel) {
  const dit = ++bezoek;
  const leeftNog = () =>
    dit === bezoek
    && location.hash.slice(1).split("?")[0] === "/werkbank"
    && document.body.contains(inhoud);
  kruimel.innerHTML = `<span>Werken</span> <span class="pijlje">&rsaquo;</span> <span>Werkbank</span>`;
  document.title = "Werkbank · Delta Blueprint Cockpit";
  inhoud.innerHTML = `<div class="wbladen">Bezig…</div>`;

  // 'Van mij' onthouden we per browser: het is een voorkeur van wie kijkt, geen
  // gegeven over het werk. Komt hij niet terug uit de opslag, dan staat hij op
  // 'van mij' — dat is waar je 's ochtends mee begint.
  let van = "mij";
  try { van = localStorage.getItem("werkbank.van") === "alles" ? "alles" : "mij"; } catch { /* dan mij */ }

  const toestand = { cyclus: null, cycli: [], merk: null, klok: null, bezig: false, van };

  // Het scherm blijft kijken. Niet door de hele rij elke tien seconden opnieuw
  // op te halen — dat is honderd keer zoveel werk voor een antwoord dat meestal
  // 'er is niets veranderd' is — maar door één klein merk op te vragen en de
  // rij alleen te vernieuwen als dat merk anders is.
  //
  // Alleen als het tabblad vooraan staat. Een scherm dat niemand ziet hoeft
  // niets te weten, en een laptop die dicht is al helemaal niet.
  const kijken = () => {
    clearTimeout(toestand.klok);
    if (!leeftNog()) return;
    toestand.klok = setTimeout(async () => {
      if (!leeftNog()) return;
      if (document.visibilityState !== "visible" || toestand.bezig) { kijken(); return; }
      try {
        const nu = await wachtrijStand(toestand.cyclus);
        // Tussen het vragen en het antwoord kan er een scherm verder zijn
        // geklikt. Dan hoort dit antwoord nergens meer thuis.
        if (!leeftNog()) return;
        if (toestand.merk !== null && nu.merk !== toestand.merk) {
          await tekenAlles();
          return;              // tekenAlles start het kijken zelf opnieuw
        }
        toestand.merk = nu.merk;
        toonMotor(nu.motor);
      } catch { /* even geen verbinding; de volgende ronde probeert het weer */ }
      kijken();
    }, 10000);
  };

  // Zodra je terugkomt op het tabblad meteen kijken, niet eerst tien seconden
  // wachten: juist dan wil je weten wat er intussen gebeurd is.
  // Deze luisteraar hangt aan het document en niet aan het scherm, dus hij moet
  // zichzelf opruimen. Zonder dat stapelen ze op: na tien keer de werkbank
  // openen peilen er tien tegelijk.
  const bijTerugkomst = () => {
    if (!leeftNog()) {
      document.removeEventListener("visibilitychange", bijTerugkomst);
      return;
    }
    if (document.visibilityState !== "visible") return;
    clearTimeout(toestand.klok);
    kijken();
    wachtrijStand(toestand.cyclus).then((nu) => {
      if (leeftNog() && toestand.merk !== null && nu.merk !== toestand.merk) tekenAlles();
    }).catch(() => {});
  };
  document.addEventListener("visibilitychange", bijTerugkomst);

  async function tekenAlles() {
    let cycli, wachtrij, achter, baro, stroom, tedoen;
    try {
      ({ cycli } = await werkbankCycli());
      toestand.cycli = cycli;
      if (!toestand.cyclus && cycli.length) toestand.cyclus = cycli[0].id;

      [wachtrij, achter] = await Promise.all([
        haalWachtrij(null, toestand.van), haalAchterstand(),
      ]);
      if (toestand.cyclus) {
        [baro, stroom, tedoen] = await Promise.all([
          haalBarometer(toestand.cyclus),
          haalStroom(toestand.cyclus, 25).then((r) => r.stroom),
          haalTedoen(toestand.cyclus).then((r) => r.stappen).catch(() => []),
        ]);
      }
    } catch (fout) {
      if (!leeftNog()) return;
      inhoud.innerHTML = `<div class="fout">${ontsnap(fout.message)}</div>`;
      return;
    }

    // Het ophalen duurt even. Ben je ondertussen een scherm verder, dan hoort
    // hier niets meer getekend te worden.
    if (!leeftNog()) return;

    const cyclus = toestand.cycli.find((c) => c.id === toestand.cyclus);

    inhoud.innerHTML = `
      <div class="werkbank">
        ${meter(achter, baro, toestand.cyclus)}
        ${ledenvak(wachtrij.kaarten.filter((k) => k.hoek === "leden"))}
        ${takenvak(
          wachtrij.kaarten.filter((k) => k.hoek !== "leden"),
          cyclus, tedoen || [], toestand.van
        )}
        ${cyclus ? stroomvak(cyclus, stroom || []) : ""}
        <p class="wbmotor" id="wbmotor" hidden></p>
      </div>`;

    inhoud.querySelectorAll(".wbvan button").forEach((knop) => {
      knop.addEventListener("click", () => {
        toestand.van = knop.dataset.van;
        try { localStorage.setItem("werkbank.van", toestand.van); } catch { /* dan deze sessie */ }
        tekenAlles();
      });
    });

    bindAlles(wachtrij.kaarten, tekenAlles);

    // Het merk van nu bewaren, zodat de volgende peiling weet waar hij mee
    // vergelijkt. Zonder dit zou het scherm één keer onnodig hertekenen.
    try {
      const nu = await wachtrijStand(toestand.cyclus);
      toestand.merk = nu.merk;
      toonMotor(nu.motor);
    } catch { /* geen ramp; de peiling hierna haalt het in */ }

    kijken();
  }

  await tekenAlles();
}

// ---------------------------------------------------------------- de meter
//
// Eén regel bovenaan, en die gaat over de leden en niet over ons. 'Zeven kaarten
// open' zegt iets over onze drukte; daar wordt niemand buiten dit kantoor beter
// van.
function meter(achter, baro, cyclusId) {
  const stand = baro && baro.wij ? baro.wij : null;
  const leden = baro && baro.leden ? baro.leden : null;

  return `
    <div class="wbmeter">
      <div class="wbachter ${ontsnap(achter.kleur)}">
        <span class="stip"></span>
        <span class="wbzin">${ontsnap(achter.zin)}</span>
      </div>
      ${stand ? `
        <a class="wbbaro" href="#/barometer/${cyclusId}">
          <span class="wblabel">Barometer</span>
          <span class="wbstand k-${ontsnap(stand.stand.kleur)}">${ontsnap(stand.stand.waarde)} · ${ontsnap(stand.stand.label)}</span>
          <span class="wbvenster v-${ontsnap(stand.venster.waarde)}">${ontsnap(stand.venster.label)}</span>
          ${baro.gelijk
            ? ""
            : `<span class="wbnietgemeld" title="${leden ? `De leden zien nog ${ontsnap(leden.stand.label)}.` : "De leden kennen nog geen stand."}">niet gemeld</span>`}
        </a>` : ""}
    </div>`;
}

// De motor meldt zich alleen als er iets aan de hand is.
//
// Dit is de enige storing in dit systeem die zich voordoet als goed nieuws: valt
// de motor stil, dan worden er geen kaarten meer gemaakt en zegt de werkbank
// 'niets dat op jou wacht' — niet te onderscheiden van klaar zijn.
//
// Maar een regel die er altijd staat leer je negeren, en dan doet hij precies
// niet waarvoor hij bestaat. Dus: niets zeggen als het goed gaat. Staat er iets,
// dan is er iets.
function toonMotor(motor) {
  const vak = document.getElementById("wbmotor");
  if (!vak) return;

  const zeg = (woorden, soort, uitleg) => {
    vak.textContent = woorden;
    vak.className = `wbmotor ${soort}`;
    vak.title = uitleg || "";
    vak.hidden = !woorden;
  };

  if (!motor) return zeg("", "");

  if (motor.ooit && !motor.gelukt) {
    return zeg("Motor vastgelopen", "stuk", motor.fout || "Onbekende fout.");
  }

  // Terwijl jij kijkt, draait hij bij elke peiling — dus elke tien seconden. Twee
  // minuten stilte is dan geen vertraging maar een storing.
  const minuten = motor.ooit ? minutenGeleden(motor.wanneer) : null;
  if (!motor.ooit || minuten === null || minuten >= 2) {
    return zeg("Motor stil", "stil",
      motor.ooit
        ? `Laatste ronde ${geleden(motor.wanneer)}. Hij hoort elke tien seconden te draaien zolang dit scherm openstaat.`
        : "Er is nog geen ronde geweest. Blijft dit staan, kijk dan bij Beheer → Motorrondes.");
  }

  // Alles in orde: niets zeggen.
  zeg("", "");
}

function minutenGeleden(wanneer) {
  const d = new Date(`${String(wanneer || "").replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 60000;
}

function geleden(wanneer) {
  const m = minutenGeleden(wanneer);
  if (m === null) return "op een onbekend moment";
  if (m < 1) return "zojuist";
  if (m < 60) return `${Math.round(m)} ${Math.round(m) === 1 ? "minuut" : "minuten"} geleden`;
  const u = Math.round(m / 60);
  if (u < 24) return `${u} uur geleden`;
  const d = Math.round(u / 24);
  return `${d} ${d === 1 ? "dag" : "dagen"} geleden`;
}

function telling(t) {
  return ["hoog", "medium", "laag"]
    .filter((k) => t[k] > 0)
    .map((k) => `<span class="pt p-${k}">${t[k]} ${PRIOLABEL[k].toLowerCase()}</span>`)
    .join("");
}

// ---------------------------------------------------------------- een kaart
//
// De feiten staan over de volle breedte in één grijs vlak en de knoppen eronder,
// rechts. Een grijs vlak dat per kaart een andere breedte heeft omdat er een
// knop meer onder staat, leest als slordigheid.
function kaartHtml(k) {
  const feiten = (k.feiten || []).length
    ? `<div class="wbfeiten">${k.feiten.map((f) =>
        `<div class="wbfeit"><span class="wbfeitlabel">${ontsnap(f.label)}</span><span class="wbfeitwaarde">${ontsnap(f.waarde)}</span></div>`
      ).join("")}</div>`
    : "";

  const knoppen = (k.knoppen || []).map((b) => `
    <button type="button" class="knop ${b.nummer === 1 ? "" : "tweede"}"
            data-kaart="${k.id}" data-knop="${b.nummer}"
            data-doel="${ontsnap(b.doel)}" data-reden="${b.reden_verplicht ? 1 : 0}"
            ${b.wacht_op_ander || !k.van_mij ? "disabled" : ""}>
      ${ontsnap(b.label)}
    </button>`).join("");

  // Wat er al ligt. Zonder deze regel biedt de kaart 'Bericht opstellen' nog een
  // keer aan terwijl het concept allang bij iemand anders ligt.
  const ligt = k.bericht && k.bericht.status !== "verstuurd"
    ? `<p class="wbligt">Bericht ${ontsnap(STATUSWOORD[k.bericht.status] || k.bericht.status)}${
        k.bericht.nalezer ? ` · ${ontsnap(k.bericht.nalezer)}` : ""
      } — <a href="#/bericht/${k.bericht.id}">openen</a></p>`
    : "";

  const bak = k.prullenbak && k.van_mij
    ? `<button type="button" class="ikoonknop wbbak" data-kaart="${k.id}" data-doel="${ontsnap(k.prullenbak.doel)}"
         title="${k.prullenbak.doel === "uitstellen" ? "Uitstellen tot morgen" : "Afsluiten zonder actie"}"
         aria-label="${k.prullenbak.doel === "uitstellen" ? "Uitstellen tot morgen" : "Afsluiten zonder actie"}">${PRULLENBAK}</button>`
    : "";

  return `
    <article class="wbkaart" data-kaart="${k.id}">
      <div class="wbkaartkop">
        <span class="pt p-${ontsnap(k.prioriteit)}">${PRIOLABEL[k.prioriteit] || k.prioriteit}</span>
        <h3>${ontsnap(k.titel)}</h3>
        ${k.waarover ? `<span class="wbwaarover">${ontsnap(k.waarover)}</span>` : ""}
        ${k.van_mij ? "" : `<span class="wbvanwie" title="Deze kaart ligt bij iemand anders">${ontsnap(k.eigenaar)}</span>`}
        <span class="wbouder" title="Staat open sinds ${ontsnap(k.moment)}">${sinds(k.uren_open)}${k.opgeschaald ? " · opgeschaald" : ""}</span>
      </div>
      ${k.reden ? `<p class="wbreden">${ontsnap(k.reden)}</p>` : ""}
      ${feiten}
      ${ligt}
      <div class="wbknoppen">${knoppen}${bak}</div>
      <p class="wbmelding" hidden></p>
    </article>`;
}

// ----------------------------------------------- de twee hoeken van het werk
//
// Er zijn twee soorten werk, en ze hebben niets met elkaar te maken.
//
//   Communicatie naar leden — wat het systeem ziet en de leden nog niet weten.
//     Een positie die veranderde, een barometerstand die nog niet gemeld is, een
//     venster dat achterloopt. Hier hoort de achterstand bij, want die meet
//     precies dit.
//
//   Taken — het werk dat uit het proces komt: charts lezen, voorwaarden meten,
//     stemmen bij een go/no-go. Dat gaat over ons.
//
// Welke kaart waar hoort staat niet in dit bestand: de wachtrij zegt het, op
// grond van waar knop 1 naartoe gaat. Eindigt hij in een bericht, dan gaat het
// over de leden.
//
// Communicatie staat bovenaan als er iets staat, en verdwijnt helemaal als er
// niets staat. Dan begint je ochtend met de leden als dat nodig is, en met je
// eigen werk als het niet nodig is — zonder een lege kop om over te slaan.
function ledenvak(kaarten) {
  if (!kaarten.length) return "";
  return `
    <section class="wbvak wbleden">
      <div class="wbkop">
        <h2>Communicatie naar leden</h2>
        <span class="wbtelling">${telling(tel(kaarten))}</span>
      </div>
      ${kaarten.map(kaartHtml).join("")}
    </section>`;
}

// Taken: de kaarten uit het proces én de processtappen, onder één kop.
//
// Die stonden eerst apart, en dat was een scheiding die niet hoort te bestaan:
// 'Technische analyse' was een kaart en 'Instapvoorwaarden gemeten' een stap,
// allebei proceswerk, twee plekken, twee uiterlijken. Sinds toestandskaarten
// zichzelf sluiten gedragen ze zich ook identiek. Het verschil dat overblijft is
// of er een knop onder staat, en dat zie je aan de kaart zelf.
function takenvak(kaarten, cyclus, stappen, van) {
  const open = stappen.filter((s) => !s.gedaan);
  return `
    <section class="wbvak">
      <div class="wbkop">
        <h2>Taken</h2>
        <div class="wbrechts">
          ${kaarten.length ? `<span class="wbtelling">${telling(tel(kaarten))}</span>` : ""}
          <div class="wbvan" role="group" aria-label="Welke taken">
            <button type="button" class="${van === "mij" ? "aan" : ""}" data-van="mij">Van mij</button>
            <button type="button" class="${van === "alles" ? "aan" : ""}" data-van="alles">Alles</button>
          </div>
        </div>
      </div>
      ${kaarten.map(kaartHtml).join("")}
      ${open.length ? stappenlijst(open) : ""}
      ${!kaarten.length && !open.length
        ? `<p class="wbleeg">${van === "mij" ? "Niets dat op jou wacht." : "Niets te doen."}</p>`
        : ""}
    </section>`;
}

function tel(kaarten) {
  const t = { hoog: 0, medium: 0, laag: 0 };
  for (const k of kaarten) if (t[k.prioriteit] !== undefined) t[k.prioriteit]++;
  return t;
}

// De processtappen: geen vragen die om een antwoord vragen maar toestanden die
// zichzelf oplossen zodra het werk gedaan is. Dus geen knoppen en geen
// prullenbak, alleen de weg ernaartoe.
function stappenlijst(stappen) {
  return `
    <ol class="wbstappen">
      ${stappen.map((s) => `
        <li class="wbstap${s.verplicht ? "" : " optioneel"}">
          <a class="wbstapnaam" href="${ontsnap(s.route)}">${ontsnap(s.naam)}</a>
          ${s.stand ? `<span class="wbstapstand">${ontsnap(s.stand)}</span>` : "<span></span>"}
          <span class="wbstapwaar">${ontsnap(s.waar)}</span>
        </li>`).join("")}
    </ol>`;
}

// ------------------------------------------------------------- de stroom
//
// Niet 'naslag' maar de naam van de cyclus: dit is de geschiedenis van déze
// cyclus en niets anders. Hij staat open, want hij is er om naast de kaarten te
// liggen en niet om opengeklikt te worden.
function stroomvak(cyclus, stroom) {
  return `
    <section class="wbvak">
      <div class="wbkop">
        <h2>${ontsnap(cyclus.label)}</h2>
        <a class="wbdoor" href="#/t/cyclus/${cyclus.id}">naar de cyclus</a>
      </div>
      ${stroom.length
        ? `<ol class="wbstroom">${stroom.map((g) => `
            <li class="wbregel ${g.vraagt_antwoord && !g.beantwoord_op ? "open" : ""}">
              <span class="wbbron b-${ontsnap(g.bron)}">${ontsnap(g.bron === "ibkr" ? "IBKR" : g.bron)}</span>
              <span class="wbtitel">${ontsnap(g.titel)}</span>
              <span class="wbtijd">${ontsnap(String(g.moment || "").slice(0, 16).replace("T", " "))}</span>
            </li>`).join("")}</ol>`
        : `<p class="wbleeg">Nog niets gebeurd in deze cyclus.</p>`}
    </section>`;
}

// ------------------------------------------------------------ de handeling
//
// Eén plek waar een kaart beantwoord wordt, en die plek weet van drie dingen:
// een knop die om een reden vraagt, een knop die een bericht opstelt, en de
// prullenbak. Alle drie eindigen hetzelfde — de kaart is beantwoord en de rij
// wordt opnieuw opgehaald.
// Waar een kaart je heen stuurt. Dit staat hier en niet in de definitielaag,
// want het zijn routes van déze app: een kaartdefinitie hoort niet te weten hoe
// het adres van een scherm eruitziet.
function schermVoor(k) {
  if (!k) return null;
  switch (k.kaartsoort) {
    case "gonogo":        return k.cyclus ? `#/gonogo/${k.cyclus}` : null;
    case "reviewbesluit":
    case "chartlezing":   return k.beoordelingsmoment ? `#/uitkomst/${k.beoordelingsmoment}` : null;
    case "nalezen":       return k.publicatie ? `#/bericht/${k.publicatie}` : null;
    case "venster":       return k.cyclus ? `#/barometer/${k.cyclus}` : null;
    case "herbeoordeling":
    case "maandverslag":  return k.cyclus ? `#/t/cyclus/${k.cyclus}` : null;
    default:              return k.cyclus ? `#/t/cyclus/${k.cyclus}` : null;
  }
}

function bindAlles(kaarten, opnieuw) {
  const bezig = new Set();

  const meld = (kaartId, tekst, soort = "fout") => {
    const vak = document.querySelector(`.wbkaart[data-kaart="${kaartId}"] .wbmelding`);
    if (!vak) return;
    vak.textContent = tekst;
    vak.className = `wbmelding ${soort}`;
    vak.hidden = false;
  };

  const vergrendel = (kaartId, aan) => {
    const kaart = document.querySelector(`.wbkaart[data-kaart="${kaartId}"]`);
    if (!kaart) return;
    kaart.classList.toggle("bezig", aan);
    kaart.querySelectorAll("button").forEach((b) => { b.disabled = aan; });
  };

  // Een knop die om een reden vraagt, krijgt die reden op de kaart zelf. Een
  // venster van de browser dat je moet wegklikken is geen plek om iets te
  // schrijven dat straks in de stroom staat.
  const vraagReden = (kaart, daarna) => {
    if (kaart.querySelector(".wbredenvak")) return;
    const vak = document.createElement("div");
    vak.className = "wbredenvak";
    vak.innerHTML = `
      <label for="wbreden-${kaart.dataset.kaart}">Waarom niet?</label>
      <textarea id="wbreden-${kaart.dataset.kaart}" rows="2" placeholder="Eén regel is genoeg."></textarea>
      <div class="wbredenknoppen">
        <button type="button" class="knop tweede wbredenaf">Terug</button>
        <button type="button" class="knop wbredenok">Vastleggen</button>
      </div>`;
    kaart.querySelector(".wbknoppen").insertAdjacentElement("afterend", vak);
    const veld = vak.querySelector("textarea");
    veld.focus();
    vak.querySelector(".wbredenaf").addEventListener("click", () => vak.remove());
    vak.querySelector(".wbredenok").addEventListener("click", () => {
      const tekst = veld.value.trim();
      if (!tekst) { veld.focus(); return; }
      vak.remove();
      daarna(tekst);
    });
  };

  const antwoord = async (kaartId, body) => {
    if (bezig.has(kaartId)) return;
    bezig.add(kaartId);
    vergrendel(kaartId, true);
    try {
      await beantwoordKaart(kaartId, body);
      await opnieuw();
    } catch (fout) {
      meld(kaartId, fout.message);
      vergrendel(kaartId, false);
    } finally {
      bezig.delete(kaartId);
    }
  };

  document.querySelectorAll(".wbkaart .wbknoppen .knop").forEach((knop) => {
    knop.addEventListener("click", async () => {
      const kaartId = Number(knop.dataset.kaart);
      const nummer = Number(knop.dataset.knop);
      const doel = knop.dataset.doel;
      const kaart = knop.closest(".wbkaart");

      // Een bericht opstellen is geen antwoord maar een begin: er wordt een
      // concept klaargezet en je gaat erheen om het na te lezen. De kaart gaat
      // pas dicht als het bericht verstuurd is.
      if (doel === "publicatie") {
        if (bezig.has(kaartId)) return;
        bezig.add(kaartId);
        vergrendel(kaartId, true);
        try {
          const uit = await conceptUitKaart(kaartId);
          location.hash = `#/bericht/${uit.publicatie}`;
        } catch (fout) {
          meld(kaartId, fout.message);
          vergrendel(kaartId, false);
        } finally {
          bezig.delete(kaartId);
        }
        return;
      }

      // Een scherm openen is ook geen antwoord: je gaat er iets doen, en de
      // kaart gaat dicht als dat gedaan is.
      if (doel === "scherm") {
        const k = kaarten.find((x) => x.id === kaartId);
        const heen = schermVoor(k);
        if (heen) location.hash = heen;
        else meld(kaartId, "Voor deze kaart bestaat het scherm nog niet.", "waarschuwing");
        return;
      }

      if (knop.dataset.reden === "1") {
        vraagReden(kaart, (reden) => antwoord(kaartId, { knop: nummer, reden }));
        return;
      }
      antwoord(kaartId, { knop: nummer });
    });
  });

  document.querySelectorAll(".wbkaart .wbbak").forEach((knop) => {
    knop.addEventListener("click", () => {
      antwoord(Number(knop.dataset.kaart), { doel: knop.dataset.doel });
    });
  });
}
