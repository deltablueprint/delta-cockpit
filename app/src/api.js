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
    // De worker antwoordt altijd in JSON, ook bij een fout. Die melding is in
    // het Nederlands geschreven voor wie hem leest; die tonen we dus, niet de
    // ruwe tekst van het antwoord.
    const tekst = await antwoord.text();
    let melding = `Fout ${antwoord.status}: ${tekst.slice(0, 200)}`;
    try {
      const uit = JSON.parse(tekst);
      if (uit && uit.fout) melding = uit.fout;
    } catch { /* geen JSON; dan de ruwe tekst */ }
    const e = new Error(melding);
    e.code = antwoord.status;
    throw e;
  }
  return antwoord.json();
}

export const ik = () => haal("/api/ik");
export const meta = () => haal("/api/meta");
export const gezondheid = () => haal("/api/gezondheid");
export const lijst = (tabel, params) =>
  haal(`/api/t/${tabel}${params && [...params].length ? "?" + params : ""}`);

export const record = (tabel, id) => haal(`/api/t/${tabel}/${id}`);

export const bewaar = (tabel, id, velden, revisie, reden) =>
  haal(`/api/t/${tabel}/${id}`, { methode: "PATCH", body: { velden, revisie, reden } });

export const stappenVan = (tabel, id) => haal(`/api/t/${tabel}/${id}/stappen`);

export const bewaarSamen = (tabel, ids, velden, revisies) =>
  haal(`/api/t/${tabel}/samen`, { methode: "POST", body: { ids, velden, revisies } });

export const archiveer = (tabel, ids, reden) =>
  haal(`/api/t/${tabel}/archiveer`, { methode: "POST", body: { ids, reden } });

export const maakAan = (tabel, velden, ouderkolom) =>
  haal(`/api/t/${tabel}`, { methode: "POST", body: { velden, ouderkolom } });

export const importVoorbereiden = (rijen) =>
  haal("/api/import/event/voorbereiden", { methode: "POST", body: { rijen } });

export const importUitvoeren = (regels) =>
  haal("/api/import/event/uitvoeren", { methode: "POST", body: { regels } });

export const leesVoorkeur = (sleutel) => haal(`/api/voorkeur/${sleutel}`);
export const zetVoorkeur = (sleutel, waarde) =>
  haal(`/api/voorkeur/${sleutel}`, { methode: "PUT", body: { waarde } });

export const zetAvatar = (avatar) =>
  haal("/api/ik/avatar", { methode: "PATCH", body: { avatar } });

export const nieuwSjabloon = (tabel, ouder) =>
  haal(`/api/t/${tabel}/nieuw${ouder ? `?ouder=${ouder.tabel}:${ouder.id}` : ""}`);

// ---- de go/no-go (etappe 10) ----
export const gonogoStand = (cyclus) => haal(`/api/gonogo/${cyclus}`);
export const gonogoMoment = (cyclus, body = {}) =>
  haal(`/api/gonogo/${cyclus}/moment`, { methode: "POST", body });
export const gonogoVersturen = (cyclus, body) =>
  haal(`/api/gonogo/${cyclus}/versturen`, { methode: "POST", body });
export const gonogoUitkomst = (cyclus, body) =>
  haal(`/api/gonogo/${cyclus}/uitkomst`, { methode: "POST", body });

// Wat er bij de broker open staat (etappe 11). Lezend.
export const lynxPosities = () => haal("/api/lynx/posities");

// Voorwaarden overnemen uit eerdere cycli.
export const voorwaardeSjablonen = (cyclus) => haal(`/api/voorwaarde/sjablonen/${cyclus}`);
export const voorwaardenOvernemen = (cyclus, sleutels) =>
  haal(`/api/voorwaarde/overnemen/${cyclus}`, { methode: "POST", body: { sleutels } });
