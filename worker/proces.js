// Het proces in beeld: welke fase, en wat er in die fase gedaan moet worden.
//
// De fasen en de stappen staan in Procesbeheer (`proces` en `processtap`); dit
// bestand weet alleen hóe je nagaat of een stap gedaan is. Elke stap draagt
// daarvoor de naam van een regel (`afvinkregel`), en hieronder staat per naam
// één functie. Een stap toevoegen is dus een regel in de database; alleen een
// nieuw soort controle vraagt om een regel code.
//
// Niets hiervan zet iets in beweging: het leest alleen. Wat de fase laat
// opschuiven staat in `fasebeweging` onderaan, en ook dat gebeurt pas als de
// gate werkelijk gehaald is.

const tel = async (env, sql, ...binden) => {
  try {
    const r = await env.DB.prepare(sql).bind(...binden).first();
    return r ? Number(r.n) : 0;
  } catch {
    return 0;
  }
};

const gevuld = (w) => w !== null && w !== undefined && String(w).trim() !== "";

// ---------------------------------------------------------------- de regels
// Elke regel geeft terug of de stap gedaan is, en mag er een tussenstand bij
// zetten ("2 van 3") zodat je ziet waar je staat in plaats van alleen dát het
// nog niet af is.
const REGELS = {
  // ---- cyclus ----
  async events_behandeld(env, rij) {
    const open = await tel(env,
      "select count(*) as n from cyclus_event where cyclus = ? and behandeling = 'nog te wegen'", rij.id);
    const alle = await tel(env, "select count(*) as n from cyclus_event where cyclus = ?", rij.id);
    return { gedaan: alle > 0 && open === 0, stand: alle ? `${alle - open} van ${alle}` : "geen events" };
  },

  async voorwaarden_ingevuld(env, rij) {
    const alle = await tel(env,
      "select count(*) as n from voorwaarde where cyclus = ? and archief = 0", rij.id);
    const open = await tel(env,
      "select count(*) as n from voorwaarde where cyclus = ? and archief = 0 and (status = 'niet gemeten' or gemeten_waarde is null)", rij.id);
    return { gedaan: alle > 0 && open === 0, stand: alle ? `${alle - open} van ${alle}` : "nog geen voorwaarden" };
  },

  async analysemoment_geprikt(env, rij) {
    return { gedaan: gevuld(rij.volgend_analysemoment) };
  },

  async besluit_aangemaakt(env, rij) {
    const n = await tel(env,
      "select count(*) as n from beoordelingsmoment where cyclus = ? and archief = 0", rij.id);
    return { gedaan: n > 0, stand: n ? `${n}` : "" };
  },

  async besluit_met_go(env, rij) {
    const go = await tel(env,
      `select count(*) as n from beoordelingsmoment
        where cyclus = ? and archief = 0 and status = 'uitkomst vastgelegd' and uitkomst = 'go'`, rij.id);
    const open = await tel(env,
      `select count(*) as n from beoordelingsmoment
        where cyclus = ? and archief = 0 and status <> 'uitkomst vastgelegd'`, rij.id);
    return { gedaan: go > 0, stand: open ? `${open} besluit${open === 1 ? "" : "en"} loopt nog` : "" };
  },

  async tranche_in_de_markt(env, rij) {
    const n = await tel(env,
      `select count(*) as n from positie
        where cyclus = ? and archief = 0 and status in ('bewaken', 'gesloten')`, rij.id);
    return { gedaan: n > 0, stand: n ? `${n}` : "" };
  },

  async alle_tranches_dicht(env, rij) {
    const alle = await tel(env, "select count(*) as n from positie where cyclus = ? and archief = 0", rij.id);
    const open = await tel(env,
      "select count(*) as n from positie where cyclus = ? and archief = 0 and status <> 'gesloten'", rij.id);
    return { gedaan: alle > 0 && open === 0, stand: alle ? `${alle - open} van ${alle}` : "" };
  },

  async postanalyse_gedaan(env, rij) {
    return { gedaan: gevuld(rij.resultaat_pt) };
  },

  // ---- besluit ----
  async aanwezigen_gekozen(env, rij) {
    const n = (rij.aanwezigen_ids || "").split(",").filter(Boolean).length;
    return { gedaan: n > 0, stand: n ? `${n} aanwezig` : "" };
  },

  async alleen_toegelicht(env, rij) {
    const n = (rij.aanwezigen_ids || "").split(",").filter(Boolean).length;
    if (n !== 1) return { gedaan: true, nvt: true };
    return { gedaan: gevuld(rij.alleen_reden), stand: "besloten door één persoon" };
  },

  async inzendingen_binnen(env, rij) {
    const nodig = (rij.aanwezigen_ids || "").split(",").filter(Boolean).length;
    const binnen = await tel(env,
      `select count(*) as n from inzending
        where beoordelingsmoment = ? and archief = 0 and status = 'verstuurd'`, rij.id);
    return { gedaan: nodig > 0 && binnen >= nodig, stand: nodig ? `${binnen} van ${nodig}` : "" };
  },

  async gesprek_vastgelegd(env, rij) {
    return { gedaan: gevuld(rij.wat_veranderde) };
  },

  async uitkomst_vastgelegd(env, rij) {
    return { gedaan: gevuld(rij.uitkomst), stand: rij.uitkomst || "" };
  },

  // ---- positie ----
  async exitplan_compleet(env, rij) {
    const regels = await tel(env,
      `select count(*) as n from exitregel
        where positie = ? and archief = 0 and soort = 'stoploss' and niveau is not null`, rij.id);
    const event = await tel(env,
      `select count(*) as n from exitregel
        where positie = ? and archief = 0 and soort = 'eventregel' and trim(coalesce(omschrijving,'')) <> ''`, rij.id);
    return { gedaan: regels > 0 && event > 0 };
  },

  async order_geplaatst(env, rij) {
    return { gedaan: Number(rij.order_geplaatst) === 1 };
  },

  async uitvoering_gekoppeld(env, rij) {
    return { gedaan: gevuld(rij.aantal) && gevuld(rij.ontvangen_premie_eur) };
  },

  async afwijking_geduid(env, rij) {
    if (Number(rij.afwijking) !== 1) return { gedaan: true, nvt: true };
    return { gedaan: gevuld(rij.afwijking_toelichting), stand: "wijkt af van het besluit" };
  },

  async publicatie_verstuurd(env, rij) {
    return { gedaan: Number(rij.gepubliceerd) === 1 };
  },

  async tranche_uitkomst(env, rij) {
    return { gedaan: gevuld(rij.uitkomst), stand: rij.uitkomst || "" };
  },
};

