// Eén datalaagje tussen app en worker, één functie per eindpunt (BOUWSPEC 12).
// De gegevens om aan te melden blijven in het geheugen van dit tabblad staan:
// sessionStorage, niet localStorage, zodat ze verdwijnen als je het tabblad sluit.

const SLEUTEL = "delta-aanmelding";

export function aanmeldingOpslaan(email, wachtwoord) {
  sessionStorage.setItem(SLEUTEL, btoa(unescape(encodeURIComponent(`${email}:${wachtwoord}`))));
}

export function aanmeldingWissen() {
  sessionStorage.removeItem(SLEUTEL);
}

export function isAangemeld() {
  return !!sessionStorage.getItem(SLEUTEL);
}

async function haal(pad) {
  const basic = sessionStorage.getItem(SLEUTEL);
  const antwoord = await fetch(pad, {
    headers: basic ? { authorization: `Basic ${basic}` } : {},
  });
  if (antwoord.status === 401) {
    aanmeldingWissen();
    const e = new Error("Niet herkend. Controleer je e-mailadres en wachtwoord.");
    e.code = 401;
    throw e;
  }
  if (!antwoord.ok) {
    const tekst = await antwoord.text();
    throw new Error(`Fout ${antwoord.status}: ${tekst.slice(0, 200)}`);
  }
  return antwoord.json();
}

export const ik = () => haal("/api/ik");
export const meta = () => haal("/api/meta");
export const gezondheid = () => haal("/api/gezondheid");
