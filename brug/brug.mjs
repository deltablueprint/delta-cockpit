// De brug: van IB Gateway naar de cockpit, zodra er iets verandert.
//
// Waarom dit bestaat. Het Flex-rapport is rapportage — je vraagt het aan en
// krijgt een beeld van minuten tot een dag oud. Voor het vastleggen van wat er
// gebeurd is, is dat genoeg; voor het bewaken van een stoploss niet. De TWS API
// is het tegenovergestelde: geen vraag-en-antwoord maar een open verbinding die
// je aantikt op het moment dat er iets verandert.
//
// Wat deze brug doet: luisteren naar posities, portefeuillewaarde en
// uitvoeringen, en elke verandering meteen doorduwen naar de cockpit. Plus een
// hartslag, zodat de cockpit het verschil kent tussen 'er gebeurt niets' en
// 'ik hoor niets meer'. Dat laatste is geen detail: stil oude getallen tonen is
// erger dan niets tonen.
//
// Wat deze brug NIET doet, en nooit zal doen: een order plaatsen, wijzigen of
// annuleren. Er is in dit bestand geen enkele aanroep die dat kan. De cockpit
// kan de brug ook niet aansturen — het verkeer gaat één kant op, van hier naar
// daar. Staat in IB Gateway bovendien *Read-Only API* aan, dan weigert IBKR's
// eigen software het ook nog eens. Drie sloten op dezelfde deur.
//
// Instellen: maak ~/.delta-brug.env met
//
//   COCKPIT_URL=https://delta-cockpit-staging.dejonghe-simon.workers.dev
//   BRUG_SLEUTEL=...        dezelfde sleutel als die bij Cloudflare staat
//   IB_HOST=127.0.0.1       IB Gateway draait op dezelfde machine
//   IB_PORT=7497            7497 = paper, 7496 = live
//   IB_CLIENT_ID=17         elk nummer, zolang het uniek is per verbinding
//
// Draaien: node brug.mjs

import { IBApi, EventName } from "@stoqey/ib";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ------------------------------------------------------------- instellingen
function instellingen() {
  const pad = process.env.DELTA_BRUG_ENV || join(homedir(), ".delta-brug.env");
  const uit = {};
  try {
    for (const regel of readFileSync(pad, "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(regel);
      if (m) uit[m[1]] = m[2];
    }
  } catch {
    throw new Error(`Kan ${pad} niet lezen. Zie de kop van dit bestand voor wat erin hoort.`);
  }
  for (const nodig of ["COCKPIT_URL", "BRUG_SLEUTEL"]) {
    if (!uit[nodig]) throw new Error(`${nodig} ontbreekt in ${pad}`);
  }
  return {
    url: uit.COCKPIT_URL.replace(/\/$/, ""),
    sleutel: uit.BRUG_SLEUTEL,
    host: uit.IB_HOST || "127.0.0.1",
    poort: Number(uit.IB_PORT || 7497),
    clientId: Number(uit.IB_CLIENT_ID || 17),
    hartslag: Number(uit.HARTSLAG_SECONDEN || 10),
  };
}

const inst = instellingen();
const log = (...w) => console.log(new Date().toISOString(), ...w);

// ------------------------------------------------------------------ de stand
// Wat we weten, en wat er sinds de vorige zending veranderd is. We sturen niet
// bij elke tik het hele beeld: alleen wat er anders is, plus een hartslag.
const posities = new Map();      // conid -> regel
const gebeurtenissen = [];       // uitvoeringen en veranderingen, in volgorde
let rekening = null;
let kapitaal = null;
let vuil = false;
let verbonden = false;

const rond = (n, c = 4) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 10 ** c) / 10 ** c : null);

function contractnaam(c) {
  if (!c) return null;
  const maand = ["JAN","FEB","MRT","APR","MEI","JUN","JUL","AUG","SEP","OKT","NOV","DEC"];
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(c.lastTradeDateOrContractMonth || ""));
  const exp = m ? `${m[3]}${maand[Number(m[2]) - 1]}${m[1].slice(2)}` : (c.lastTradeDateOrContractMonth || "");
  return [c.symbol, exp, c.strike, c.right === "P" ? "PUT" : c.right === "C" ? "CALL" : c.right]
    .filter(Boolean).join(" ").trim();
}