// Alle stappen van het proces dat op deze tabel loopt, met hun stand.
export async function stappenVoor(env, tabelnaam, rij) {
  let stappen = [];
  try {
    stappen = (await env.DB.prepare(
      `select s.* from processtap s
         join proces p on p.id = s.proces
        where p.toepassing = ? and p.archief = 0 and s.archief = 0
        order by s.volgorde`
    ).bind(tabelnaam).all()).results;
  } catch {
    return [];
  }

  const uit = [];
  for (const stap of stappen) {
    const regel = REGELS[stap.afvinkregel];
    const uitkomst = regel ? await regel(env, rij) : { gedaan: false };
    if (uitkomst.nvt && !uitkomst.stand) continue;     // niet van toepassing: dan ook niet tonen
    uit.push({
      naam: stap.naam,
      fase: stap.fase,
      uitleg: stap.uitleg,
      eigenaar: stap.eigenaar,
      verplicht: Boolean(stap.verplicht),
      gedaan: Boolean(uitkomst.gedaan),
      stand: uitkomst.stand || null,
    });
  }
  return uit;
}

// --------------------------------------------------- de fase laten opschuiven
// Een record schuift naar de volgende fase zodra alle verplichte stappen van
// zijn huidige fase gedaan zijn. Altijd vooruit en nooit terug: een cyclus die
// in positie staat, gaat niet terug naar besluitvorming omdat er een tweede
// besluit opent — er staat immers geld in de markt.
export async function beweegFase(env, tabelnaam, id) {
  let tabel;
  try {
    tabel = await env.DB.prepare("select naam, proces_veld from db_table where naam = ?").bind(tabelnaam).first();
  } catch {
    return null;
  }
  if (!tabel || !tabel.proces_veld) return null;

  const rij = await env.DB.prepare(`select * from "${tabelnaam}" where id = ?`).bind(id).first();
  if (!rij) return null;

  const fasen = (await env.DB.prepare(
    "select waarde from db_choice where tabel = ? and kolom = ? and actief = 1 order by volgorde"
  ).bind(tabelnaam, tabel.proces_veld).all()).results.map((r) => r.waarde);

  const stappen = await stappenVoor(env, tabelnaam, rij);
  let nu = fasen.indexOf(String(rij[tabel.proces_veld]));
  if (nu < 0) return null;

  const begon = nu;
  while (nu < fasen.length - 1) {
    const poort = stappen.filter((s) => s.fase === fasen[nu] && s.verplicht);
    if (!poort.length || !poort.every((s) => s.gedaan)) break;
    nu += 1;
  }

  if (nu === begon) return null;

  await env.DB.batch([
    env.DB.prepare(`update "${tabelnaam}" set "${tabel.proces_veld}" = ? where id = ?`).bind(fasen[nu], id),
    env.DB.prepare(
      `insert into audit (wie, tabel, record, soort, veld, oude_waarde, nieuwe_waarde, gebeurtenis)
       values ('systeem', ?, ?, 'veld', ?, ?, ?, 'fase opgeschoven')`
    ).bind(tabelnaam, id, tabel.proces_veld, fasen[begon], fasen[nu]),
  ]);

  return { van: fasen[begon], naar: fasen[nu] };
}
