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
// IBKR laat programmatische toegang alleen door met een van de door hen
// genoemde user-agents. Een eigen naam levert bij het oude adres een
// 'Access Denied' van hun firewall op.
const KOP = { "user-agent": "Java", accept: "application/xml" };

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
  const pogingen = [];
  for (const adres of SEND) {
    let antwoord;
    try {
      antwoord = await fetch(`${adres}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}&v=3`, { headers: KOP });
    } catch (fout) {
      pogingen.push({ host: new URL(adres).host, status: "niet bereikbaar", kort: fout.message });
      continue;
    }
    aanvraag = await antwoord.text();
    pogingen.push({
      host: new URL(adres).host,
      status: antwoord.status,
      kort: (tussen(aanvraag, "ErrorMessage") || aanvraag.replace(/\s+/g, " ").slice(0, 120) || "leeg antwoord"),
    });
    code = tussen(aanvraag, "ReferenceCode");
    if (code) break;

    // Antwoordt dit adres wél in XML, dan is het bericht van IBKR zelf en
    // niet van een firewall onderweg: dan is het andere adres proberen
    // zinloos, en zou de melding die jij ziet van het verkeerde adres komen.
    if (aanvraag.includes("<FlexStatementResponse") || tussen(aanvraag, "ErrorMessage")) break;
  }

  if (!code) {
    // Zeggen wát er misging, niet dát er iets misging: anders staat er straks
    // een melding waar niemand iets mee kan.
    const melding = pogingen.map((p) => `${p.host}: ${p.status} — ${p.kort}`).join(" | ");
    return {
      fout: `Lynx gaf geen rapport terug. ${melding}`,
      pogingen,
      ruw: ruw ? aanvraag.slice(0, 2000) : undefined,
    };
  }
  const url = tussen(aanvraag, "Url") || GET_TERUGVAL;

  // Het rapport wordt op aanvraag gemaakt, en dat duurt bij IBKR seconden tot
  // een halve minuut. We wachten dus met oplopende tussenpozen in plaats van
  // drie keer snel achter elkaar te vragen en dan op te geven.
  const wachttijden = [800, 1200, 2000, 3000, 4000, 5000, 6000, 8000];
  for (let poging = 0; poging < wachttijden.length; poging++) {
    const antwoord = await fetch(`${url}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(code)}&v=3`, { headers: KOP });
    const xml = await antwoord.text();
    if (xml.includes("<FlexQueryResponse")) return { xml };
    const fout = tussen(xml, "ErrorMessage");
    if (fout && !/generation in progress|not ready/i.test(fout)) {
      return { fout: `Lynx: ${fout}`, ruw: ruw ? xml.slice(0, 2000) : undefined };
    }
    await wacht(wachttijden[poging]);
  }
  return { fout: "Het rapport bij Lynx was na een halve minuut nog niet klaar." };
}

// Wat er open staat, met de openingstransactie erbij: die draagt de premie die
// werkelijk ontvangen is.
export function leesPosities(xml) {
  const multiplierVan = (r) => getal(r.multiplier) || 10;

  const trades = elementen(xml, "Trade").filter((t) => (t.assetCategory || "").toUpperCase() === "OPT");

  const vandaag = new Date().toISOString().slice(0, 10);

  return elementen(xml, "OpenPosition")
    .filter((p) => (p.assetCategory || "").toUpperCase() === "OPT")
    // Wat dicht is, hoort hier niet te staan: een regel met aantal nul is een
    // gesloten positie, en een contract waarvan de expiratie voorbij is ook.
    .filter((p) => (getal(p.position) ?? getal(p.quantity) ?? 0) !== 0)
    .filter((p) => !p.expiry || (datum(p.expiry) || "9999") >= vandaag)
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
      // De prijs waartegen geschreven is, komt het liefst uit de
      // openingstransactie: dat is de brutopremie zoals ze gequoteerd werd.
      // De prijs op de positie zelf (openPrice / costBasisPrice) is bij IBKR
      // de kostprijs ná commissie — voor een geschreven put dus iets lager.
      // Allebei zijn waar; ze meten iets anders, en dat hoort er dus bij te
      // staan in plaats van stilletjes door elkaar te lopen.
      const uitTransactie = opening ? getal(opening.tradePrice) : null;
      const premiePunten = uitTransactie ?? getal(p.openPrice) ?? getal(p.costBasisPrice);

      return {
        conid: p.conid,
        contract: p.description
          || `${p.underlyingSymbol || p.symbol || ""} ${datum(p.expiry) || ""} ${p.strike || ""} ${(p.putCall || "").toUpperCase() === "P" ? "PUT" : (p.putCall || "")}`.replace(/\s+/g, " ").trim(),
        strike: getal(p.strike),
        expiratiedatum: datum(p.expiry),
        aantal: Math.abs(getal(p.position) ?? getal(p.quantity) ?? 0) || null,
        premie_eur: premiePunten === null ? null : Math.round(premiePunten * multiplier * 100) / 100,
        premie_pt: premiePunten,
        premie_bron: uitTransactie !== null && uitTransactie !== undefined ? "transactie" : "positie",
        uitvoering_op: tijdstip(opening && opening.dateTime),
        richting: (p.side === "Short" || (getal(p.position) ?? 0) < 0) ? "geschreven" : "gekocht",
        marktprijs: getal(p.markPrice),
        rapportdatum: datum(p.reportDate),
      };
    });
}