function expiratiedatum(c) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(c && c.lastTradeDateOrContractMonth || ""));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function zetPositie(contract, aantal, gemKostprijs, extra = {}) {
  const conid = String(contract.conId || "");
  if (!conid) return;
  const oud = posities.get(conid);
  const nieuw = {
    conid,
    contract: contractnaam(contract),
    onderliggend: contract.symbol || null,
    soort: contract.secType || null,
    strike: rond(contract.strike, 2),
    expiratiedatum: expiratiedatum(contract),
    putcall: contract.right || null,
    multiplier: Number(contract.multiplier) || null,
    aantal: rond(aantal, 2),
    gem_kostprijs: rond(gemKostprijs, 4),
    ...extra,
  };
  // Alleen melden wat écht anders is: anders stuurt een koersbeweging van een
  // cent de halve portefeuille opnieuw over de lijn.
  const zelfde = oud && ["aantal", "gem_kostprijs", "marktprijs", "waarde"]
    .every((k) => (oud[k] ?? null) === (nieuw[k] ?? oud[k] ?? null));
  posities.set(conid, { ...oud, ...nieuw });
  if (!zelfde) {
    vuil = true;
    if (!oud || oud.aantal !== nieuw.aantal) {
      gebeurtenissen.push({
        soort: "positie",
        conid, contract: nieuw.contract,
        van: oud ? oud.aantal : null, naar: nieuw.aantal,
        moment: new Date().toISOString(),
      });
      log(`positie ${nieuw.contract}: ${oud ? oud.aantal : "—"} → ${nieuw.aantal}`);
    }
  }
}

// ---------------------------------------------------------------- versturen
let bezig = false;
let mislukt = 0;

async function stuur(reden) {
  if (bezig) return;
  bezig = true;
  const pakket = {
    reden,
    moment: new Date().toISOString(),
    verbonden,
    rekening,
    kapitaal,
    posities: [...posities.values()].filter((p) => Number(p.aantal) !== 0),
    gebeurtenissen: gebeurtenissen.splice(0, gebeurtenissen.length),
  };
  try {
    const antwoord = await fetch(`${inst.url}/api/brug`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-brug-sleutel": inst.sleutel },
      body: JSON.stringify(pakket),
    });
    if (!antwoord.ok) throw new Error(`${antwoord.status} ${(await antwoord.text()).slice(0, 160)}`);
    vuil = false;
    // Het antwoord draagt de instellingen. Zo komt een wijziging uit het
    // scherm binnen één hartslag aan, zonder dat de cockpit ooit iets naar de
    // brug hoeft te sturen: het verkeer blijft één kant op.
    const terug = await antwoord.json().catch(() => null);
    if (terug && terug.instellingen) pasAan(terug.instellingen);
    if (mislukt) { log(`cockpit weer bereikbaar na ${mislukt} mislukte pogingen`); mislukt = 0; }
  } catch (fout) {
    mislukt++;
    // De gebeurtenissen gingen niet weg: terugleggen, anders zijn ze stil weg.
    gebeurtenissen.unshift(...pakket.gebeurtenissen);
    if (mislukt <= 3 || mislukt % 30 === 0) log(`cockpit onbereikbaar (${mislukt}×): ${fout.message}`);
  } finally {
    bezig = false;
  }
}

// De hartslag kan vanuit het scherm bijgesteld worden; de klok wordt dan
// opnieuw gezet. Meer dan dit laat de brug zich niet vertellen — hij neemt geen
// opdrachten aan, alleen instellingen die over hemzelf gaan.
let hartslagklok = null;
function zetHartslag(seconden) {
  const n = Math.max(2, Math.min(300, Number(seconden) || inst.hartslag));
  if (hartslagklok && n === inst.hartslag) return;
  inst.hartslag = n;
  if (hartslagklok) clearInterval(hartslagklok);
  hartslagklok = setInterval(() => stuur(vuil ? "wijziging" : "hartslag"), n * 1000);
}

// De Gateway aan of uit, gezegd vanuit de cockpit.
//
// IBKR laat per login één sessie toe. Zolang de Gateway aangemeld is, kan Simon
// zelf niet in LYNX. Dat moest met ssh en systemctl; nu staat het als schakelaar
// in de kop van de cockpit. Het verkeer blijft één kant op: de brug leest deze
// instelling af in het antwoord op zijn eigen zending. Hij neemt geen opdrachten
// aan — dit gaat over hemzelf, en het is het enige wat hij op de machine mag:
// sudo staat precies deze twee regels toe en verder niets (installeer.sh).
let gatewayAan = true;
let bezigMetGateway = false;

