// De broker is de bron; de cockpit spiegelt.
//
//   node scripts/proef/spiegel.mjs
//
// Een cyclus met een go, een positie die opent, een positie die sluit, en een
// positie die opduikt terwijl er geen cyclus eenduidig is. Geen voorstellen,
// geen bevestigingen — alleen wat er bij de broker staat.
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { maakDB } from "./d1.mjs";
import { spiegel, onverdeeld, wijsToe, conceptberichten, verstuurPublicatie } from "../../worker/spiegel.js";

const pad = "/tmp/delta-spiegel-proef.sqlite";
rmSync(pad, { force: true });
const ruw = new DatabaseSync(pad);
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  ruw.exec(readFileSync("migrations/" + f, "utf8"));
}
ruw.exec(`insert into cyclus (id,label,status,geopend_op,doelexpiratie) values (1,'OESX okt 2026','in positie','2026-09-01','2026-10-30')`);
ruw.exec(`insert into beoordelingsmoment (id,cyclus,datum,status,uitkomst) values (5,1,'2026-09-10','uitkomst vastgelegd','go')`);
ruw.close();

const env = { DB: maakDB(pad) };
const ik = { id: "simon" };
let fouten = 0;
const eis = (wat, goed) => { if (!goed) { fouten++; console.log(`FOUT  ${wat}`); } else console.log(`goed  ${wat}`); };
const pos = (waar) => env.DB.prepare(`select * from positie ${waar}`).all().then((r) => r.results);

const contract = (conid, naam, strike, exp, aantal = -2) => ({
  conid, contract: naam, onderliggend: "OESX", strike, expiratiedatum: exp, aantal,
});
const fill = (conid, richting, prijs, datum) => ({
  conid, richting, prijs_pt: prijs, datum, moment: `${datum} 10:00`, aantal: 2,
});

// ---- 1 · een positie verschijnt bij de broker ----
let uit = await spiegel(env, ik,
  [contract("5001", "OESX 30OKT26 5600 PUT", 5600, "2026-10-30")],
  [fill("5001", "verkoop", 38.5, "2026-09-15")], "2026-09-16");
console.log("      ", uit);
eis("de positie wordt aangemaakt", uit.geopend === 1);

let [p1] = await pos("where conid = '5001'");
console.log(`       ${p1.contract} · tranche ${p1.tranche} · ${p1.ontvangen_premie_pt} pt · ${p1.status}`);
eis("met de echte premie uit de uitvoering", Number(p1.ontvangen_premie_pt) === 38.5);
eis("en klaar om te publiceren", p1.status === "publiceren naar leden");
eis("in de enige lopende cyclus", Number(p1.cyclus) === 1);
eis("met het go-besluit dat eraan voorafging", Number(p1.beoordelingsmoment) === 5);
eis("zonder vlag, want er was een besluit", Number(p1.zonder_besluit) === 0);
const plan = (await env.DB.prepare("select count(*) as n from exitregel where positie = ?").bind(p1.id).first());
eis("met een exitplan erbij", Number(plan.n) === 5);
const cyc = await env.DB.prepare("select doelexpiratie from cyclus where id = 1").first();
eis("de doelexpiratie blijft 30 oktober", cyc.doelexpiratie === "2026-10-30");

// ---- 2 · dezelfde stand nog eens: er mag niets dubbel ontstaan ----
uit = await spiegel(env, ik,
  [contract("5001", "OESX 30OKT26 5600 PUT", 5600, "2026-10-30")],
  [fill("5001", "verkoop", 38.5, "2026-09-15")], "2026-09-17");
eis("een tweede keer dezelfde stand verandert niets", uit.geopend === 0 && uit.gesloten === 0);

// ---- 3 · de rol: de ene sluit, de andere opent — in één zending ----
uit = await spiegel(env, ik,
  [contract("5002", "OESX 20NOV26 5500 PUT", 5500, "2026-11-20")],
  [fill("5001", "verkoop", 38.5, "2026-09-15"),
   fill("5001", "koop", 12.0, "2026-10-02"),
   fill("5002", "verkoop", 41.0, "2026-10-02")], "2026-10-02");
console.log("      ", uit);
eis("er sluit er één en er opent er één", uit.geopend === 1 && uit.gesloten === 1);

[p1] = await pos("where conid = '5001'");
console.log(`       dicht: ${p1.uitkomst} · teruggekocht ${p1.teruggekocht_pt} · resultaat ${p1.resultaat_pt}`);
eis("de oude staat gesloten", p1.status === "gesloten");
eis("teruggekocht op 12,0", Number(p1.teruggekocht_pt) === 12);
eis("resultaat 38,5 − 12,0 = 26,5", Number(p1.resultaat_pt) === 26.5);
eis("de uitkomst is 'vervroegd teruggekocht' — niet 'doorgerold'", p1.uitkomst === "vervroegd teruggekocht");

