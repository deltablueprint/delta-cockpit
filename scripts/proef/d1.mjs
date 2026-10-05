// Een kleine namaak-D1 bovenop node:sqlite, zodat de worker-code tegen een
// echte database getest kan worden zonder Cloudflare. Alleen voor tests.
//
// Hij is met opzet net zo streng als D1, en op één punt strenger dan node:sqlite.
// node:sqlite bindt ontbrekende parameters stilletjes als null; D1 weigert met
// "Wrong number of parameter bindings for SQL query". Dat verschil heeft ons één
// keer een kapot scherm in staging gekost: een query met vijf plaatshouders en
// drie bindingen liep hier groen en viel daar om. Dus telt deze schil mee.
import { DatabaseSync } from "node:sqlite";

// Plaatshouders tellen zonder te struikelen over een vraagteken in een
// tekstwaarde, in een -- commentaar of in een /* blok */.
function telPlaatshouders(sql) {
  let n = 0;
  let in1 = false, in2 = false, inRegel = false, inBlok = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], v = sql[i + 1];
    if (inRegel) { if (c === "\n") inRegel = false; continue; }
    if (inBlok) { if (c === "*" && v === "/") { inBlok = false; i++; } continue; }
    if (in1) { if (c === "'") in1 = false; continue; }
    if (in2) { if (c === '"') in2 = false; continue; }
    if (c === "-" && v === "-") { inRegel = true; i++; continue; }
    if (c === "/" && v === "*") { inBlok = true; i++; continue; }
    if (c === "'") { in1 = true; continue; }
    if (c === '"') { in2 = true; continue; }
    if (c === "?") n++;
  }
  return n;
}

export function maakDB(pad) {
  const db = new DatabaseSync(pad);
  // D1 dwingt verwijzingen af; dan moet de proefdatabase dat ook doen, anders
  // test je iets anders dan wat er in productie gebeurt.
  db.exec("pragma foreign_keys = on");

  const maakStatement = (sql) => {
    const nodig = telPlaatshouders(sql);
    const controleer = (b) => {
      if (b.length !== nodig) {
        const kort = sql.trim().replace(/\s+/g, " ").slice(0, 120);
        throw new Error(
          `D1_ERROR: Wrong number of parameter bindings for SQL query. ` +
          `${nodig} nodig, ${b.length} gegeven — ${kort}…`
        );
      }
    };
    return {
      bind(...b) {
        controleer(b);
        return {
          async first() { return db.prepare(sql).get(...b) ?? null; },
          async all() { return { results: db.prepare(sql).all(...b) }; },
          async run() {
            const r = db.prepare(sql).run(...b);
            return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
          },
        };
      },
      async first() { controleer([]); return db.prepare(sql).get() ?? null; },
      async all() { controleer([]); return { results: db.prepare(sql).all() }; },
      async run() {
        controleer([]);
        const r = db.prepare(sql).run();
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    };
  };

  return {
    prepare: maakStatement,
    async batch(lijst) { for (const s of lijst) await s.run?.(); return []; },
  };
}
