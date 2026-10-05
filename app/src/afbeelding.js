// Een schermafdruk van een chart klaarmaken om te bewaren.
//
// De avatar wordt vierkant bijgesneden; een chart juist niet — daar gaat het om
// wat er in de hele afbeelding staat. Hij wordt alleen teruggeschaald tot een
// breedte waarop je de lijnen nog leest, en als JPEG opgeslagen. Een
// schermafdruk van een chart komt zo op een paar honderd kilobyte uit.
export function verkleinChart(bestand, maxBreedte = 1400, kwaliteit = 0.78) {
  return new Promise((klaar, mis) => {
    const lezer = new FileReader();
    lezer.onerror = () => mis(new Error("Kan het bestand niet lezen."));
    lezer.onload = () => {
      const beeld = new Image();
      beeld.onerror = () => mis(new Error("Dat is geen afbeelding."));
      beeld.onload = () => {
        const schaal = Math.min(1, maxBreedte / beeld.width);
        const doek = document.createElement("canvas");
        doek.width = Math.round(beeld.width * schaal);
        doek.height = Math.round(beeld.height * schaal);
        const t = doek.getContext("2d");
        t.fillStyle = "#fff";
        t.fillRect(0, 0, doek.width, doek.height);
        t.drawImage(beeld, 0, 0, doek.width, doek.height);
        klaar(doek.toDataURL("image/jpeg", kwaliteit));
      };
      beeld.src = lezer.result;
    };
    lezer.readAsDataURL(bestand);
  });
}

// Een afbeelding uit het klembord halen. Een schermafdruk plak je liever dan
// dat je hem eerst als bestand wegschrijft.
export function uitKlembord(gebeurtenis) {
  const items = (gebeurtenis.clipboardData && gebeurtenis.clipboardData.items) || [];
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

// Een afbeelding op ware grootte bekijken. In de rij staat een duimnagel —
// anders duwt één chart het hele gesprek van het scherm — en wie hem wil lezen
// klikt erop. Esc of een klik ernaast sluit hem weer.
export function toonGroot(bron, titel = "") {
  const laag = document.createElement("div");
  laag.className = "beeldlaag";
  laag.innerHTML = `
    <figure class="beeldgroot">
      <img src="${bron}" alt="">
      ${titel ? `<figcaption>${titel}</figcaption>` : ""}
    </figure>`;
  const sluit = () => {
    laag.remove();
    document.removeEventListener("keydown", opToets);
  };
  const opToets = (e) => { if (e.key === "Escape") sluit(); };
  laag.addEventListener("click", sluit);
  document.addEventListener("keydown", opToets);
  document.body.appendChild(laag);
}
