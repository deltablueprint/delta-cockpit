// Zet een wachtwoord om in de SHA-256 hash die in de database komt.
// Gebruik:  node scripts/wachtwoord.mjs 'jouw wachtwoord'
// Het wachtwoord zelf gaat nergens heen; alleen de hash komt in de database.
const zin = process.argv[2];
if (!zin) { console.error("Geef je wachtwoord mee tussen aanhalingstekens."); process.exit(1); }
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(zin));
console.log([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""));
