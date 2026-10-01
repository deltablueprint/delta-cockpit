// De lijst. Eén component voor elke tabel: kolommen, filters en sortering
// komen uit de definitielaag (BOUWSPEC 10.0c). Geen enkel scherm verzint
// een eigen tabelopmaak.

import { lijst as haalLijst } from "./api.js";

const KLEUR = {
  groen:  ["var(--grn)",  "var(--grnbg)"],
  oranje: ["var(--amb)",  "var(--ambbg)"],
  rood:   ["var(--red)",  "var(--redbg)"],
  blauw:  ["var(--blue)", "var(--bluebg)"],
  grijs:  ["var(--mut)",  "var(--head)"],
};

function badge(label, kleur) {
  const [fg, bg] = KLEUR[kleur] || KLEUR.grijs;
  return `<span class="badge" style="color:${fg};background:${bg}">${label}</span>`;
}

function toonWaarde(veld, waarde, meta) {
  if (waarde === null || waarde === undefined || waarde === "") {
    return `<span class="faint">—</span>`;
  }
  if (veld.type === "keuze") {
    const keuzes = meta.keuzes[`${veld.tabel}.${veld.kolom}`] || [];
    const k = keuzes.find((x) => x.waarde === waarde);
    return k ? badge(k.label, k.kleur) : waarde;
  }
  if (veld.type === "getal" && veld.kolom.endsWith("_pt")) {
    const n = Number(waarde);
    const kleur = n > 0 ? "var(--grn)" : n < 0 ? "var(--red)" : "var(--ink2)";
    const teken = n > 0 ? "+" : n < 0 ? "−" : "";
    return `<span style="color:${kleur};font-weight:600">${teken} ${Math.abs(n).toFixed(1).replace(".", ",")} pt</span>`;
  }
  if (veld.type === "datum") return formatteerDatum(waarde);
  if (veld.type === "tijdstip") return `${formatteerDatum(waarde.slice(0, 10))} ${waarde.slice(11, 16)}`;
  return String(waarde);
}

const MAANDEN = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
function formatteerDatum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return s;
  return `${Number(m[3])} ${MAANDEN[Number(m[2]) - 1]} ${m[1]}`;
}

export async function lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand) {
  inhoud.innerHTML = `<div class="kaart leeg">Bezig met laden…</div>`;

  const params = new URLSearchParams();
  if (toestand.q) params.set("q", toestand.q);
  if (toestand.sorteer) { params.set("sorteer", toestand.sorteer); params.set("richting", toestand.richting); }

  let data;
  try {
    data = await haalLijst(tabelnaam, params);
  } catch (fout) {
    inhoud.innerHTML = `<div class="fout">${fout.message}</div>`;
    return;
  }

  kruimel.textContent = data.tabel.label_mv;

  const kop = `
    <div class="titelrij">
      <h1>${data.tabel.label_mv}</h1>
      <span class="sub">${data.totaal} ${data.totaal === 1 ? data.tabel.label.toLowerCase() : data.tabel.label_mv.toLowerCase()}</span>
    </div>`;

  const toolbar = `
    <div class="lijstkop">
      <span class="lijsttitel">${data.tabel.label_mv}</span>
      <label class="zoeklabel" for="zoek">Zoeken</label>
      <input id="zoek" class="zoek" type="search" placeholder="Zoeken" value="${toestand.q || ""}">
      <span class="teller">${data.totaal === 0 ? "geen regels" : `1 tot ${Math.min(data.limiet, data.totaal)} van ${data.totaal}`}</span>
    </div>`;

  const kolommen = data.kolommen;
  const grid = `grid-template-columns: 30px ${kolommen.map((k) =>
    k.type === "lang" ? "minmax(0,2fr)" : k.type === "tekst" ? "minmax(0,1fr)" : "minmax(110px,auto)"
  ).join(" ")};`;

  const kopregel = `
    <div class="rij kopregel" style="${grid}">
      <div></div>
      ${kolommen.map((k) => `
        <div class="cel sorteerbaar" data-kolom="${k.kolom}">
          ${k.label}${toestand.sorteer === k.kolom ? (toestand.richting === "desc" ? " ↓" : " ↑") : ""}
        </div>`).join("")}
    </div>`;

  const rijen = data.rijen.length
    ? data.rijen.map((r) => `
        <div class="rij" style="${grid}">
          <div class="cel"><input type="checkbox" aria-label="Selecteer regel"></div>
          ${kolommen.map((k, i) => `
            <div class="cel">${i === 0
              ? `<a href="#/t/${tabelnaam}/${r.id}" class="recordlink">${toonWaarde(k, r[k.kolom], meta)}</a>`
              : toonWaarde(k, r[k.kolom], meta)}</div>`).join("")}
        </div>`).join("")
    : `<div class="geenregels">Nog geen ${data.tabel.label_mv.toLowerCase()}. Ze worden aangemaakt vanaf het record waar ze bij horen.</div>`;

  inhoud.innerHTML = kop + `<div class="lijst">${toolbar}${kopregel}${rijen}</div>`;

  const zoek = inhoud.querySelector("#zoek");
  let timer;
  zoek.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      toestand.q = zoek.value.trim();
      lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand);
    }, 250);
  });

  inhoud.querySelectorAll(".sorteerbaar").forEach((el) => {
    el.addEventListener("click", () => {
      const kolom = el.dataset.kolom;
      if (toestand.sorteer === kolom) {
        toestand.richting = toestand.richting === "asc" ? "desc" : "asc";
      } else {
        toestand.sorteer = kolom;
        toestand.richting = "asc";
      }
      lijstscherm(inhoud, kruimel, tabelnaam, meta, toestand);
    });
  });
}