function systemd(wat) {
  return new Promise((klaar) => {
    execFile("sudo", ["-n", "/usr/bin/systemctl", wat, "ibgateway"], (fout, uit, err) => {
      if (fout) log(`systemctl ${wat} ibgateway lukte niet: ${String(err || fout).trim().slice(0, 200)}`);
      else log(`Gateway ${wat === "stop" ? "afgemeld" : "gestart"} vanuit de cockpit`);
      klaar(!fout);
    });
  });
}

async function zetGateway(aan) {
  if (aan === gatewayAan || bezigMetGateway) return;
  bezigMetGateway = true;
  gatewayAan = aan;
  try {
    if (!aan) {
      // Eerst zelf loslaten, dan pas de Gateway stoppen: anders staat er een
      // halve seconde een verbinding open naar iets wat al aan het afsluiten is.
      stopKoersen();
      try { ib.disconnect(); } catch { /* lag er al uit */ }
      verbonden = false;
      await systemd("stop");
      await stuur("gateway uit");
    } else {
      await systemd("start");
      // De Gateway heeft een halve minuut nodig om aan te melden; verbind()
      // probeert daarna vanzelf opnieuw tot het lukt.
      setTimeout(verbind, 20000);
    }
  } finally {
    bezigMetGateway = false;
  }
}

function pasAan(nieuw) {
  if (nieuw.hartslag_seconden) zetHartslag(nieuw.hartslag_seconden);
  if (nieuw.gateway_aan !== undefined) zetGateway(Number(nieuw.gateway_aan) === 1);
  const wil = Number(nieuw.marktdata) === 1;
  if (wil !== marktdataAan) {
    marktdataAan = wil;
    log(`koersen meesturen staat nu ${wil ? "aan" : "uit"}`);
    if (wil) volgKoersen(); else stopKoersen();
  }
}

// Koersen volgen van wat er open staat. Zonder een abonnement op Eurex-data
// komt er niets door en kost het niets; daarom staat het standaard uit.
let marktdataAan = false;
const koersVerzoeken = new Map();   // conid -> reqId
let volgendVerzoek = 1000;

function volgKoersen() {
  if (!marktdataAan) return;

  for (const p of posities.values()) {
    if (koersVerzoeken.has(p.conid) || Number(p.aantal) === 0) continue;
    const id = volgendVerzoek++;
    koersVerzoeken.set(p.conid, id);
    try {
      ib.reqMktData(id, { conId: Number(p.conid), exchange: "SMART" }, "", false, false);
    } catch (fout) {
      log(`koers volgen van ${p.contract} lukt niet: ${fout.message}`);
      koersVerzoeken.delete(p.conid);
    }
  }
}

function stopKoersen() {
  for (const [conid, id] of koersVerzoeken) {
    try { ib.cancelMktData(id); } catch { /* al weg */ }
    koersVerzoeken.delete(conid);
  }
}

// Veranderingen komen in trosjes binnen; we wachten een halve seconde zodat
// twintig tikken één zending worden, en sturen dan meteen.
let klok = null;
function melden() {
  if (klok) return;
  klok = setTimeout(() => { klok = null; if (vuil) stuur("wijziging"); }, 500);
}

// ------------------------------------------------------------- IB Gateway
const ib = new IBApi({ host: inst.host, port: inst.poort, clientId: inst.clientId });

ib.on(EventName.connected, () => {
  verbonden = true;
  log(`verbonden met IB Gateway op ${inst.host}:${inst.poort}`);
});

ib.on(EventName.disconnected, () => {
  verbonden = false;
  if (!gatewayAan) {
    log("verbinding met IB Gateway weg — de Gateway staat uit vanuit de cockpit");
    return;
  }
  log("verbinding met IB Gateway weg — opnieuw proberen");
  stuur("verbinding weg");
  setTimeout(verbind, 5000);
});

ib.on(EventName.error, (fout, code, reqId) => {
  // 2104/2106/2158 zijn 'market data farm connection is OK': geen fouten.
  if ([2104, 2106, 2107, 2158, 2119].includes(Number(code))) return;
  log(`IB melding ${code}${reqId && reqId !== -1 ? ` (verzoek ${reqId})` : ""}: ${fout.message || fout}`);
});

