// De avatar: een kleine ronde afbeelding, of de initialen in de eigen kleur
// als iemand nog geen foto heeft gekozen.

import { ontsnap } from "./veld.js";

// Eén letter: de eerste van de naam.
export function initialen(naam) {
  return String(naam || "?").trim().charAt(0).toUpperCase() || "?";
}

export function avatar(persoon, maat = 22) {
  if (!persoon) return "";
  const stijl = `width:${maat}px;height:${maat}px;font-size:${Math.round(maat * 0.42)}px`;
  if (persoon.avatar) {
    return `<span class="avatar" style="${stijl}"><img src="${ontsnap(persoon.avatar)}" alt=""></span>`;
  }
  return `<span class="avatar letters" style="${stijl};background:${ontsnap(persoon.kleur || "#136289")}">${
    ontsnap(initialen(persoon.korte_naam || persoon.naam))
  }</span>`;
}

// Met naam ernaast, zoals in een lijstcel.
export function avatarMetNaam(persoon, naam) {
  if (!persoon && !naam) return `<span class="faint">&mdash;</span>`;
  return `<span class="persoon">${avatar(persoon, 20)}<span>${ontsnap(persoon ? (persoon.korte_naam || persoon.naam) : naam)}</span></span>`;
}

// Een gekozen bestand verkleinen tot een vierkante thumbnail, zodat er nooit
// een foto van vier megabyte in de database belandt.
export function verklein(bestand, maat = 128) {
  return new Promise((klaar, mis) => {
    const lezer = new FileReader();
    lezer.onerror = () => mis(new Error("Kan het bestand niet lezen."));
    lezer.onload = () => {
      const afbeelding = new Image();
      afbeelding.onerror = () => mis(new Error("Dat is geen afbeelding."));
      afbeelding.onload = () => {
        const doek = document.createElement("canvas");
        doek.width = doek.height = maat;
        const t = doek.getContext("2d");
        const kant = Math.min(afbeelding.width, afbeelding.height);
        t.drawImage(
          afbeelding,
          (afbeelding.width - kant) / 2, (afbeelding.height - kant) / 2, kant, kant,
          0, 0, maat, maat
        );
        klaar(doek.toDataURL("image/jpeg", 0.82));
      };
      afbeelding.src = lezer.result;
    };
    lezer.readAsDataURL(bestand);
  });
}
