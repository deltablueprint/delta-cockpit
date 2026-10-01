// De koppeling met Lynx — lezend, nooit schrijvend.
//
// Het systeem plaatst nooit een order (hard uitgangspunt 1). Wat het wél doet
// is kijken wat er bij de broker open staat, zodat een tranche niet met de
// hand overgetypt hoeft te worden.
//
// De weg is de Flex Web Service van IBKR: een rapport dat met een token wordt
// opgehaald. Geen sessie die verloopt, geen machine die moet draaien, en geen
// enkel eindpunt dat kan schrijven — dat laatste is geen toeval maar de reden
// dat deze weg gekozen is (BOUWSPEC 12).
//
// Ophalen gaat in twee stappen: SendRequest levert een referentiecode, en
// GetStatement levert daarmee de XML. Het rapport is een paar minuten oud;
// voor het vastleggen van een uitvoering is dat genoeg, voor het bewaken van
// een stoploss niet — dat is een andere bron.

// IBKR heeft twee adressen voor dezelfde dienst; welke werkt verschilt per
// account. We proberen de nieuwe en vallen terug op de oude, in plaats van te
// gokken welke het bij jou is.
const SEND = [
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest",
  "https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest",
];
const GET_TERUGVAL = "https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement";
const KOP = { "user-agent": "Java/DeltaBlueprintCockpit", accept: "application/xml" };

// Het antwoord is XML met gegevens in attributen. Een volledige parser is hier
// niet nodig en in een worker ook niet voorhanden: we lezen de elementen die
// we kennen, en alleen die.
function attributen(tekst) {
  const uit = {};
  for (const m of tekst.matchAll(/([A-Za-z_][\w.]*)="([^"]*)"/g)) uit[m[1]] = m[2];
  return uit;
}

function elementen(xml, naam) {
  const uit = [];
  for (const m of xml.matchAll(new RegExp(`<${naam}\\b([^>]*?)/?>`, "g"))) uit.push(attributen(m[1]));
  return uit;
}

function tussen(xml, naam) {
  const m = new RegExp(`<${naam}>([^<]*)</${naam}>`).exec(xml);
  return m ? m[1].trim() : null;
}

// 20261120 → 2026-11-20
function datum(w) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(w || "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : (w || null);
}

// 20260930;101500 → 2026-09-30 10:15
function tijdstip(w) {
  const m = /^(\d{4})(\d{2})(\d{2})[;T ]?(\d{2})?(\d{2})?/.exec(String(w || "").trim());
  if (!m) return null;
  const dag = `${m[1]}-${m[2]}-${m[3]}`;
  return m[4] ? `${dag} ${m[4]}:${m[5] || "00"}` : dag;
}

const getal = (w) => {
  const n = Number(w);
  return Number.isFinite(n) ? n : null;
};

