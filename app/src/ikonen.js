// De iconenset voor favorieten.
//
// Eén vaste set, want een favoriet herken je aan zijn vorm voordat je zijn naam
// leest — en dat werkt alleen als de vormen uit elkaar liggen. Alles is één
// lijnbreedte, één raster van 24 bij 24, geen vlakken: zo blijven ze leesbaar
// op twaalf pixels in de navigatiekolom.

const p = (d) => `<path d="${d}"/>`;

export const IKONEN = {
  lijst:      p("M4 6h16M4 12h16M4 18h16"),
  tabel:      p("M3 5h18v14H3zM3 10h18M9 10v9"),
  record:     p("M6 3h9l3 3v15H6zM15 3v3h3M9 12h6M9 16h6"),
  ster:       p("M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"),
  vlag:       p("M5 21V4h9l-1 3h6l-2 4 2 4h-9l-1-3H5"),
  kalender:   p("M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"),
  klok:       p("M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4.5l3 1.8"),
  grafiek:    p("M4 20V4M4 20h16M8 16v-5M12 16V7M16 16v-8"),
  trend:      p("M4 16l5-5 3 3 7-7M15 7h5v5"),
  weegschaal: p("M12 5v15M7 20h10M4 8.5h16M4 8.5l-2.5 5h5zM20 8.5l-2.5 5h5z"),
  euro:       p("M16.5 7a6 6 0 100 10M4 11h8M4 14h8"),
  doel:       p("M12 4a8 8 0 100 16 8 8 0 000-16zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"),
  slot:       p("M6 11h12v9H6zM9 11V8a3 3 0 016 0v3"),
  oog:        p("M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"),
  bel:        p("M6 17V11a6 6 0 1112 0v6l2 2H4zM10 21h4"),
  bliksem:    p("M13 3L5 13h6l-1 8 8-10h-6z"),
  persoon:    p("M12 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM4.5 20a7.5 7.5 0 0115 0"),
  groep:      p("M9 5a3 3 0 100 6 3 3 0 000-6zM2.5 19a6.5 6.5 0 0113 0M17 7.5a2.8 2.8 0 100 5.6M17 14a5.5 5.5 0 014.5 5"),
  map:        p("M3 6h6l2 2h10v11H3z"),
  document:   p("M6 3h9l3 3v15H6zM9 9h4M9 13h6M9 17h6"),
  tag:        p("M3 11V4h7l10 10-7 7zM7.5 7.5h.01"),
  schuiven:   p("M4 7h7M15 7h5M4 12h11M19 12h1M4 17h3M11 17h9M13 5v4M17 10v4M9 15v4"),
  filter:     p("M3 5h18l-7 8v6l-4 2v-8z"),
  zoeken:     p("M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l4.5 4.5"),
  vink:       p("M4 12.5l5 5L20 6.5"),
  waarschuw:  p("M12 4L2.5 20h19zM12 10v4.5M12 17.5h.01"),
  omhoog:     p("M12 20V5M6 11l6-6 6 6"),
  omlaag:     p("M12 4v15M6 13l6 6 6-6"),
  boek:       p("M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2zM9 3v18"),
  koffer:     p("M3 8h18v12H3zM9 8V5h6v3M3 13h18"),
};

export const IKOONNAMEN = Object.keys(IKONEN);

export function ikoon(naam, maat = 16) {
  const d = IKONEN[naam] || IKONEN.lijst;
  return `<svg viewBox="0 0 24 24" width="${maat}" height="${maat}" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

// De kleuren van een favoriet. Ze zijn er om uit elkaar te houden, niet om te
// versieren: één verzadigde tint per kleur, allemaal even donker, zodat geen
// enkele favoriet harder roept dan een andere.
export const KLEUREN = {
  blauw:     "#1F6FA8",
  groen:     "#2E7D4F",
  oranje:    "#C27A16",
  rood:      "#B23A2E",
  paars:     "#6B4FA8",
  turkoois:  "#17807D",
  roze:      "#B23A72",
  grijs:     "#5F5A51",
};
export const KLEURNAMEN = Object.keys(KLEUREN);
