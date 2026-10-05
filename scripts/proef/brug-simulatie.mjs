// De brug nabootsen: een stand naar de cockpit duwen zoals brug.mjs dat doet.
//
//   COCKPIT_URL=https://delta-cockpit-staging.<jouw>.workers.dev \
//   BRUG_SLEUTEL=... \
//   node scripts/proef/brug-simulatie.mjs <stap>
//
// Let op hoe de brug werkt: elke zending draagt het hele positiebeeld. Wat er
// niet bij zit, staat niet meer open. Daarom noemt elke stap hieronder álle
// posities die op dat moment bij de broker staan — ook die van het andere
// scenario. Eén gemiste positie zou de cockpit laten denken dat die tranche
// gesloten is.
//
// De stappen:
//   start      beide tranches staan open             — niets aan de hand
//   a-gerold   tranche A teruggekocht en doorgerold  — scenario 1 (aangekondigd)
//   b-gerold   tranche B teruggekocht en doorgerold  — scenario 2 (noodhandeling)
//   b-dicht    tranche B alleen teruggekocht         — zonder nieuw contract

const url = process.env.COCKPIT_URL;
const sleutel = process.env.BRUG_SLEUTEL;
if (!url || !sleutel) {
  console.error("Zet COCKPIT_URL en BRUG_SLEUTEL in je omgeving.");
  process.exit(1);
}

const positie = (conid, contract, strike, expiratie, kostprijs, markt) => ({
  conid, contract, onderliggend: "OESX", soort: "OPT", strike,
  expiratiedatum: expiratie, putcall: "P", multiplier: 10, aantal: -2,
  gem_kostprijs: kostprijs, marktprijs: markt, biedprijs: markt - 0.4, laatprijs: markt + 0.4,
});

const A_OUD   = positie("9000001", "OESX 30OKT26 5600 PUT", 5600, "2026-10-30", 38.5, 12);
const A_NIEUW = positie("9000002", "OESX 20NOV26 5500 PUT", 5500, "2026-11-20", 41, 41);
const B_OUD   = positie("9000011", "OESX 30OKT26 5700 PUT", 5700, "2026-10-30", 44, 9.5);
const B_NIEUW = positie("9000012", "OESX 20NOV26 5400 PUT", 5400, "2026-11-20", 36, 36);

const nu = () => new Date().toISOString().slice(0, 16).replace("T", " ");
const fill = (p, richting, prijs, merk) => ({
  soort: "uitvoering", conid: p.conid, contract: p.contract, richting,
  aantal: 2, prijs, uitvoering_id: `sim-${merk}-${Date.now()}`, moment: nu(),
});

const stappen = {
  start: () => ({ posities: [A_OUD, B_OUD], gebeurtenissen: [] }),

  "a-gerold": () => ({
    posities: [A_NIEUW, B_OUD],
    gebeurtenissen: [fill(A_OUD, "koop", 12, "a-sluit"), fill(A_NIEUW, "verkoop", 41, "a-open")],
  }),

  "b-gerold": () => ({
    posities: [A_NIEUW, B_NIEUW],
    gebeurtenissen: [fill(B_OUD, "koop", 9.5, "b-sluit"), fill(B_NIEUW, "verkoop", 36, "b-open")],
  }),

  "b-dicht": () => ({
    posities: [A_NIEUW],
    gebeurtenissen: [fill(B_OUD, "koop", 9.5, "b-sluit")],
  }),
};

const stap = process.argv[2];
if (!stappen[stap]) {
  console.error(`Kies een stap: ${Object.keys(stappen).join(", ")}`);
  process.exit(1);
}

const antwoord = await fetch(`${url.replace(/\/$/, "")}/api/brug`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-brug-sleutel": sleutel },
  body: JSON.stringify({ verbonden: true, rekening: "DU-SIMULATIE", kapitaal: 420000, ...stappen[stap]() }),
});
const uit = await antwoord.json().catch(() => ({}));
console.log(`${antwoord.status} ${antwoord.statusText}`);
console.log(JSON.stringify(uit, null, 2));
