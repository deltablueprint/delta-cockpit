#!/usr/bin/env node
//
// Haalt het Flex-rapport bij IBKR op en levert het af bij de cockpit.
//
// Waarom dit hier draait en niet in de worker: IBKR weigert verzoeken die van
// Cloudflare komen ("Access denied for 141.101.76.100"). Een machine met een
// gewoon IP mag wel. De cockpit belt dus nooit naar de broker; hij neemt aan
// wat dit script aflevert — en ook dit script kan alleen lezen.
//
// Instellen: maak ~/.delta-lynx.env met vier regels (zonder aanhalingstekens)
//
//   LYNX_FLEX_TOKEN=...      het token uit Flex Web Service Configuration
//   LYNX_FLEX_QUERY=...      de Query ID van 'Delta Cockpit'
//   COCKPIT_URL=https://delta-cockpit-staging.dejonghe-simon.workers.dev
//   LYNX_PUSH_SLEUTEL=...    dezelfde sleutel als die bij Cloudflare staat
//
// Draaien:  node scripts/lynx-ophalen.mjs
// Elk kwartier:  zie scripts/lynx-ophalen.plist

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KOP = { "user-agent": "Java", accept: "application/xml" };
const SEND = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest";
const GET = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";

function instellingen() {
  const pad = process.env.DELTA_LYNX_ENV || join(homedir(), ".delta-lynx.env");
  const uit = {};
  for (const regel of readFileSync(pad, "utf8").split("\n")) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(regel);
    if (m) uit[m[1]] = m[2].trim();
  }
  for (const nodig of ["LYNX_FLEX_TOKEN", "LYNX_FLEX_QUERY", "COCKPIT_URL", "LYNX_PUSH_SLEUTEL"]) {
    if (!uit[nodig]) throw new Error(`${nodig} ontbreekt in ${pad}`);
  }
  return uit;
}

const tussen = (xml, naam) => {
  const m = new RegExp(`<${naam}>([^<]*)</${naam}>`).exec(xml);
  return m ? m[1].trim() : null;
};

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function haalRapport({ LYNX_FLEX_TOKEN: token, LYNX_FLEX_QUERY: query }) {
  const aanvraag = await (await fetch(
    `${SEND}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}&v=3`, { headers: KOP }
  )).text();

  const code = tussen(aanvraag, "ReferenceCode");
  if (!code) {
    throw new Error(`geen referentiecode: ${tussen(aanvraag, "ErrorMessage") || aanvraag.slice(0, 200)}`);
  }
  const url = tussen(aanvraag, "Url") || GET;

  // Het rapport wordt op aanvraag gemaakt; dat duurt seconden tot een halve minuut.
  for (const pauze of [800, 1200, 2000, 3000, 4000, 5000, 6000, 8000]) {
    const xml = await (await fetch(
      `${url}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(code)}&v=3`, { headers: KOP }
    )).text();
    if (xml.includes("<FlexQueryResponse")) return xml;
    const fout = tussen(xml, "ErrorMessage");
    if (fout && !/generation in progress|not ready/i.test(fout)) throw new Error(fout);
    await wacht(pauze);
  }
  throw new Error("het rapport was na een halve minuut nog niet klaar");
}

async function lever(xml, { COCKPIT_URL: url, LYNX_PUSH_SLEUTEL: sleutel }) {
  const antwoord = await fetch(`${url.replace(/\/$/, "")}/api/lynx/rapport`, {
    method: "POST",
    headers: { "content-type": "application/xml", "x-lynx-sleutel": sleutel },
    body: xml,
  });
  const tekst = await antwoord.text();
  if (!antwoord.ok) throw new Error(`de cockpit nam het niet aan (${antwoord.status}): ${tekst.slice(0, 200)}`);
  return tekst;
}

try {
  const inst = instellingen();
  const xml = await haalRapport(inst);
  const uit = await lever(xml, inst);
  console.log(`${new Date().toISOString()} rapport afgeleverd — ${uit}`);
} catch (fout) {
  console.error(`${new Date().toISOString()} mislukt: ${fout.message}`);
  process.exit(1);
}
