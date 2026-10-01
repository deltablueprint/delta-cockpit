// De koppeling met Lynx — lezend, nooit schrijvend.
//
// Het systeem plaatst nooit een order (hard uitgangspunt 1). Wat het wél doet
// is kijken wat er bij de broker open staat, zodat een tranche niet met de
// hand overgetypt hoeft te worden: jij wijst de juiste positie aan en het
// systeem neemt contract, strike, expiratie, aantal en premie over.
//
// De koppeling zelf is er nog niet (etappe 12, openstaand punt 6: welke weg —
// IBKR Web API, FlexQuery of TWS). Dit eindpunt bestaat al wel, zodat het
// scherm er niet op hoeft te wachten: het zegt eerlijk dat er geen koppeling
// is in plaats van te doen alsof er niets open staat.

export async function openPosities(env) {
  // Zodra de koppeling er is, komt hier het antwoord van de broker vandaan.
  // De vorm blijft dezelfde: een lijst met wat je nodig hebt om te kiezen.
  return {
    koppeling: false,
    reden: "Er is nog geen koppeling met Lynx. Vul de tranche zolang met de hand in; zodra de koppeling er is, kies je hier de juiste positie en vult het systeem de velden.",
    posities: [],
  };
}