// De transacties uit het rapport, in onze eigen woorden.
//
// Hieruit valt af te lezen wat er met een tranche gebeurd is: een koop die een
// positie sluit is een terugkoop, een verkoop die er een opent is een nieuwe
// tranche, en staan die twee op dezelfde dag met dezelfde onderliggende waarde,
// dan is er doorgerold. Het systeem leest; het oordeelt niet.
export function leesTransacties(xml) {
  return elementen(xml, "Trade")
    .filter((t) => (t.assetCategory || "").toUpperCase() === "OPT")
    .map((t) => {
      const richting = (t.buySell || "").toUpperCase() === "BUY" ? "koop" : "verkoop";
      const soort = (t.openCloseIndicator || "").toUpperCase().startsWith("C") ? "sluitend"
                  : (t.openCloseIndicator || "").toUpperCase().startsWith("O") ? "openend" : null;
      return {
        conid: t.conid,
        contract: t.description || `${t.underlyingSymbol || t.symbol || ""} ${datum(t.expiry) || ""} ${t.strike || ""} ${(t.putCall || "").toUpperCase()}`.replace(/\s+/g, " ").trim(),
        onderliggend: t.underlyingSymbol || t.symbol || null,
        strike: getal(t.strike),
        expiratiedatum: datum(t.expiry),
        putcall: (t.putCall || "").toUpperCase() || null,
        richting,
        soort,
        aantal: Math.abs(getal(t.quantity) ?? 0) || null,
        prijs_pt: getal(t.tradePrice),
        multiplier: getal(t.multiplier) || 10,
        commissie: getal(t.ibCommission),
        netto: getal(t.netCash),
        datum: datum(t.tradeDate) || (tijdstip(t.dateTime) || "").slice(0, 10) || null,
        moment: tijdstip(t.dateTime),
      };
    })
    .sort((a, b) => String(a.moment || a.datum || "").localeCompare(String(b.moment || b.datum || "")));
}

// Het rapport bij IBKR wordt op aanvraag gemaakt en dat duurt seconden. Twee
// keer achter elkaar hetzelfde scherm openen hoort niet twee keer te wachten,
// dus het antwoord blijft vijf minuten in de cache van de worker staan. Het is
// toch rapportage: verser dan de bron wordt het er niet van.
// Het kapitaal zoals de broker het ziet.
//
// Een Flex-rapport draagt de nettowaarde van de rekening mee zodra de query de
// sectie *Net Asset Value* of *Change in NAV* bevat. Staat die er niet in, dan
// geven we niets terug: dan blijft het ingestelde kapitaal gelden en zegt het
// scherm eerlijk waar het getal vandaan komt.
export function leesKapitaal(xml) {
  const kandidaten = [
    ...elementen(xml, "EquitySummaryByReportDateInBase").map((r) => ({ d: r.reportDate, n: getal(r.total) })),
    ...elementen(xml, "EquitySummaryInBase").map((r) => ({ d: r.reportDate, n: getal(r.total) })),
    ...elementen(xml, "ChangeInNAV").map((r) => ({ d: r.toDate, n: getal(r.endingValue) })),
  ].filter((k) => Number.isFinite(k.n) && k.n > 0);
  if (!kandidaten.length) return null;
  kandidaten.sort((a, b) => String(a.d || "").localeCompare(String(b.d || "")));
  return kandidaten[kandidaten.length - 1].n;
}

// Het kapitaal voor de schermen: uit Lynx als het rapport het draagt, anders
// uit de portefeuille-instelling. Het scherm toont er altijd bij welke van de
// twee het is.
export async function kapitaalUitLynx(env) {
  const rapport = await laatsteRapport(env);
  if (!rapport) return null;
  try {
    const n = leesKapitaal(rapport.xml);
    return n === null ? null : { kapitaal: n, opgehaald_op: rapport.opgehaald_op };
  } catch {
    return null;
  }
}

const CACHESLEUTEL = "https://delta-blueprint.intern/lynx/posities";
const CACHE_SECONDEN = 300;

