// Zet een wachtwoordzin om in de SHA-256 hash die in de database komt.
// Gebruik:  node scripts/sleutel.mjs 'jouw wachtwoordzin'
// De zin zelf gaat nergens heen; alleen de hash komt in de database.
const zin = process.argv[2];
if (!zin) { console.error("Geef je wachtwoordzin mee tussen aanhalingstekens."); process.exit(1); }
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(zin));
const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
console.log(hex);
