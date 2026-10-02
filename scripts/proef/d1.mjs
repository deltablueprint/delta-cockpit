// Een kleine namaak-D1 bovenop node:sqlite, zodat de worker-code tegen een
// echte database getest kan worden zonder Cloudflare. Alleen voor tests.
import { DatabaseSync } from "node:sqlite";

export function maakDB(pad) {
  const db = new DatabaseSync(pad);
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