// Het laatst aangeleverde rapport, met wanneer het binnenkwam.
export async function laatsteRapport(env) {
  try {
    return await env.DB.prepare(
      "select xml, opgehaald_op from lynx_rapport order by id desc limit 1"
    ).first();
  } catch {
    return null;
  }
}

// Het rapport aannemen. Alleen met de afgesproken sleutel, en alleen lezen uit
// de inhoud: er is geen weg terug naar de broker.
// Welke rekeningen in dit rapport staan. Een Flex-query hangt aan één login, en
// die login kan meerdere rekeningen zien — live én paper. Als het rapport over
// een andere rekening gaat dan waar de brug op zit, dan beschrijven de twee
// bronnen verschillende portefeuilles, en alles wat je daarna leest is een
// mengsel. Dat is erger dan geen vangnet.
export function rekeningenIn(xml) {
  const uit = new Set();
  for (const m of String(xml).matchAll(/accountId="([^"]+)"/g)) {
    const r = String(m[1]).trim();
    if (r) uit.add(r);
  }
  return [...uit];
}

export async function neemRapportAan(env, xml, bron = "script") {
  if (!xml || !xml.includes("<FlexQueryResponse")) {
    return { fout: "Dat is geen Flex-rapport.", status: 400 };
  }
  if (xml.length > 2000000) return { fout: "Het rapport is te groot.", status: 413 };

  // De brug zegt op welke rekening wij zitten. Hoort dit rapport bij een andere,
  // dan bewaren we het wel — het is te onderzoeken — maar spiegelen we het niet.
  const verbinding = await env.DB.prepare(
    "select rekening from brokerverbinding where id = 1"
  ).first().catch(() => null);
  const onze = verbinding && verbinding.rekening ? String(verbinding.rekening).trim() : null;
  const inRapport = rekeningenIn(xml);
  const vreemd = onze && inRapport.length && !inRapport.includes(onze);

  let regels = 0;
  try {
    regels = leesPosities(xml).length;
  } catch { /* onleesbaar rapport bewaren we toch, dan is het te onderzoeken */ }

  await env.DB.batch([
    env.DB.prepare("insert into lynx_rapport (xml, bron, regels) values (?, ?, ?)").bind(xml, bron, regels),
    // Eén rapport is genoeg; de vorige hoeven we niet te bewaren.
    env.DB.prepare("delete from lynx_rapport where id not in (select id from lynx_rapport order by id desc limit 3)"),
  ]);

  if (vreemd) {
    return {
      fout: `Dit rapport gaat over ${inRapport.join(", ")}, de brug zit op ${onze}. Het is bewaard, maar niet verwerkt.`,
      status: 409,
      rekening_rapport: inRapport,
      rekening_brug: onze,
    };
  }

  // Een nieuw rapport is een nieuwe stand: wat erin veranderde, hoort meteen
  // in de lijsten te staan. Anders zie je een vlag pas nadat je toevallig het
  // juiste scherm hebt geopend, en dat is geen signaal maar een toeval.
  try {
    const { spiegel } = await import("./spiegel.js");
    await spiegel(env, { id: null }, leesPosities(xml), leesTransacties(xml));
  } catch { /* het rapport is bewaard; spiegelen kan bij het volgende */ }

  return { ok: true, posities: regels };
}

export async function openPosities(env) {
  const bewaardRapport = await laatsteRapport(env);
  if (bewaardRapport) {
    try {
      return {
        koppeling: true,
        opgehaald_op: bewaardRapport.opgehaald_op,
        posities: leesPosities(bewaardRapport.xml),
      };
    } catch (fout) {
      return { koppeling: false, reden: `Het rapport van Lynx was niet te lezen: ${fout.message}`, posities: [] };
    }
  }

  // Niets aangeleverd: dan proberen we het nog zelf, voor het geval deze
  // omgeving wél bij IBKR mag.
  const cache = caches.default;
  const bewaard = await cache.match(CACHESLEUTEL).catch(() => null);
  if (bewaard) {
    try {
      return { ...(await bewaard.json()), uit_cache: true };
    } catch { /* kapot bewaard antwoord: gewoon opnieuw ophalen */ }
  }

  const uitkomst = await openPositiesVers(env);
  if (uitkomst.koppeling) {
    await cache.put(
      CACHESLEUTEL,
      new Response(JSON.stringify(uitkomst), {
        headers: { "content-type": "application/json", "cache-control": `max-age=${CACHE_SECONDEN}` },
      })
    ).catch(() => {});
  }
  return uitkomst;
}

async function openPositiesVers(env) {
  const uit = await haalRapport(env);
  if (uit.fout) return { koppeling: false, reden: uit.fout, posities: [] };
  try {
    return { koppeling: true, posities: leesPosities(uit.xml) };
  } catch (fout) {
    return { koppeling: false, reden: `Het rapport van Lynx was niet te lezen: ${fout.message}`, posities: [] };
  }
}