const [p2] = await pos("where conid = '5002'");
console.log(`       nieuw: ${p2.contract} · tranche ${p2.tranche} · ${p2.ontvangen_premie_pt} pt · ${p2.status}`);
eis("de nieuwe draagt de echte fill-prijs", Number(p2.ontvangen_premie_pt) === 41);
eis("en staat klaar om te publiceren", p2.status === "publiceren naar leden");
eis("het is tranche 2 van dezelfde cyclus", Number(p2.tranche) === 2 && Number(p2.cyclus) === 1);
const anker = await env.DB.prepare("select niveau from exitregel where positie = ? and soort = 'winstanker'").bind(p2.id).first();
eis("het exitplan rekent tegen háár premie: 30 % van 41 = 12,3", Number(anker.niveau) === 12.3);
const cyc2 = await env.DB.prepare("select doelexpiratie from cyclus where id = 1").first();
eis("de doelexpiratie rekt mee naar 20 november", cyc2.doelexpiratie === "2026-11-20");

// ---- 4 · waardeloos aflopen: geen terugkoop, expiratie voorbij ----
await spiegel(env, ik, [], [], "2026-11-21");
const [p2na] = await pos("where conid = '5002'");
console.log(`       ${p2na.uitkomst} · teruggekocht ${p2na.teruggekocht_pt} · resultaat ${p2na.resultaat_pt}`);
eis("waardeloos geëxpireerd", p2na.uitkomst === "waardeloos geexpireerd");
eis("teruggekocht op 0 — je betaalde niets om eruit te komen", Number(p2na.teruggekocht_pt) === 0);
eis("resultaat is de hele premie: 41", Number(p2na.resultaat_pt) === 41);

// ---- 5 · twee lopende cycli: dan kiest het systeem niet ----
await env.DB.prepare("insert into cyclus (id,label,status,geopend_op) values (2,'OESX dec 2026','in positie','2026-11-01')").run();
await spiegel(env, ik,
  [contract("5003", "OESX 18DEC26 5400 PUT", 5400, "2026-12-18")],
  [fill("5003", "verkoop", 52.0, "2026-11-25")], "2026-11-26");
const wacht = await onverdeeld(env);
console.log("       onverdeeld:", wacht.map((p) => p.contract).join(", "));
eis("de positie blijft onverdeeld staan", wacht.length === 1);
eis("ze bestaat wel degelijk, met haar premie", Number(wacht[0].ontvangen_premie_pt) === 52);

const toe = await wijsToe(env, ik, wacht[0].id, 2);
eis("toewijzen aan een cyclus lukt", Number(toe.cyclus) === 2);
const [p3] = await pos("where conid = '5003'");
eis("het is tranche 1 van die cyclus", Number(p3.tranche) === 1);
eis("zonder voorafgaand besluit, en dat valt op", Number(p3.zonder_besluit) === 1);
eis("ze staat niet meer onverdeeld", (await onverdeeld(env)).length === 0);

// ---- 6 · het bericht aan de leden ----
const concepten = await conceptberichten(env);
console.log("       concepten:", concepten.map((b) => `${b.soort} ${b.contract}`).join(" · "));
eis("elke opening en sluiting levert een concept op", concepten.length >= 4);

const opening = concepten.find((b) => b.soort === "opening" && b.contract === "OESX 18DEC26 5400 PUT");
eis("het concept draagt de feiten al", Number(opening.premie_pt) === 52);
eis("maar nog geen tekst", !opening.tekst);

const zonderTekst = await verstuurPublicatie(env, ik, opening.id);
eis("versturen zonder tekst wordt geweigerd", Boolean(zonderTekst.fout));

await env.DB.prepare("update publicatie set tekst = ? where id = ?")
  .bind("We schreven de decemberput op 5400 omdat de volatiliteit opliep.", opening.id).run();
const verstuurd = await verstuurPublicatie(env, ik, opening.id);
eis("met tekst lukt het wel", verstuurd.status === "verstuurd");

const na = await env.DB.prepare("select status, gepubliceerd from positie where id = ?").bind(opening.positie).first();
console.log(`       positie na versturen: ${na.status} · gepubliceerd ${na.gepubliceerd}`);
eis("de positie gaat door naar bewaken", na.status === "bewaken");
eis("en staat als gepubliceerd", Number(na.gepubliceerd) === 1);

const nogeens = await verstuurPublicatie(env, ik, opening.id);
eis("twee keer versturen wordt geweigerd", Boolean(nogeens.fout));

console.log(fouten ? `\n${fouten} toets(en) mislukt.` : "\nalles klopt.");
process.exit(fouten ? 1 : 0);
