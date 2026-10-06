// De tijdas van een cyclus: de looptijd met de events erop.
//
// Eén as, twee schermen. Op *Uitkomst samen bepalen* staat eronder wat ieder zou
// schrijven; in Dispatch staat hij tussen de stand en de posities. Twee keer
// dezelfde as tekenen zou betekenen dat een event op het ene scherm anders ligt
// dan op het andere — en dan gaat iemand de verkeerde week vergelijken.
//
// Wat hier niet staat: wie wat vindt. Dat is het verhaal van het besluitscherm.
import { ontsnap, toonDatum } from "./veld.js";

const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const dag = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`) : null);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const kortDatum = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  return m ? `${Number(m[3])} ${MND[Number(m[2]) - 1]}` : String(s);
};

const RANG = { zwaar: 3, middel: 2, licht: 1 };
const KLEUR = {
  rood: ["#A1281F", "#FBE6E3"], oranje: ["#8A5A00", "#FBEFD8"], grijs: ["#595349", "#EDEAE3"],
};
const KLEURBADGE = { zwaar: "rood", middel: "oranje", licht: "grijs" };
const badge = (tekst, kleur = "grijs") => {
  const [fg, bg] = KLEUR[kleur] || KLEUR.grijs;
  return `<span class="badge" style="color:${fg};background:${bg}">${ontsnap(tekst)}</span>`;
};

// Een as maken: geeft plek() terug om er zelf dingen op te zetten, en de HTML
// van de as zelf.
export function tijdas({ van, tot, events = [], extra = [], nu = null }) {
  const vandaag = nu || iso(Date.now());
  const begin = Math.min(
    dag(van) || Infinity,
    ...events.map((e) => dag(e.datum) || Infinity),
    dag(vandaag)
  );
  const eind = Math.max(
    dag(tot) || 0,
    ...events.map((e) => dag(e.datum) || 0),
    ...extra.map((d) => dag(d) || 0),
    begin + 86400000
  );

  const plek = (d) => {
    const t = dag(d);
    if (!t) return null;
    return Math.max(0, Math.min(100, ((t - begin) / (eind - begin)) * 100));
  };
  const rand = (p) => (p < 6 ? " randlinks" : p > 94 ? " randrechts" : "");

  // De datumlinialen: elke vrijdag en elke laatste dag van de maand krijgt een
  // datum — dat zijn de dagen waarop week- en maandopties aflopen. Liggen twee
  // labels te dicht op elkaar, dan wint het maandeinde.
  const liniaal = (() => {
    const kandidaat = new Map();
    const zet = (d, pri) => { if ((kandidaat.get(d) || 0) < pri) kandidaat.set(d, pri); };
    const loop = new Date(begin);
    while (loop.getTime() <= eind) {
      const d = iso(loop.getTime());
      const morgen = new Date(loop.getTime());
      morgen.setUTCDate(morgen.getUTCDate() + 1);
      if (morgen.getUTCMonth() !== loop.getUTCMonth()) zet(d, 3);
      else if (loop.getUTCDay() === 5) zet(d, 2);
      loop.setUTCDate(loop.getUTCDate() + 1);
    }
    zet(iso(begin), 1);
    zet(iso(eind), 1);
    const alle = [...kandidaat.entries()]
      .map(([d, pri]) => ({ d, pri, p: plek(d) }))
      .sort((a, b) => a.p - b.p);
    const uit = [];
    for (const k of alle) {
      const botst = uit.find((g) => Math.abs(g.p - k.p) < 4.5);
      if (!botst) uit.push(k);
      else if (k.pri > botst.pri) uit[uit.indexOf(botst)] = k;
    }
    // Waar 'vandaag' staat, hoeft geen tweede datum te staan.
    const nuP = plek(vandaag) ?? -99;
    return uit.filter((k) => Math.abs(k.p - nuP) > 4.5).sort((a, b) => a.p - b.p);
  })();

  // Events op dezelfde dag worden één punt: anders staan er drie bolletjes over
  // elkaar en is er niets meer aan te wijzen. De hoverkaart draagt ze alle drie.
  const perDag = new Map();
  for (const e of events) {
    if (plek(e.datum) === null) continue;
    if (!perDag.has(e.datum)) perDag.set(e.datum, []);
    perDag.get(e.datum).push(e);
  }
  const zwaarste = (lijst) =>
    lijst.reduce((z, e) => ((RANG[e.zwaarte] || 0) > (RANG[z] || 0) ? e.zwaarte : z), "licht");

  const kaartregels = (lijst) => lijst.map((e) => `
    <span class="tijdkaartitem">
      <b>${ontsnap(e.naam)}</b>
      <span class="tijdkaartregel">${badge(e.zwaarte || "niet gewogen", KLEURBADGE[e.zwaarte] || "grijs")}
        <span class="faint">${ontsnap(e.soort || "")}${
          e.tijdstip ? ` · ${ontsnap(e.tijdstip)}${e.tijdzone ? ` ${ontsnap(e.tijdzone)}` : ""}` : ""}</span></span>
      ${e.notities ? `<span class="tijdkaartnoot">${ontsnap(e.notities)}</span>` : ""}
    </span>`).join("");

  const punten = [...perDag.entries()].map(([datum, lijst]) => {
    const p = plek(datum);
    return `<span class="tijdpunt ${zwaarste(lijst)}${lijst.length > 1 ? " meer" : ""}"
      style="left:${p}%" data-datum="${ontsnap(datum)}" tabindex="0">
      ${lijst.length > 1 ? `<i class="tijdaantal">${lijst.length}</i>` : ""}
      <span class="tijdkaart${rand(p)}">
        <span class="tijdkaartkop">${ontsnap(toonDatum(datum))}${
          lijst.length > 1 ? ` · ${lijst.length} events` : ""}</span>
        ${kaartregels(lijst)}
      </span></span>`;
  }).join("");

  const vandaagP = plek(vandaag) ?? 0;
  const asHtml = `
    <div class="tijdrij asrij">
      <div class="tijdnaam"></div>
      <div class="tijdspoor">
        ${liniaal.map((k) => `<span class="tijdijk${k.pri === 3 ? " maand" : ""}${rand(k.p)}"
          style="left:${k.p}%">${ontsnap(kortDatum(k.d))}<i></i></span>`).join("")}
        <div class="tijdas"></div>
        <span class="vandaag${rand(vandaagP)}" style="left:${vandaagP}%"></span>
        ${punten}
      </div>
    </div>`;

  return { plek, rand, vandaag, vandaagP, asHtml };
}

// De hoverkaart op de tijdlijn zweeft boven alles.
//
// Als gewone absolute kaart werd hij geknipt door het paneel waar de tijdlijn in
// staat, en verdween hij onder de tabellen eronder: bij vijf events zag je er
// twee. Daarom staat hij op 'fixed' — dan geldt geen enkele ouder meer — en
// rekent dit uit waar hij komt.
//
// Dat kan niet in CSS: 'fixed' rekent vanaf het scherm, en waar een punt op het
// scherm staat weet je pas op het moment dat je eroverheen gaat.
export function plaatsTijdkaarten(inhoud) {
  const MARGE = 10;

  const plaats = (punt) => {
    const kaart = punt.querySelector(".tijdkaart");
    if (!kaart) return;

    // Even tonen om te kunnen meten; hij is nog doorzichtig voor het oog niet
    // ziet dat hij heen en weer springt.
    kaart.style.visibility = "hidden";
    kaart.style.display = "block";
    const stip = punt.getBoundingClientRect();
    const breed = kaart.offsetWidth || 280;
    const hoog = kaart.offsetHeight;

    // Links/rechts: gecentreerd onder de stip, maar nooit buiten het scherm.
    let links = stip.left + stip.width / 2 - breed / 2;
    links = Math.max(MARGE, Math.min(links, window.innerWidth - breed - MARGE));

    // Onder de stip als het past, anders erboven. Past het nergens helemaal,
    // dan tegen de onderrand — de kaart scrollt dan zelf.
    const onder = stip.bottom + 8;
    const boven = stip.top - hoog - 8;
    let top = onder;
    if (onder + hoog > window.innerHeight - MARGE) {
      top = boven >= MARGE ? boven : Math.max(MARGE, window.innerHeight - hoog - MARGE);
    }

    kaart.style.left = `${Math.round(links)}px`;
    kaart.style.top = `${Math.round(top)}px`;
    kaart.style.display = "";
    kaart.style.visibility = "";
  };

  for (const punt of inhoud.querySelectorAll(".tijdpunt")) {
    if (!punt.querySelector(".tijdkaart")) continue;
    // Met de muis én met het toetsenbord: een tijdlijn die je alleen met een
    // muis kunt lezen, kun je niet lezen.
    punt.tabIndex = 0;
    punt.addEventListener("mouseenter", () => plaats(punt));
    punt.addEventListener("focus", () => plaats(punt));
  }
}

// De hovertip op een vakje van de strook zweeft boven alles.
//
// Als gewone absolute tip werd hij geknipt door de kolom waarin het scherm
// scrolt: ging je over een vakje aan de linkerrand, dan verdween de helft van de
// tekst achter de navigator. Daarom staat hij op 'fixed' — dan geldt geen enkele
// ouder meer — en rekent dit uit waar hij komt. Eén tip voor het hele scherm:
// er is er altijd maar één tegelijk te zien.
export function plaatsStrooktips(wortel) {
  let tip = document.getElementById("strooktip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "strooktip";
    tip.className = "zweeftip";
    document.body.appendChild(tip);
  }
  const verberg = () => { tip.style.display = "none"; };
  verberg();

  const toon = (vak) => {
    tip.textContent = vak.getAttribute("data-tip") || "";
    if (!tip.textContent) return verberg();
    tip.style.display = "block";
    const r = vak.getBoundingClientRect();
    const breed = tip.offsetWidth, hoog = tip.offsetHeight;
    let links = r.left + r.width / 2 - breed / 2;
    links = Math.max(8, Math.min(links, window.innerWidth - breed - 8));
    const boven = r.top - hoog - 7;
    tip.style.left = `${Math.round(links)}px`;
    tip.style.top = `${Math.round(boven < 8 ? r.bottom + 7 : boven)}px`;
  };

  for (const vak of wortel.querySelectorAll(".strook i[data-tip]")) {
    vak.addEventListener("mouseenter", () => toon(vak));
    vak.addEventListener("mouseleave", verberg);
  }
  wortel.addEventListener("scroll", verberg, true);
}
