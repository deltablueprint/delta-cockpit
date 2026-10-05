// Favorieten en geschiedenis tegen een echte database.
import { verseDB } from "./db.mjs";
import {
  favorieten, favorietToevoegen, favorietWijzigen, favorietWeg, favorietenVolgorde,
  bezoeken, bezoekBijzetten, bezoekenLeeg,
} from "../../worker/navigator.js";

const env = { DB: verseDB() };
const ik = { id: "simon" };
const toon = (w, x) => console.log(w, JSON.stringify(x));

const a = await favorietToevoegen(env, ik, { route: "/t/cyclus?f.status=bewaken", label: "Cycli in bewaking", kleur: "groen", icoon: "oog" });
const b = await favorietToevoegen(env, ik, { route: "/t/positie", label: "Posities" });
toon("aangemaakt  ", [a, b]);
toon("lijst       ", (await favorieten(env, ik)).favorieten);

await favorietWijzigen(env, ik, b.id, { label: "Mijn tranches", kleur: "rood", icoon: "doel" });
await favorietenVolgorde(env, ik, [b.id, a.id]);
toon("na wijzigen ", (await favorieten(env, ik)).favorieten);

toon("vreemde kleur geweigerd", (await favorietWijzigen(env, ik, b.id, { kleur: "neon" })));
toon("kleur nu    ", (await favorieten(env, ik)).favorieten.find((f) => f.id === b.id).kleur);

await favorietWeg(env, ik, a.id);
toon("na weghalen ", (await favorieten(env, ik)).favorieten.map((f) => f.label));
toon("van een ander", await favorieten(env, { id: "jacqueline" }));

await bezoekBijzetten(env, ik, { route: "/t/cyclus/3", titel: "Cyclus 2026-11", soort: "Cyclus" });
await bezoekBijzetten(env, ik, { route: "/t/cyclus/3", titel: "Cyclus 2026-11", soort: "Cyclus" });
await bezoekBijzetten(env, ik, { route: "/t/positie/9", titel: "Tranche 1", soort: "Positie" });
toon("bezoeken    ", (await bezoeken(env, ik)).bezoeken.map((b) => `${b.titel} (${b.route})`));

for (let i = 0; i < 40; i++) await bezoekBijzetten(env, ik, { route: `/t/event/${i}`, titel: `Event ${i}` });
toon("afgekapt op ", (await bezoeken(env, ik)).bezoeken.length);

await bezoekenLeeg(env, ik);
toon("na wissen   ", (await bezoeken(env, ik)).bezoeken.length);
