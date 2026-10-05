// Tijdstippen lezen zoals de database ze schrijft.
//
// D1 schrijft 'jjjj-mm-dd uu:mm:ss', zonder zone, in UTC. De voor de hand
// liggende manier om dat te lezen is `new Date(s.replace(" ", "T") + "Z")`, en
// die was op drie plekken overgeschreven met drie keer hetzelfde randgeval erin:
//
//   - replace() vervangt alleen de eerste spatie;
//   - een moment dat zelf al ISO is krijgt een tweede Z en wordt NaN, waarna de
//     leeftijd van een kaart stil 'null' werd en hij nooit opschaalde;
//   - een lege of onleesbare waarde gaf een Date waar daarna mee gerekend werd.
//
// Eén plek, en hij geeft null terug als hij het niet zeker weet.
export function leesMoment(w) {
  const s = String(w || "").trim();
  if (!s) return null;

  // Al een volledige ISO-tekst met zone: laat die met rust.
  const d = /[zZ]$|[+-]\d{2}:\d{2}$/.test(s)
    ? new Date(s)
    : new Date(`${s.slice(0, 10)}T${s.length > 10 ? s.slice(11, 19) : "00:00:00"}Z`);

  return Number.isNaN(d.getTime()) ? null : d;
}

// Hoeveel uur geleden. Een onleesbaar of toekomstig moment geeft 0: 'dit wacht
// al min drie uur' is geen zinnige uitspraak om een scherm mee te vullen.
export function urenSinds(moment, nu = null) {
  const toen = leesMoment(moment);
  if (!toen) return 0;
  const nu2 = nu instanceof Date ? nu : (nu ? leesMoment(nu) || new Date(nu) : new Date());
  if (!nu2 || Number.isNaN(nu2.getTime())) return 0;
  return Math.max(0, (nu2 - toen) / 3600000);
}

// Zoals de database het schrijft.
export function alsTekst(d) {
  const dd = d instanceof Date ? d : leesMoment(d);
  return dd ? dd.toISOString().slice(0, 19).replace("T", " ") : null;
}