ib.on(EventName.managedAccounts, (lijst) => {
  rekening = String(lijst || "").split(",")[0] || null;
  log(`rekening ${rekening}`);
  if (rekening) ib.reqAccountUpdates(true, rekening);
  ib.reqPositions();
});

// De volledige lijst posities, en daarna elke wijziging.
ib.on(EventName.position, (account, contract, pos, avgCost) => {
  zetPositie(contract, pos, avgCost);
  melden();
});

// Portefeuilleregels dragen ook de marktprijs en de waarde.
ib.on(EventName.updatePortfolio, (contract, positie, marktprijs, waarde, gemKostprijs, ongerealiseerd, gerealiseerd) => {
  zetPositie(contract, positie, gemKostprijs, {
    marktprijs: rond(marktprijs, 4),
    waarde: rond(waarde, 2),
    ongerealiseerd: rond(ongerealiseerd, 2),
    gerealiseerd: rond(gerealiseerd, 2),
  });
  melden();
});

// De nettowaarde van de rekening: het kapitaal waar de portefeuillebalk op
// rekent. Dit is de waarde die het Flex-rapport niet meestuurde.
ib.on(EventName.updateAccountValue, (sleutel, waarde, valuta, account) => {
  if (sleutel !== "NetLiquidation" || (valuta && valuta !== "EUR" && valuta !== "BASE")) return;
  const n = rond(waarde, 2);
  if (n !== kapitaal) { kapitaal = n; vuil = true; melden(); }
});

// Uitvoeringen: wát er precies gebeurd is, met prijs en tijdstip. Komt alleen
// door als *Read-Only API* uit staat; met read-only aan ziet de brug de
// positiewijziging wel en de prijs niet, en vult Flex die 's nachts aan.
ib.on(EventName.execDetails, (reqId, contract, uitvoering) => {
  gebeurtenissen.push({
    soort: "uitvoering",
    conid: String(contract.conId || ""),
    contract: contractnaam(contract),
    richting: (uitvoering.side || "").toUpperCase() === "BOT" ? "koop" : "verkoop",
    aantal: rond(uitvoering.shares, 2),
    prijs: rond(uitvoering.price, 4),
    uitvoering_id: uitvoering.execId || null,
    moment: uitvoering.time || new Date().toISOString(),
  });
  vuil = true;
  log(`uitvoering ${contractnaam(contract)} ${uitvoering.side} ${uitvoering.shares} × ${uitvoering.price}`);
  melden();
});

// De koers van een contract dat we volgen. Veld 4 is de laatste prijs, 1 de
// bied- en 2 de laatprijs; voor een geschreven optie is de laatprijs wat het
// kost om eruit te stappen, en dus de prijs waar het exitplan op rekent.
ib.on(EventName.tickPrice, (reqId, veld, prijs) => {
  if (!marktdataAan || !Number.isFinite(prijs) || prijs <= 0) return;

  const conid = [...koersVerzoeken.entries()].find(([, id]) => id === reqId);
  if (!conid) return;
  const p = posities.get(conid[0]);
  if (!p) return;
  const sleutel = veld === 2 ? "laatprijs" : veld === 1 ? "biedprijs" : veld === 4 ? "marktprijs" : null;
  if (!sleutel) return;
  if (p[sleutel] === rond(prijs, 4)) return;
  p[sleutel] = rond(prijs, 4);
  vuil = true;
  melden();
});

function verbind() {
  if (!gatewayAan) return;
  try {
    ib.connect();
  } catch (fout) {
    log(`verbinden mislukt: ${fout.message} — over 5 seconden opnieuw`);
    setTimeout(verbind, 5000);
  }
}

// De hartslag. Hij stuurt ook als er niets veranderd is: dat is precies het
// punt — de cockpit weet dan dat de stilte klopt.
zetHartslag(inst.hartslag);

process.on("SIGINT", () => { log("afsluiten"); verbonden = false; stuur("afsluiten").finally(() => process.exit(0)); });
process.on("SIGTERM", () => { log("afsluiten"); verbonden = false; stuur("afsluiten").finally(() => process.exit(0)); });

log(`brug start — cockpit ${inst.url}, gateway ${inst.host}:${inst.poort}`);
verbind();
