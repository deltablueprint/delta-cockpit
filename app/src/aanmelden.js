import { aanmeldingOpslaan, aanmeldingWissen, ik } from "./api.js";

export function aanmeldscherm(klaar) {
  const wortel = document.getElementById("app");
  wortel.className = "aanmelden";
  wortel.innerHTML = `
    <form novalidate>
      <h1>Delta Wave Cockpit</h1>
      <p>Meld je aan met je eigen adres. Elke vastlegging draagt jouw naam.</p>
      <div><label for="email">E-mailadres</label><input id="email" type="email" autocomplete="username" autofocus></div>
      <div><label for="ww">Wachtwoord</label><input id="ww" type="password" autocomplete="current-password"></div>
      <div id="melding"></div>
      <button type="submit">Aanmelden</button>
    </form>`;

  const form = wortel.querySelector("form");
  const melding = wortel.querySelector("#melding");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knop = form.querySelector("button");
    const email = form.querySelector("#email").value.trim();
    const ww = form.querySelector("#ww").value;
    if (!email || !ww) return;

    knop.disabled = true;
    knop.textContent = "Bezig…";
    melding.innerHTML = "";
    aanmeldingOpslaan(email, ww);
    try {
      const persoon = await ik();
      klaar(persoon);
    } catch (fout) {
      aanmeldingWissen();
      melding.innerHTML = `<div class="fout">${fout.message}</div>`;
      knop.disabled = false;
      knop.textContent = "Aanmelden";
    }
  });
}
