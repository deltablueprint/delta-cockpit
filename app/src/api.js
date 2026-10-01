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

async function haal(pad, opties = {}) {
  const basic = sessionStorage.getItem(SLEUTEL);
  const antwoord = await fetch(pad, {
    method: opties.methode || "GET",
    headers: {
      ...(basic ? { authorization: `Basic ${basic}` } : {}),
      ...(opties.body ? { "content-type": "application/json" } : {}),
    },
    body: opties.body ? JSON.stringify(opties.body) : undefined,
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
export const lijst = (tabel, params) =>
  haal(`/api/t/${tabel}${params && [...params].length ? "?" + params : ""}`);

export const archiveer = (tabel, ids, reden) =>
  haal(`/api/t/${tabel}/archiveer`, { methode: "POST", body: { ids, reden } });

export const dupliceer = (tabel, id) =>
  haal(`/api/t/${tabel}/${id}/dupliceer`, { methode: "POST" });
