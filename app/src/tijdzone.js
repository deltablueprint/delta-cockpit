// Tijd in de zone van het event, getoond in de tijd van Brussel.
//
// De Verenigde Staten en Europa verzetten de klok op andere data. Daardoor is
// 14:00 in Washington meestal 20:00 bij ons, maar in de weken rond de wissel
// 19:00. Daarom rekenen we om bij het tónen, met de datum erbij, en slaan we
// de omgerekende tijd nooit op.

const BRUSSEL = "Europe/Brussels";

// Hoeveel loopt een zone voor op UTC, op dat moment?
function verschilMs(moment, zone) {
  const vorm = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const d = Object.fromEntries(vorm.formatToParts(moment).map((p) => [p.type, p.value]));
  const alsUtc = Date.UTC(+d.year, +d.month - 1, +d.day, +d.hour % 24, +d.minute, +d.second);
  return alsUtc - moment.getTime();
}

// Een lokale tijd in een zone omzetten naar het echte moment.
function naarMoment(datum, tijdstip, zone) {
  const [j, m, d] = String(datum).split("-").map(Number);
  const [u, min] = String(tijdstip).split(":").map(Number);
  if (!j || !m || !d || isNaN(u)) return null;
  const gok = Date.UTC(j, m - 1, d, u, min || 0);
  let verschil = verschilMs(new Date(gok), zone);
  // Tweede slag, voor de uren rond het verzetten van de klok.
  verschil = verschilMs(new Date(gok - verschil), zone);
  return new Date(gok - verschil);
}

// Geeft { tijd: "20:00", afkorting: "CET", zelfde: true/false }
export function inBrussel(datum, tijdstip, zone = BRUSSEL) {
  if (!datum || !tijdstip) return null;
  const moment = naarMoment(datum, tijdstip, zone);
  if (!moment || isNaN(moment)) return null;

  const vorm = new Intl.DateTimeFormat("nl-BE", {
    timeZone: BRUSSEL, hour12: false, hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
  const delen = Object.fromEntries(vorm.formatToParts(moment).map((p) => [p.type, p.value]));
  const afkorting = (delen.timeZoneName || "CET").replace("GMT+1", "CET").replace("GMT+2", "CEST");
  return {
    tijd: `${delen.hour}:${delen.minute}`,
    afkorting,
    zelfde: zone === BRUSSEL,
  };
}
