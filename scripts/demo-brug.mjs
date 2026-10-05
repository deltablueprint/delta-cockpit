// De brug naspelen, zolang hij nog niet bestaat.
//
//   DOEL=https://delta-cockpit-staging.<jouw-subdomein>.workers.dev \
//   BRUG_SLEUTEL=... \
//   node scripts/demo-brug.mjs open
//
//   ... node scripts/demo-brug.mjs dicht
//
// Dit stuurt precies het pakket dat de echte brug zou sturen: de stand van de
// rekening, wat er open staat, en wat er is uitgevoerd. De cockpit doet er
// daarna hetzelfde mee — spiegelen, een concept klaarzetten, een kaart maken.
//
// De sleutel komt uit de omgeving en staat nergens in dit bestand. Zet hem voor
// één commando (`BRUG_SLEUTEL=... node ...`) of exporteer hem in je shell; schrijf
// hem niet in een bestand dat in git terechtkomt.

const DOEL = process.env.DOEL;
const SLEUTEL = process.env.BRUG_SLEUTEL;
const wat = process.argv[2] || "open";

if (!DOEL || !SLEUTEL) {
  console.error("Zet DOEL en BRUG_SLEUTEL in de omgeving. Zie de kop van dit bestand.");
  process.exit(1);
}

// Eén contract, met een vast conid zodat 'open' en 'dicht' over dezelfde tranche
// gaan. 20NOV26, want een expiratie in het verleden leest verwarrend terug.
const CONID = "999000001";
const CONTRACT = "OESX 20NOV26 5200 PUT";

const positie = {
  conid: CONID, contract: CONTRACT, onderliggend: "OESX", soort: "optie",
  strike: 5200, expiratiedatum: "2026-11-20", putcall: "P", multiplier: 10,
  aantal: -2, gem_kostprijs: 18, marktprijs: 18, waarde: -360,
  ongerealiseerd: 0, gerealiseerd: 0, biedprijs: 17.5, laatprijs: 18.5,
};

const nu = new Date().toISOString().slice(0, 19).replace("T", " ");

const pakketten = {
  // Een tranche die opent: hij staat open, en er is een verkoop uitgevoerd.
  open: {
    verbonden: true, rekening: "DU-SIMULATIE", kapitaal: 420000,
    posities: [positie],
    gebeurtenissen: [{
      soort: "uitvoering", conid: CONID, contract: CONTRACT, richting: "verkoop",
      aantal: 2, prijs: 18, uitvoering_id: `demo-open-${Date.now()}`, moment: nu,
    }],
  },
  // En dicht: hij staat er niet meer bij, met een terugkoop als uitvoering.
  // De cockpit spiegelt wat er binnenkomt — wat er niet bij zit, staat niet
  // meer open.
  dicht: {
    verbonden: true, rekening: "DU-SIMULATIE", kapitaal: 420000,
    posities: [],
    gebeurtenissen: [{
      soort: "uitvoering", conid: CONID, contract: CONTRACT, richting: "koop",
      aantal: 2, prijs: 4, uitvoering_id: `demo-dicht-${Date.now()}`, moment: nu,
    }],
  },
  // Alleen een hartslag: niets veranderd. Hiermee zie je dat de motor draait
  // zonder dat er iets gebeurt.
  tik: { verbonden: true, rekening: "DU-SIMULATIE", kapitaal: 420000, posities: [positie], gebeurtenissen: [] },
};

const pakket = pakketten[wat];
if (!pakket) {
  console.error(`Onbekend: ${wat}. Kies open, dicht of tik.`);
  process.exit(1);
}

const antwoord = await fetch(`${DOEL.replace(/\/$/, "")}/api/brug`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-brug-sleutel": SLEUTEL },
  body: JSON.stringify(pakket),
});

const tekst = await antwoord.text();
if (!antwoord.ok) {
  console.error(`${antwoord.status}: ${tekst.slice(0, 300)}`);
  process.exit(1);
}

try {
  const uit = JSON.parse(tekst);
  console.log(`${wat}: ${uit.posities} positie(s), ${uit.gebeurtenissen} uitvoering(en)`);
  if (uit.gespiegeld) {
    console.log(`gespiegeld: ${uit.gespiegeld.geopend} geopend, ${uit.gespiegeld.gesloten} gesloten`);
  }
} catch {
  console.log(tekst.slice(0, 300));
}
