// Een kleine namaak-D1 bovenop node:sqlite, zodat de worker-code tegen een
// echte database getest kan worden zonder Cloudflare. Alleen voor tests.
import { DatabaseSync } from "node:sqlite";

export function maakDB(pad) {
  const db = new DatabaseSync(pad);
  // D1 dwingt verwijzingen af; dan moet de proefdatabase dat ook doen, anders
  // test je iets anders dan wat er in productie gebeurt.
  db.exec("pragma foreign_keys = on");
  const maakStatement = (sql) => ({
    bind(...b) {
      return {
        async first() { return db.prepare(sql).get(...b) ?? null; },
        async all() { return { results: db.prepare(sql).all(...b) }; },
        async run() { const r = db.prepare(sql).run(...b); return { meta: { changes: Number(r.changes) } }; },
      };
    },
    async first() { return db.prepare(sql).get() ?? null; },
    async all() { return { results: db.prepare(sql).all() }; },
    async run() { const r = db.prepare(sql).run(); return { meta: { changes: Number(r.changes) } }; },
  });
  return {
    prepare: maakStatement,
    async batch(lijst) { for (const s of lijst) await s.run?.(); return []; },
  };
}
