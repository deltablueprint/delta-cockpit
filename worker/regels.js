// Validatie uit db_rule. De taal is bewust klein: alles wat je nodig hebt om
// een regel te schrijven zonder code, en niets waarmee je per ongeluk iets
// kunt uitvoeren.
//
//   label nietleeg
//   doelexpiratie > geopend_op
//   fase <= 5
//   gemeten_waarde nietleeg_als status!=niet gemeten
//
// De rechterkant is een veldnaam als die bestaat, anders een letterlijke waarde.

const OPERATOREN = ["<=", ">=", "!=", "=", "<", ">"];

function waardeVan(stuk, record, velden) {
  const naam = stuk.trim();
  if (velden.some((v) => v.kolom === naam)) return record[naam];
  return naam;
}

function leeg(w) {
  return w === null || w === undefined || String(w).trim() === "";
}

function vergelijk(links, operator, rechts) {
  if (leeg(links) || leeg(rechts)) return true;   // niets om te vergelijken
  const a = isNaN(Number(links)) ? String(links) : Number(links);
  const b = isNaN(Number(rechts)) ? String(rechts) : Number(rechts);
  switch (operator) {
    case "=":  return a === b;
    case "!=": return a !== b;
    case "<":  return a < b;
    case ">":  return a > b;
    case "<=": return a <= b;
    case ">=": return a >= b;
    default:   return true;
  }
}

function voldoet(voorwaarde, record, velden) {
  const tekst = voorwaarde.trim();

  // vorm:  <veld> nietleeg_als <veld><op><waarde>
  const mitsDeel = /^(\S+)\s+nietleeg_als\s+(.+)$/.exec(tekst);
  if (mitsDeel) {
    const [, veld, rest] = mitsDeel;
    const op = OPERATOREN.find((o) => rest.includes(o));
    if (!op) return true;
    const [l, r] = rest.split(op);
    const geldtDeVoorwaarde = vergelijk(waardeVan(l, record, velden), op, waardeVan(r, record, velden));
    return geldtDeVoorwaarde ? !leeg(record[veld]) : true;
  }

  const losseVorm = /^(\S+)\s+(nietleeg|leeg)$/.exec(tekst);
  if (losseVorm) {
    const [, veld, soort] = losseVorm;
    return soort === "nietleeg" ? !leeg(record[veld]) : leeg(record[veld]);
  }

  const op = OPERATOREN.find((o) => tekst.includes(` ${o} `));
  if (!op) return true;
  const [l, r] = tekst.split(` ${op} `);
  return vergelijk(waardeVan(l, record, velden), op, waardeVan(r, record, velden));
}

export async function toets(env, tabelnaam, record, velden) {
  const regels = (await env.DB.prepare(
    `select * from db_rule where tabel = ? and versie_tot is null`
  ).bind(tabelnaam).all()).results;

  const blokkades = [];
  const waarschuwingen = [];
  for (const regel of regels) {
    let ok = true;
    try {
      ok = voldoet(regel.voorwaarde, record, velden);
    } catch {
      ok = true;   // een kapotte regel mag nooit het opslaan tegenhouden
    }
    if (ok) continue;
    (regel.blokkeert ? blokkades : waarschuwingen).push({ veld: regel.kolom, melding: regel.melding });
  }
  return { blokkades, waarschuwingen };
}
