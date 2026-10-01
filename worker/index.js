// Delta Blueprint Cockpit — worker
// Etappe 0: alleen bewijzen dat de uitrol en de databasebinding werken.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/gezondheid") {
      let db = "niet bereikbaar";
      try {
        const r = await env.DB.prepare("select versie from schema_versie order by versie desc limit 1").first();
        db = r ? `schema versie ${r.versie}` : "leeg";
      } catch (e) {
        db = `fout: ${e.message}`;
      }
      return Response.json({
        ok: true,
        omgeving: env.OMGEVING,
        database: db,
        tijd: new Date().toISOString(),
      });
    }

    return new Response("Delta Blueprint Cockpit", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