async function wacht(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function haalRapport(env, ruw = false) {
  const token = env.LYNX_FLEX_TOKEN;
  const query = env.LYNX_FLEX_QUERY;
  if (!token || !query) {
    return { fout: "Er staat nog geen token of query-id voor Lynx ingesteld." };
  }

  let aanvraag = "";
  let code = null;
  let laatste = "";
  for (const adres of SEND) {
    const antwoord = await fetch(`${adres}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}&v=3`, { headers: KOP });
    aanvraag = await antwoord.text();
    laatste = `${antwoord.status} van ${new URL(adres).host}`;
    code = tussen(aanvraag, "ReferenceCode");
    if (code) break;
  }

  if (!code) {
    // Zeggen wát er misging, niet dát er iets misging: anders staat er straks
    // een melding waar niemand iets mee kan.
    const melding = tussen(aanvraag, "ErrorMessage")
      || (tussen(aanvraag, "ErrorCode") ? `foutcode ${tussen(aanvraag, "ErrorCode")}` : null)
      || `${laatste} — ${aanvraag.replace(/\s+/g, " ").slice(0, 160) || "leeg antwoord"}`;
    return { fout: `Lynx gaf geen rapport terug: ${melding}`, ruw: ruw ? aanvraag.slice(0, 2000) : undefined };
  }
  const url = tussen(aanvraag, "Url") || GET_TERUGVAL;

  // Het rapport wordt op aanvraag gemaakt; de eerste keer vragen is soms te
  // vroeg. Drie keer proberen is genoeg — blijft het uit, dan zeggen we dat
  // in plaats van een leeg scherm te tonen.
  for (let poging = 0; poging < 3; poging++) {
    const antwoord = await fetch(`${url}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(code)}&v=3`, { headers: KOP });
    const xml = await antwoord.text();
    if (xml.includes("<FlexQueryResponse")) return { xml };
    const fout = tussen(xml, "ErrorMessage");
    if (fout && !/generation in progress|not ready/i.test(fout)) {
      return { fout: `Lynx: ${fout}`, ruw: ruw ? xml.slice(0, 2000) : undefined };
    }
    await wacht(1200);
  }
  return { fout: "Het rapport bij Lynx was nog niet klaar. Probeer het zo nog eens." };
}

// Wat er open staat, met de openingstransactie erbij: die draagt de premie die
// werkelijk ontvangen is.
export function leesPosities(xml) {
  const multiplierVan = (r) => getal(r.multiplier) || 10;

  const trades = elementen(xml, "Trade").filter((t) => (t.assetCategory || "").toUpperCase() === "OPT");

  return elementen(xml, "OpenPosition")
    .filter((p) => (p.assetCategory || "").toUpperCase() === "OPT")
    .map((p) => {
      // De openingstransactie van dit contract: zelfde contract, verkocht,
      // openend. Daar staat de ontvangen premie in punten.
      const opening = trades
        .filter((t) => t.conid === p.conid && (t.buySell || "").toUpperCase() === "SELL"
                    && (t.openCloseIndicator || "O").toUpperCase().startsWith("O"))
        .sort((a, b) => String(b.dateTime || "").localeCompare(String(a.dateTime || "")))[0];

      const multiplier = multiplierVan(p);
      // De prijs waartegen geopend is staat ook op de positie zelf
      // (costBasisPrice). Is de openingstransactie binnen de periode van het
      // rapport gevallen, dan is die preciezer — anders is dit genoeg.
      const premiePunten = (opening ? getal(opening.tradePrice) : null)
        ?? getal(p.openPrice) ?? getal(p.costBasisPrice);

      return {
        conid: p.conid,
        contract: p.description
          || `${p.underlyingSymbol || p.symbol || ""} ${datum(p.expiry) || ""} ${p.strike || ""} ${(p.putCall || "").toUpperCase() === "P" ? "PUT" : (p.putCall || "")}`.replace(/\s+/g, " ").trim(),
        strike: getal(p.strike),
        expiratiedatum: datum(p.expiry),
        aantal: Math.abs(getal(p.position) ?? getal(p.quantity) ?? 0) || null,
        premie_eur: premiePunten === null ? null : Math.round(premiePunten * multiplier * 100) / 100,
        premie_pt: premiePunten,
        uitvoering_op: tijdstip(opening && opening.dateTime),
        richting: (p.side === "Short" || (getal(p.position) ?? 0) < 0) ? "geschreven" : "gekocht",
        marktprijs: getal(p.markPrice),
        rapportdatum: datum(p.reportDate),
      };
    });
}

export async function openPosities(env) {
  const uit = await haalRapport(env);
  if (uit.fout) return { koppeling: false, reden: uit.fout, posities: [] };
  try {
    return { koppeling: true, posities: leesPosities(uit.xml) };
  } catch (fout) {
    return { koppeling: false, reden: `Het rapport van Lynx was niet te lezen: ${fout.message}`, posities: [] };
  }
}
