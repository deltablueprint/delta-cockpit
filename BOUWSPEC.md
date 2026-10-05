# Delta Blueprint — bouwspecificatie operationeel dashboard

**Versie 3.7 · 1 oktober 2026**

Dit bestand is de geconsolideerde bron waarop het bouwen zich baseert. Besluiten worden genomen in het bouwplan-document en in het go/no-go-protocol van Jacqueline; dit bestand is het resultaat daarvan, bijgewerkt zodra er iets verandert. Wijkt dit bestand af van een genomen besluit, dan is dit bestand verouderd en moet het worden bijgewerkt — niet het besluit.

Openstaande punten staan als **OPEN** gemarkeerd en mogen niet stilzwijgend worden ingevuld tijdens het bouwen.

*In versie 3.7 is etappe 10 gebouwd: `beoordelingsmoment` en `inzending`, de serverzijdige afscherming, het quorum uit `processtap` en de twee actieschermen — met het eerste stuk Procesbeheer eronder (10.4). Ook: vergevingsgezind zoeken en namen in plaats van nummers in lijsten (10.0c).*

*In versie 3.6 zijn de weging per cyclus (3.2, 3.3), het automatisch bijvullen van events, de gemeten kolombreedte, *Nieuw* vanuit een zelfstandige lijst en de duidelijker gerelateerde lijsten vastgelegd (10.0c).*

*In versie 3.1 zijn hoofdstuk 3 (datamodel), 5 (go/no-go) en 13 (bouwvolgorde) gelijkgetrokken met de flow uit 10.0e en 10.0f: `voorstel` en `voorgenomen_positie` zijn vervangen door `inzending`, `besluit` door `beoordelingsmoment`, `besluit_voorwaarde` door `moment_voorwaarde`, de tweede oordeelsronde is vervallen en het quorum staat op de processtap. Er staan geen twee generaties meer naast elkaar.*

---

## 1. Harde uitgangspunten

Deze regels gelden overal en worden nergens door een instelling overruled.

1. **Het systeem handelt nooit zelf.** Er komt geen route in die een order plaatst. De brokerkoppeling leest uitsluitend. Bij een drempeloverschrijding meldt het systeem, legt vast, en wacht op een menselijk besluit.
2. **Niets wordt verwijderd.** Records krijgen een archiefstatus en verdwijnen uit de standaardweergave. Er is geen DELETE-route in de API en geen verwijderknop in de interface.
3. **Configuratie staat in de database, niet in de code.** Velden, modules, drempels, gewichten, validatie- en rekenregels worden vanuit de interface beheerd. Alleen bouwstenen en bronnen zijn ontwikkelwerk.
4. **Eén rol.** Alle co-founders hebben gelijke rechten en mogen alles, inclusief de regels. De audit trail draagt daardoor het volledige gewicht: elke wijziging aan een formule, drempel of gewicht wordt vastgelegd met naam en tijdstip.
5. **Naar leden gaat een afgeleide toestand, nooit marktdata.** Geen doorgegeven koersen, geen drempels, geen gewichten, geen individuele voorstellen.
6. **Interface volledig Nederlands.** Kolomnamen in de database blijven Engels.
7. **Werkt op desktop, iPad en iPhone.** Geen aparte mobiele versie, geen native app. Een scherm is pas af als het op alle drie de breedtes klopt.
8. **Elke co-founder heeft een eigen identiteit en eigen sleutel.** Nooit een gedeeld token. Zonder persoonsgebonden identiteit zijn blind indienen en de audit trail waardeloos.
9. **Niet betrouwbaar gemeten is niet gemeten.** Zakt een meting door de betrouwbaarheidstoets, ontbreekt ze, of is ze over haar houdbaarheid, dan is de status van de voorwaarde *niet gemeten* — nooit stilzwijgend groen. Dit geldt voor élke voorwaarde, ongeacht brontype.
10. **De rekenlaag is geversioneerd.** Een regel wordt nooit overschreven; een wijziging sluit de bestaande versie en opent een nieuwe. Elke cyclus rekent tegen de configuratieversie die bij het openen is vastgepind.

---

## 2. Fasemodel

Een cyclus is een **boog**, geen kalendermaand. Hij opent bij de pre-analyse en sluit als de laatste tranche weg is. Hij mag wachten en over een maandgrens lopen.

**Cycli overlappen niet.** Er staat hoogstens één cyclus open. Een cyclus wordt altijd eerst afgesloten voordat de volgende opent: laatste tranche weg, verslag geschreven, cyclus gesloten — pas dan kan *nieuwe cyclus*. De knop staat er altijd, maar is uitgeschakeld zolang er een cyclus loopt, met de reden erbij. Wat binnen één cyclus wél mag: meerdere tranches na elkaar, doorrollen naar een verdere expiratie, en daarmee een looptijd die veel langer is dan een maand. Een rol verlengt de cyclus, hij opent er geen tweede.

Gevolg voor het model: `cyclus` krijgt een uniciteitsregel op status — hoogstens één record met een status vóór *afgesloten*. Die regel wordt afgedwongen bij het aanmaken, niet alleen in het scherm.

| Fase | Van | Tot |
| --- | --- | --- |
| Pre-analyse | cyclus geopend | eerste uitgevoerde tranche |
| In positie | eerste uitgevoerde tranche | laatste tranche gesloten of geëxpireerd |
| Post-analyse | laatste tranche weg | verslag afgerond en cyclus afgesloten |

- De fase stuurt zichtbaarheid van secties, bewerkbaarheid van velden, aanwezige knoppen en welke velden live ververst worden. Dit is configuratie, geen apart schermtype.
- Fasewissel is een expliciete handeling met bevestiging, met naam en tijdstip in de audit trail. Terugzetten kan alleen met reden.
- **De grens tussen cycli ligt bij de analyse, niet bij de expiratie.** Een tranche uit hetzelfde analysemoment en go-besluit hoort bij dezelfde cyclus, ook met een andere expiratie. Een nieuwe pre-analyse is een nieuwe cyclus, ook bij dezelfde expiratie.
- **Wachten is een toestand.** Leidt een analysemoment niet tot instap, dan blijft de cyclus in pre-analyse met status *wachtend op instapvenster* en wordt meteen het volgende analysemoment geprikt. Geen teller.
- **Doelexpiratie is richtinggevend, niet bindend.** Doorrollen van de doelexpiratie vóór instap is een beoordelingsmoment met reden, geen stille veldwijziging.

---

## 3. Datamodel

### 3.1 Definitielaag

| Tabel | Houdt bij |
| --- | --- |
| `db_table` | Naam, label, enkelvoud/meervoud, welk veld het recordtitel is, welke module ernaar verwijst |
| `db_field` | Per tabel: kolomnaam, label, type, volgorde, sectie, verplicht, alleen-lezen, standaardwaarde |
| `db_choice` | Keuzelijstwaarden per veld, met label, volgorde en kleur |
| `db_module` | Menu-items: label, doeltabel, standaardfilter, volgorde, applicatiegroep |
| `db_view` | Kolommen en sortering per lijstweergave |
| `db_rule` | Validatieregels: veld, voorwaarde, melding, blokkeert of waarschuwt |
| `db_calc` | Berekende velden en scoreregels, samengesteld uit bouwstenen |
| `configuratieversie` | Nummer, aangemaakt op, door wie, omschrijving, in gebruik door welke cycli, bevroren ja/nee |

**Versionering.** De *rekenlaag* — `db_calc`, `db_rule`, de standaardset-sjablonen en `analyseveld` — draagt per rij `versie_vanaf` en `versie_tot` (beide verwijzend naar `configuratieversie`). De *presentatielaag* — `db_table`, `db_field`, `db_choice`, `db_module`, `db_view` — wordt niet geversioneerd maar ook nooit verwijderd, alleen gearchiveerd. Zie 3.4.

### 3.2 Inhoudelijke laag

| Tabel | Eén record is | Velden |
| --- | --- | --- |
| `cyclus` | Eén cyclus | Volgnummer, label, **status** (pre-analyse / go-nogo / uitvoering ophalen / in positie / post-analyse / afgesloten), **fase** (1–5, wat de leden zien), configuratieversie, geopend op, inleesperiode vanaf, kalender gereed op, beoogde instapdatum, reden bij afwijkende instapdatum, doelexpiratie, volgend analysemoment, eerste instap, eerstvolgende expiratie, laatste expiratie, afgesloten op, voortgangsscore, blootstelling van deze cyclus, taakverdeling tijdens de looptijd, deelnemers aan de meeting, niet-ingenomen positie bij no-go, schaduwresultaat, gepubliceerd op |
| `voorwaarde` | Eén regel binnen een cyclus | Naam, groep, fase, signaal, type, **brontype (meting / beoordeling / handmatig)**, bron, **toegewezen rol**, **houdbaarheid**, operator, drempel, gewicht, harde gate, status, gemeten waarde, uit de standaardset ja/nee |
| `beoordeling` | Een ingevulde menselijke beoordeling bij een voorwaarde met brontype *beoordeling* | Cyclus, voorwaarde, wie, tijdstip, eindoordeel (groen/oranje/rood), motivering, bijlagen |
| `chartanalyse` | Eén geüploade chart | Beoordeling, bijlage (afbeelding), volgorde, oordeel |
| `analyseveld` | Sjabloon van één parameter, in de standaardset | Naam, type (tekst/getal/keuze), eenheid, verplicht, volgorde, `versie_vanaf`, `versie_tot` |
| `chartanalyse_waarde` | De waarde van één parameter bij één chart | Chartanalyse, analyseveld, waarde |
| `handelsdag` | Eén kalenderdag van één beurs | Datum, beurs, status (open / dicht / halve dag), openingstijd, sluitingstijd, bron (import of handmatig) |
| `portefeuille_instelling` | De sizing- en bufferafspraken, met geldigheid | Kapitaal, maximale inzet in %, minimale reserve in %, maximale inzet per cyclus in %, overschrijding waarschuwt of blokkeert, geldig vanaf, wie |
| `moment_voorwaarde` | *Fase 2.* Eén regel van de voorwaardentabel zoals ze bij één beoordelingsmoment stond | Beoordelingsmoment, voorwaarde, naam, bron, drempel, gemeten waarde, meettijdstip, gewicht, harde gate, status |
| `event` | Eén gebeurtenis in de kalender | Datum, tijdstip (lokaal) met tijdzone, naam, soort, **zwaarte (algemeen)** — hoe zwaar deze gebeurtenis in het algemeen weegt —, bron, wie de zwaarte zette |
| `cyclus_event` | De behandeling van één event binnen één cyclus | Cyclus, event, **zwaarte in deze cyclus**, **waarom afwijkend**, behandeling, motivering, wie, wanneer |
| `inzending` | De blind verstuurde beslissing van één co-founder op één beoordelingsmoment | Cyclus, beoordelingsmoment, deelnemer, status (concept / verstuurd), **beslissing** (go of no-go; het veld heet in de database nog `positie`, maar *positie* is in deze applicatie een uitgevoerde tranche — op het scherm staat dus *Beslissing*), **strike**, **expiratiedatum**, **inzet in % van het kapitaal**, reden (verplicht bij no-go), motivering, intuïtieve waarneming, **wat ik zag** (de stand van de markt op het moment van versturen), verstuurd op. Afgeleid bij het versturen en meebewaard: aantal contracten, verwachte premie in punten en in euro, delta, theta, impliciete volatiliteit, skew, afstand tot de markt, buffer in procent, verhouding premie/risico |
| `positie` | Eén **uitgevoerde** tranche | Cyclus, beoordelingsmoment, volgnummer van de tranche, contract, strike, expiratie, aantal, ontvangen premie, delta, theta, impliciete volatiliteit, skew, afstand tot de markt, buffer in procent, verhouding premie/risico, **status** (order geplaatst / uitvoering importeren / bewaken / uitkomst vastleggen / gesloten), **exitplan als velden**: stoploss (altijd ask 60,0), winstanker in % van de ontvangen premie, break-even, eventregel; uitvoeringstijdstip, sluittijdstip, herkomst (broker/handmatig), doorgerold naar, **afwijking van besluit ja/nee**, **soort afwijking**, **toelichting bij afwijking** |
| `meting` | Eén uitlezing van een bron | Bron, waarde, tijdstip, geslaagd ja/nee, spreadbreedte, binnen handelsuren |
| `beoordelingsmoment` | Eén go/no-go op één cyclus | Cyclus, datum, aanleiding, **status** (blind versturen / inzendingen open / uitkomst vastgelegd), quorum gehaald op, aanwezigen, **uitkomst** (go of no-go), strike, expiratiedatum, aantal contracten, wat het gesprek veranderde, vastgelegd door, vastgelegd op, volgend beoordelingsmoment bij no-go |
| `publicatie` | Eén mededeling aan de leden | Cyclus, soort, titel, tekst, video, tekstversie van de video, verwijzing bij rectificatie, wie, wanneer |
| `toetsing` | Het oordeel achteraf over één voorwaarde | Cyclus, voorwaarde, oordeel (hielp/neutraal/misleidend), toelichting, wie, wanneer |
| `audit` | Eén wijziging aan een record | Tabel, record, veld, oude waarde, nieuwe waarde, wie, wanneer |

### 3.2a De stroom — één tijdlijn per cyclus (migratie 0101)

Wat er in een cyclus gebeurt stond tot nu toe verspreid: een uitvoering in `brokergebeurtenis`, een besluit in `beoordelingsmoment`, een bericht in `publicatie`, een wijziging in `audit`. Je kunt zien wát er staat, maar niet wanneer er wat gebeurde en in welke volgorde.

De tabel `gebeurtenis` legt dat op één tijdlijn. Eén rij is één gebeurtenis, met een **bron**: `ibkr` (de brug meldde een uitvoering), `meting` (een waarde ging over een drempel), `klok` (een datum of een ritme), `mens` (een van ons deed iets). Verder draagt ze een titel in gewone woorden, een regel detail, de feiten als JSON, en hoogstens één verwijzing naar waar het over gaat: positie, publicatie, beoordelingsmoment of processtap.

**Dit is etappe A van de werkbank-als-wachtrij.** Twee velden staan er al in en blijven voorlopig leeg:

- `vraagt_antwoord` — wordt de wachtrij: een gebeurtenis die een antwoord vraagt en het nog niet heeft, is een kaart.
- `sleutel` — houdt die kaarten uniek (uniek-index), zodat dezelfde gebeurtenis niet twee keer gaat openstaan. Dit is het enige stuk dat in etappe C echt goed moet zitten.

**Schrijven mag nooit de handeling breken waar het bij hoort.** `worker/stroom.js` vangt zijn eigen fouten op en geeft `null` terug: een mislukte log is vervelend, een mislukte spiegeling is erger. `scripts/proef/stroom.mjs` test dat expliciet.

De zes plekken die nu meeschrijven, alle in code die er al stond:

| Waar | Soort | Bron |
|---|---|---|
| `spiegel()` — een contract verschijnt | `positie_geopend` | ibkr |
| `spiegel()` — een contract verdwijnt | `positie_gesloten` | ibkr |
| `zetConceptKlaar()` | `concept_klaargezet` | ibkr |
| `wijsToe()` | `positie_toegewezen` | mens |
| `verstuurPublicatie()` | `bericht_verstuurd` | mens |
| `gonogo.uitkomst()` | `besluit_vastgelegd` | mens |

**De hartslag van de brug schrijft niets.** Elke tien seconden een regel is meten, geen gebeurtenis.

**Geen terugwerkende kracht.** De stroom begint leeg op de dag dat 0101 live gaat. Oude cycli krijgen geen geschiedenis: een reconstructie achteraf is duurder dan ze waard is, en ze zou niet kloppen.

**`auditlog` blijft bestaan.** Pas als de stroom een paar cycli heeft bewezen, bekijken we of audit erin opgaat. Niet eerder, en niets wordt gewist.

### 3.2b ~~De kaartdefinitie — de wachtrij staat in de database~~ (migratie 0102, vervallen)

> **Vervallen op 5 oktober 2026.** Deze paragraaf beschrijft de taakkaartlaag zoals die tussen 2 en 5 oktober bestond. Hij staat er nog omdat de overweging erin de moeite waard is, niet omdat het zo werkt. Zie **§13b** voor wat ervoor in de plaats komt.

**Etappe B van de werkbank-als-wachtrij.** Welke kaarten bestaan en wanneer ze verschijnen hoort niet in de code. Dat is procesinrichting, en die staat in dit systeem al ergens: op `processtap`.

**Een kaart ís een processtap.** Dezelfde rij die zegt "deze stap hoort bij deze stand van dit record" zegt er met negentien nieuwe kolommen bij: hoe de kaart heet, waar de aanleiding vandaan komt, wanneer hij opent, hoe hij in de rij heet, welke twee knoppen eronder staan en wat die doen. Een processtap **zonder** `kaartsoort` is een gewone stap en verandert niet. Een processtap **met** `kaartsoort` is een kaartdefinitie.

De kolommen, in drie groepen:

| Groep | Kolommen | Wat ze doen |
|---|---|---|
| Wanneer | `kaartsoort`, `bron`, `voorwaarde`, `sleutel_bron` | welke gebeurtenis een kaart wordt, en wanneer twee aanleidingen dezelfde kaart zijn |
| Hoe dringend | `prioriteit`, `opschalen_na_uur`, `opschalen_naar` | hoog/medium/laag, en hoe de kaart vanzelf omhoog kruipt |
| Wat je ziet | `reden`, `kaarttitel`, `feiten`, `knop1_*`, `knop2_*`, `prullenbak`, `prullenbak_doel`, `tweede_lezer` | de kaart zelf |

Vier dingen liggen hiermee vast:

- **De sleutel is het enige wat echt goed moet zitten.** `sleutel_bron` zegt wanneer twee aanleidingen dezelfde kaart zijn — per positie, per cyclus en week, per moment en deelnemer, per publicatie en lezer, per maand. Zonder dat staat na drie keer draaien dezelfde vraag drie keer in de rij.
- **Prioriteit is rood, amber of grijs — nooit groen.** Groen betekent in dit systeem overal 'in orde', en een kaart die openstaat is dat juist niet. Opschalen gaat alleen omhoog; de proef weigert een definitie die naar beneden schaalt of die opschaalt zonder termijn.
- **De prullenbak wist niets.** `prullenbak_doel` is `afsluiten` of `uitstellen`. Een kaart wegklikken is een antwoord, en antwoorden blijven staan.
- **De tweede lezer is een echte gebruiker** (`verwijzing` naar `gebruiker`), geen keuzelijstje dat naast de gebruikerstabel gaat leven.

De twaalf kaarten die er nu staan: nieuwe positie, sluiting, doorrol, barometerstand, week-update, technische analyse, go/no-go, reviewbesluit, herbeoordeling, bericht nalezen, maandverslag, maandbericht.

**Het proces `Wachtrij` (id 4) heeft met opzet `toepassing = 'wachtrij'`** — geen tabelnaam. `stappenVoor()` zoekt op `toepassing = <tabelnaam>`, dus geen enkel recordscherm pikt deze stappen per ongeluk op als zijn eigen stappenlijst. `scripts/proef/kaartdefinitie.mjs` bewaakt dat er ook nooit een tabel zo gaat heten.

**Er draait nog niets.** 0102 zet alleen de definitie neer. De motor die hiernaar kijkt en gebeurtenissen omzet in kaarten is etappe C.

### 3.2c ~~De motor — van gebeurtenis naar kaart~~ (vervallen; worker/motor.js is verwijderd)

> **Vervallen op 5 oktober 2026.** Zie §13b.

**Etappe C.** De wachtrij is een vraag over één tabel:

```sql
select * from gebeurtenis where vraagt_antwoord = 1 and beantwoord_op is null
```

`worker/motor.js` is het enige dat die `1` erin zet. Hij leest de kaartdefinities van §3.2b en stempelt gebeurtenissen die eraan voldoen tot kaart: `vraagt_antwoord = 1`, een `sleutel`, en `processtap` → de definitie waar de kaart vandaan komt.

**Wat de motor met opzet níét opslaat:**

- **Geen prioriteit.** Die wordt afgeleid bij het lezen, uit de definitie en de leeftijd van de kaart. Een opgeslagen prioriteit veroudert niet mee en staat binnen een dag te liegen.
- **Geen kaarttekst.** De titel staat al op de gebeurtenis; wat de kaart toont bouwt het scherm uit de definitie. Twee keer dezelfde tekst opslaan betekent dat je hem twee keer moet bijwerken en dat de ene het wint.
- **Geen volgorde.** Dat is een sorteerregel, geen gegeven.

**Twee keer draaien mag geen schade doen.** Dat is geen nette eigenschap maar een harde eis — een cron die een keer dubbel vuurt hoort geen tweede kaart op te leveren. Drie sloten:

1. Het stempel zelf: de weger kijkt alleen naar `processtap is null and vraagt_antwoord = 0`.
2. De sleutel: bestaat er al een kaart met deze sleutel, dan wordt de gebeurtenis wél gestempeld (hij is echt gebeurd en blijft in de stroom staan) maar geen tweede kaart.
3. De unieke index op `gebeurtenis.sleutel`, voor twee ronden tegelijk.

**Overlappende voorwaarden: de eerste definitie wint.** De weger loopt op `volgorde`, en een gestempelde gebeurtenis wordt niet door een tweede definitie opgepakt. Die volgorde staat in beheer.

**De voorwaarde zit achter een slot.** `voorwaarde` is SQL uit de definitielaag. Dat is geen invoer van buiten, maar het gaat wel ongelezen een query in. `voorwaardeDeugt()` weigert `;`, commentaar, `union`, en alles wat schrijft of `pragma` zegt, eist gebalanceerde haakjes en maximaal 500 tekens. **Een definitie die niet deugt kost alleen zijn eigen kaart, nooit de rij** — hij komt in `verslag.overgeslagen` en de ronde loopt door. Dat geldt ook voor een voorwaarde die wél door het slot komt maar waar de database over struikelt.

**De sleutelvormen staan in code, de keuze in de definitie.** Acht vormen (per positie, per cyclus en stand/week/moment/voorwaarde, per moment en deelnemer, per publicatie en lezer, per maand). Dit is het enige stuk dat echt goed moet zitten: te ruim en een kaart die had moeten openstaan verdwijnt, te krap en dezelfde vraag staat drie keer in de rij.

**De klok schrijft de stilte.** 'Er is een week voorbij' is geen melding van IBKR en geen handeling van ons — er gebeurde juist niets. `tik()` schrijft die slagen als gebeurtenis (`week_verstreken`, `maand_verstreken`) zodat de weger er daarna hetzelfde mee kan doen als met al het andere. Het zijn met opzet alleen **kalenderslagen, geen toestandscontroles**: een kaart die moet kijken of iets nog openstaat (go/no-go, reviewbesluit, technische analyse) wacht tot het scherm bestaat waar je hem beantwoordt. Die vier definities staan al in 0102 maar vuren nog niet.

**De cron: elk uur, op het hele uur** (`triggers.crons` in `wrangler.jsonc`, zowel productie als staging). De `scheduled`-handler draait `tik()` en dan `weeg()`, in die volgorde, zodat wat de klok vandaag schrijft dezelfde ronde nog een kaart wordt. Een ronde die omvalt neemt de volgende niet mee.

**Dit is het enige dat zonder mens draait, en het doet één ding: stempelen.** Er gaat niets naar de broker, er wordt niets verstuurd en er wordt niets gewist. Een kaart is een vraag aan ons; het antwoord blijft mensenwerk.

`scripts/proef/motor.mjs` stelt niet de vraag "werkt het een keer" maar "overleeft het een cron die dubbel vuurt": twee ronden, een dubbele melding van IBKR, een beantwoorde kaart die niet terugkomt, twee tikken op dezelfde dag, en een kapotte definitie tussen de goede.

### 3.2c-bis ~~De aanleiding — kaarten uit iets dat er níét gebeurde~~ (migratie 0112, vervallen)

> **Vervallen op 5 oktober 2026.** Zie §13b.

De motor van §3.2c dekt alles wat IBKR meldt en alles wat wij doen: er gebeurt iets, dat wordt een gebeurtenis, de weger stempelt die tot kaart.

**Vier kaarten vallen daarbuiten**, want ze gaan over iets dat er juist niet gebeurde: een go/no-go waarin jouw stem ontbreekt, een besluit dat niet is vastgelegd, charts die niet gelezen zijn, een voorwaarde die op rood staat. Daar is geen gebeurtenis van — er is alleen een toestand die blijft hangen.

In etappe C stonden deze vier wel als definitie klaar maar vuurden ze niet, met als reden dat hun schermen nog niet bestonden. Die bestaan nu.

**De zoekopdracht staat in beheer, niet in de code.** `processtap.aanleiding` is een SELECT die rijen oplevert waar een kaart bij hoort. Was dit code geweest, dan was dit de ene plek waar kaartlogica alsnog naar binnen kruipt.

**Hij mag alleen lezen.** `aanleidingDeugt()` eist dat de tekst met `select` begint en weigert `;`, commentaar, `union` en elk schrijfwoord. Dat is geen formaliteit: dit is het enige stuk ingerichte tekst dat zelf bepaalt welke rijen de motor te zien krijgt, en als het ooit meer dan lezen kan, kan een vergissing in beheer gegevens kwijtmaken. De inrichtingsaudit controleert elke ingerichte aanleiding opnieuw tegen datzelfde slot.

**Wat een aanleiding mag teruggeven** staat vast (`AANLEIDINGSKOLOMMEN`): `cyclus`, `positie`, `publicatie`, `beoordelingsmoment`, `titel`, `detail`, `sleuteldeel`, `feiten_json`. Wat er niet in staat wordt genegeerd in plaats van blind in een insert geduwd.

**`sleuteldeel` is wat deze toestand uniek maakt**, en de aanleiding wijst het zelf aan: een deelnemer bij een go/no-go, een moment bij een besluit, een voorwaarde bij een herbeoordeling. De motor hoeft het niet te raden. Zonder deze grendel zou één go/no-go die een week openstaat honderdzestig kaarten opleveren — de cron draait elk uur.

**De melder stempelt zelf.** Hij schrijft de gebeurtenis én zet er meteen `vraagt_antwoord`, `sleutel` en `processtap` op, omdat de sleutel uit de aanleiding komt en niet uit de feiten. De weger komt er daarna niet meer aan (hij zoekt op `processtap is null`), dus er blijft één pad en geen tweede soort kaart.

**Een toestand die oplost haalt zijn kaart niet weg.** Dat hoort ook zo: een kaart verdwijnt niet, hij wordt beantwoord. Maar er komt ook geen nieuwe bij — wie heeft ingezonden krijgt geen tweede kaart, en een beantwoorde kaart komt niet terug. `scripts/proef/toestand.mjs` test precies die drie overgangen.

De backtest draait deze nu mee: elke dag kan het beoordelingsmoment van stand wisselen en kan een voorwaarde op rood springen, en invariant 13 eist dat geen enkele toestand ooit twee kaarten oplevert.

### 3.2d ~~De wachtrij — de kaart wordt afgeleid, niet opgeslagen~~ (vervallen; worker/wachtrij.js is verwijderd)

> **Vervallen op 5 oktober 2026.** Wat blijft is het principe: een kaart wordt bij het lezen afgeleid en niet als taak weggeschreven. Zie §13b.

**Etappe D.** `wachtrij(env, ik, {cyclus})` beantwoordt één vraag — `vraagt_antwoord = 1 and beantwoord_op is null` — en leidt de rest af uit de kaartdefinitie en de gebeurtenis, **bij elke aanroep opnieuw**. Er wordt niets van de kaart opgeslagen, want het verandert mee: een kaart van vanmorgen is vanavond dringender geworden zonder dat er iets aan hem gebeurd is.

**De prioriteit schuift met de klok.** De definitie zegt waar hij begint; staat de kaart langer open dan `opschalen_na_uur`, dan schuift hij naar `opschalen_naar`. Opschalen gaat **alleen omhoog**, ook als iemand het andersom inricht — de afleiding neemt het dringendste van de twee. Rood, amber, grijs; nooit groen.

**Wat niet ingevuld kan worden valt weg.** Een titel uit een sjabloon (`Positie gesloten: {{positie.naam}}`) met een gat erin leest nog; een titel met accolades op het scherm leest als een storing. Idem voor de feiten: een leeg feit komt er niet in, want een feitenvak met 'onbekend' erin is erger dan een feitenvak met drie regels. Is de sjabloontitel helemaal niet invulbaar, dan valt de kaart terug op de titel van de gebeurtenis zelf — er staat altijd iets leesbaars boven een kaart.

**Sorteren: dringend bovenaan, en daarbinnen het oudste eerst.** Een kaart die drie dagen wacht hoort niet onder een kaart van vanmorgen.

**Twintig kaarten zijn geen zestig vragen aan de database.** Positie, cyclus, publicatie en moment worden per tabel in één slag opgehaald. Een kolom die nog niet bestaat legt de wachtrij niet om; die kaart toont dan minder feiten.

#### Een kaart verlaat de rij op drie manieren, en verdwijnen is er geen van

| Doel | Wat er gebeurt |
|---|---|
| een knop (`publicatie`, `scherm`, `splitsen`, `terug`) | beantwoord, met wie en wanneer |
| de prullenbak op `afsluiten` | ook een antwoord: "gezien, en we doen niets" |
| de prullenbak op `uitstellen` | **niet** beantwoord — `wachten_tot` wordt gezet en de kaart komt terug |

`POST /api/wachtrij/:id/antwoord` weigert een knop die niet op déze kaart staat, een doel dat de definitie niet kent, een tweede antwoord op dezelfde kaart, en knop 2 zonder reden als de definitie er een vraagt. **Er is geen route die een kaart wist.**

**`wachten_tot` is een eigen veld (migratie 0103)**, omdat alle andere manieren om uitstellen erin te wringen stuk zijn: de kaart beantwoorden met 'later' betekent dat hij nooit meer terugkomt (zijn sleutel ligt vast, de motor maakt er geen tweede); het moment van de gebeurtenis vooruit zetten laat de tijdlijn liegen over wanneer het gebeurde, en dat is precies waar de stroom voor is; wissen en opnieuw maken doen we niet.

**De knop zet niets in gang.** `doel: publicatie` betekent dat het scherm de berichtenopsteller opent. Dat het bericht ook echt weggaat is een tweede handeling, met een tweede knop, door een mens.

### 3.2e De berichten — van kaart naar bericht (migraties 0104/0105, worker/bericht.js)

> **Blijft.** Alleen de route heet nu `/api/kaart/:id/concept`, en de sjabloonnaam komt van de aanroeper in plaats van uit de kaartdefinitie.

**Etappe E.** Een kaart met de knop *Bericht opstellen* wijst een sjabloon aan. `conceptUitKaart()` zet dat om in een concept: de feiten ingevuld, de tekst klaar, **de oordelen nog open**. Elk sjabloon heeft een regel als `Wat dit betekent: [in één alinea]` — het sjabloon zet de feiten klaar, niet het oordeel.

**`publicatie.positie` is nullable geworden (0104).** Dat stond op `not null` toen een bericht altijd over één tranche ging. De wachtrij levert nu ook kaarten op die een bericht vragen zónder positie: een barometerstand, een week-update, een maandbericht. SQLite kan `not null` niet weghalen, dus de tabel is herbouwd — met `pragma defer_foreign_keys`, want `gebeurtenis.publicatie` hangt eronder. **Dit is de tweede keer dat dat ons kost; zie §12.**

Erbij gekomen: `gebeurtenis` (uit welke kaart dit bericht voortkwam, zodat achteraf zichtbaar is welke vraag tot welk bericht leidde), `titel`, `kanaal`, `nalezer`, `nagelezen_op`.

**De sjablonen staan in beheer (0105), niet in de code.** De woorden waarmee wij onze leden aanspreken horen op een scherm te staan waar ze te lezen en te wijzigen zijn zonder dat er iemand hoeft te deployen. Zes sjablonen, met dezelfde plaatshouders als de kaart (`{{positie.naam}}`, `{{feiten.naar}}`), en dezelfde regel: wat niet ingevuld kan worden valt weg. Een bericht met een gat erin kun je nalezen; een bericht met accolades erin gaat per ongeluk zo de deur uit.

#### Nalezen is een stap, geen vinkje

De opsteller vinkt niet zelf af dat er iemand meegekeken heeft. `vraagNalezen()` zet het bericht op `nalezen` en schrijft een gebeurtenis — en de motor maakt daar **een kaart van in de wachtrij van de lezer**. Er is geen aparte postbus: er is één rij, en dit staat erin.

| Stand | Wat het betekent |
|---|---|
| `concept` | de opsteller schrijft |
| `nalezen` | ligt bij de lezer; de opsteller kan het niet langs hem heen sturen |
| `klaar` | nagelezen en vrijgegeven — **nog niet weg** |
| `verstuurd` | de deur uit |

`klaar` bestaat apart van `verstuurd` omdat nalezen en versturen twee handelingen zijn: iets kan goedgekeurd zijn en toch nog niet weg. Terugsturen kan alleen mét een reden, en die reden komt in de stroom te staan.

**Vier sloten op de deur**, en de proef probeert ze allemaal te forceren: een leeg bericht gaat niet weg; de opsteller kan niet versturen terwijl het bij een lezer ligt; iemand anders dan de nalezer geeft niet vrij; twee keer versturen kan niet. Twee keer op *Bericht opstellen* drukken levert hetzelfde concept op — anders staan er twee halve berichten en gaat er een de deur uit die iemand anders nog zat te schrijven.

**De feiten worden vastgelegd zoals ze op dat moment waren.** Verandert de positie later, dan verandert een verstuurd bericht niet mee: wat eruit ging, ging eruit.

### 3.2f ~~De achterstand — de enige blijvende meter~~ (vervallen; worker/achterstand.js is verwijderd)

> **Vervallen op 5 oktober 2026.** De vraag blijft overeind — *hoe lang weten wij iets dat de leden niet weten* — en keert terug in de nieuwe werkbank. De meter die hier beschreven staat hing aan de kaartdefinitie en is mee verdwenen. Zie §13b.

**Etappe F.** De werkbank heeft één permanente indicator, en die meet niet ons maar de leden: **hoe lang weten wij iets dat zij niet weten.**

Niet "hoeveel kaarten staan er open" — dat is een maat voor onze drukte, en daar wordt niemand buiten dit kantoor beter van. De achterstand is de enige maat waarin de leden voorkomen.

**De rekensom is kort.** Een kaart waarvan het antwoord een bericht aan de leden is, en waar dat bericht nog niet verstuurd is, is achterstand. De leeftijd van de oudste daarvan is het getal.

**Welke kaarten meetellen staat in de definitie, niet in een lijst hier**: een kaart waarvan `knop1_doel = 'publicatie'` vraagt om een bericht. Richten we morgen een nieuwe kaartsoort in die om een bericht vraagt, dan telt die vanzelf mee. Een technische analyse die weken openstaat telt niet mee, hoe vervelend dat ook is — dat is werk van ons, niet van hen.

**Hij wordt afgeleid, nooit bijgehouden.** Er is geen teller die opgehoogd wordt en die na één fout de rest van het jaar scheef staat.

**Grijs, amber, rood — groen bestaat hier niet.** Een achterstand van nul is niet 'goed' maar gewoon niets: dan staat de meter grijs en zwijgt hij. De grenzen (24 uur amber, 72 uur rood) staan als `instelling` in beheer (migratie 0106), want het is een keuze van ons en we gaan hem bijstellen zodra we hem een paar cycli gezien hebben. Onzin in een instelling valt terug op de standaard in plaats van de meter om te leggen.

**Drie manieren waarop de achterstand zakt**, en alle drie zijn een handeling van een mens:

| Wat er gebeurt | Zakt de meter? |
|---|---|
| een concept opstellen | **nee** — er is nog niets bij de leden |
| het bericht versturen | ja |
| bewust 'niet melden' antwoorden | ja — ook een besluit is bijgewerkt zijn |

**Versturen sluit ook de kaart die erom vroeg.** Dat ontbrak en is bij deze etappe gevonden: zonder dat bleef de kaart staan voor iets dat de leden allang wisten, en bleef de meter hangen. `verstuurPublicatie()` beantwoordt nu de gebeurtenis waar het bericht uit voortkwam.

**Migratie 0106 voegt één tabel toe: `instelling`.** Geen scherm vol knoppen — alleen waarden die we echt gaan draaien, elk met de uitleg erbij waarom hij bestaat. Wie de uitleg niet kan schrijven, heeft de instelling niet nodig.

### 3.2g De barometer — wat wij van een lid vragen (migratie 0107)

**Etappe G, en daarmee is de wachtrij af.**

**De barometer beantwoordt één vraag: hoeveel aandacht vraagt deze cyclus van een lid.** Niet hoe de markt staat. De meeste maanden expireert de optie waardeloos en hoeft er niets te gebeuren, hoe bewogen de markt ook was — een meter die de markt beschrijft zou dan onrust melden waar geen onrust is.

De schaal, 1 is rustig: **Niets · Meekijken · Volgen · Dichtbij blijven · Paraat.** De labels staan in `db_choice`, niet in de code: ze gaan naar 412 leden, dus ze gaan nog veranderen, en dat hoort geen deploy te zijn.

**Het venster staat ernaast en apart:** open / wacht / dicht. Eén meter voor allebei zou moeten liegen zodra ze uit elkaar lopen — rustige markt maar het kapitaal zit vast, dan is de stand 1 en het venster dicht, en allebei waar. De proef legt expliciet *rustig én dicht* en *dichtbij blijven én open* vast, want zodra die twee combinaties niet meer kunnen zitten stand en venster alsnog aan elkaar en hadden we net zo goed één meter kunnen houden.

**Op stand 1 mag groen.** Dat is geen uitzondering op de regel dat groen "in orde" betekent — het ís in orde. Die regel geldt voor kaarten die openstaan, niet voor een toestand.

**Een stand is een rij, geen veld op de cyclus.** Twee redenen: de geschiedenis is het interessante deel (*"van 5 naar 4 op 12 september, omdat de volatiliteit zakte"* is wat je een lid vertelt, niet "4"), en wat wij weten en wat de leden weten lopen uiteen. Elke stand draagt verplicht een **reden** — zonder is het een getal zonder verhaal, en precies dat verhaal gaat naar de leden.

**Het systeem stelt voor, een mens stelt vast.** `stelVoor()` schrijft alleen een gebeurtenis; de motor maakt daar een kaart van; pas het antwoord op die kaart zet de stand. Een getal dat zegt hoeveel aandacht iemand moet geven hoort niet vanzelf te verschijnen zonder dat iemand ernaar gekeken heeft. `herkomst` houdt bij of een stand uit een voorstel kwam of met de hand gezet is.

**Wat wij weten en wat de leden weten zijn twee velden.** `huidig()` geeft ze allebei terug plus `gelijk`. Een stand is pas bij de leden als het bericht erover verstuurd is — er is geen knop "markeer als gemeld", alleen `verstuurPublicatie()` van een barometerbericht zet `gepubliceerd_op`. Zolang ze verschillen loopt de achterstand van §3.2f, en dat hoort niet weggerekend te worden tot één getal.

**Een ingehaalde stand komt nooit alsnog bij de leden.** Bij deze etappe gevonden: `meldGepubliceerd()` pakte eerst de laatste nog niet gemelde stand in plaats van de huidige. Bij drie standen achter elkaar zonder bericht publiceerde het versturen dan een stand die intussen al ingehaald was.

### 3.2c-ter ~~Een toestandskaart sluit zichzelf~~ (vervallen; worker/motor.js is verwijderd)

> **Vervallen op 5 oktober 2026.** Zie §13b.

Eerst gold: *een kaart verdwijnt niet, hij wordt beantwoord.* Dat klopt voor een kaart die iets vraagt — *zullen we dit de leden vertellen?* — want daar is het antwoord het punt, ook als het antwoord 'nee' is.

Het klopt **niet** voor een toestandskaart. *"De charts zijn nog niet gelezen"* is geen vraag maar een constatering. Lees je ze, dan is de constatering niet meer waar en hoort de kaart weg — niet omdat iemand hem wegklikte, maar omdat het werk gedaan is. Hem laten staan betekent dat de werkbank iets beweert dat niet klopt, en dat is precies wat een werkbank niet mag doen.

**De aanleiding is de waarheid, in twee richtingen.** `meld()` berekent per definitie de verzameling sleutels die nú geldig is. Elke openstaande kaart van die definitie die er niet meer in zit, wordt gesloten met antwoord `vanzelf opgelost`. Komt de toestand terug — een inzending die wordt ingetrokken, een voorwaarde die weer op rood springt — dan verschijnt de kaart gewoon opnieuw: de sleutel is vrij omdat hij beantwoord is (§0113).

Dit geldt **alleen voor kaarten met een `aanleiding`**. Een kaart die uit een gebeurtenis komt heeft geen toestand om tegen te toetsen en blijft staan tot een mens antwoordt.

`scripts/proef/flow.mjs` loopt hierop één cyclus van begin tot eind door en controleert na elke handeling of de wachtrij precies toont wat er op dat moment gevraagd wordt — niet meer en niet minder. Drie deelnemers die één voor één inzenden halen één voor één hun eigen kaart weg; een voorwaarde die rood → groen → rood gaat levert twee keer een kaart op; een berichtkaart blijft staan tot het bericht verstuurd is, ook nadat het concept al klaarstond.

### 3.3 Relaties met betekenis

- `event` staat **buiten** de cycli. Een cyclus bezit geen events; hij heeft een periode. De koppeling met een beoordeling loopt via `cyclus_event`.
- **De zwaarte wordt twee keer beoordeeld, en dat is geen doublure.** Op het `event` staat de algemene zwaarte: hoe zwaar een ECB-vergadering doorgaans weegt. Op `cyclus_event` staat de zwaarte *in deze cyclus*: dezelfde vergadering is zwaar vlak voor de expiratie en licht als ze aan het begin van de looptijd valt. De algemene zwaarte is de beginwaarde van de cyclusspecifieke; wijkt iemand ervan af, dan hoort daar een reden bij (een waarschuwing, geen blokkade). Een zwaarte op het event aanpassen mag nooit het oordeel in een lopende cyclus veranderen — dat was de reden om dit te splitsen.
- **De koppeling vult zichzelf, het oordeel niet.** Bij het aanmaken van een cyclus, bij het verschuiven van haar doelexpiratie, en bij elk event dat erbij komt (met de hand of uit een document), zet het systeem de ontbrekende `cyclus_event`-regels klaar voor alles wat binnen de looptijd valt. Behandeling blijft `nog te wegen` tot een mens hem zet. Wat door een datumwijziging buiten de periode valt, blijft staan: daar is over nagedacht.
- **Voornemen en uitvoering zijn twee tabellen.** Een `inzending` is wat iemand vóór het gesprek voorstelt; een `positie` is wat er daarna werkelijk in de markt staat. De positie verwijst naar het `beoordelingsmoment` waar ze uit voortkomt, niet naar een inzending — de uitkomst is van de groep, niet van één persoon. Eén tabel voor beide zou betekenen dat de blindering van inzendingen langs de achterdeur van een positielijst kan lekken.
- **Afschermen is een regel op de rijen, niet op een scherm.** Mist een lijst de kolom waaraan te zien is bij welk moment een inzending hoort, dan haalt de regel die context zelf op. Anders zou een smalle kolomkeuze alles dichthouden, ook ná het onthullen — en dat zou lijken op een beveiliging terwijl het een vergissing is.
- **De blindering zit op `inzending`.** Zolang het quorum van het beoordelingsmoment niet gehaald is, geeft de API van andermans inzending alleen deelnemer, status en tijdstip terug — positie, strike, expiratie, inzet en reden niet, via welk endpoint dan ook.
- `handelsdag` is de enige bron voor "handelsdagen" en "binnen handelsuren". Geen enkele regel rekent die zelf uit.
- `portefeuille_instelling` en de open tranches samen bepalen blootstelling en buffer. De cyclus draagt alleen zijn eigen aandeel. Zie 6.1.
- `meting` staat los van `voorwaarde`: één bron voedt meerdere voorwaarden en de meetgeschiedenis blijft bestaan als een voorwaarde verandert.
- `audit` vult zichzelf bij elke schrijfactie op een inhoudelijke tabel.

### 3.4 Versiebeheer van de rekenlaag

Een gewicht, drempel of rekenregel veranderen mag altijd — maar nooit door de oude waarde te overschrijven, want dan is een score van drie maanden geleden berekend met een regel die niet meer bestaat.

- Een wijziging in de rekenlaag **sluit** de bestaande rij (`versie_tot` = de lopende versie) en **opent** een nieuwe rij onder een nieuwe `configuratieversie`. Kopiëren-bij-schrijven: de nieuwe versie wordt automatisch aangemaakt bij de eerste wijziging ná een versie die al door een cyclus gebruikt is. Niemand beheert versienummers met de hand.
- Een `cyclus` **pint** bij openen de dan geldende configuratieversie. Die staat op het cyclusrecord en is alleen met reden te wijzigen — dat is een beoordelingsmoment, geen veldwijziging.
- Een lopende cyclus verandert dus niet van regels doordat iemand de standaardset aanpast. Dat sluit aan bij "wijzigingen aan de set gelden vanaf de volgende cyclus" (4.3), maar nu afgedwongen in plaats van afgesproken.
- Een score wordt nooit getoond zonder de versie erbij. Scores van cycli met verschillende configuratieversies worden in overzichten **niet** als één reeks getekend.
- *Fase 2.* De voorwaardentabel gaat als **rijen** in `moment_voorwaarde`, niet als tekstblok. Daarmee is achteraf te bevragen hoe een voorwaarde over tien cycli stond, ook als de voorwaarde intussen is gewijzigd.

---

## 4. Regels en bouwstenen

### 4.1 De vijf bouwstenen

Een voorwaarde wordt samengesteld uit een vaste bouwsteen. Er is geen vrije expressietaal.

1. Gewogen som van meerdere signalen
2. Statuswaarde per uitkomst (groen/oranje/rood, met waarde per stand)
3. Plafond met voorwaarde
4. Vergelijking tegen een drempel (groter dan, kleiner dan, binnen bandbreedte)
5. N-uit-M-regel voor een groep

Bouwstenen bijmaken is ontwikkelwerk. Wat je ermee samenstelt is configuratie.

### 4.2 Fase en signaal

Elke voorwaarde draagt een **fase** (pre-analyse of in positie) en een **signaal**: telt mee in de score, exitplan, vervroegd sluiten, rol overwegen, of herbeoordelen. Daarmee is een rolregel of exitregel gewoon een voorwaarde; er komt geen aparte lijst voor.

Voorwaarden in fase 2 rekenen **per tranche**, niet per cyclus.

### 4.3 De standaardset

Regels die staand beleid zijn — Premie-60, winstanker, eventregels — staan in de configuratie als standaardset en worden bij het openen van een nieuwe cyclus **automatisch ingeladen**. Een cyclus start dus niet leeg. Per cyclus is elke ingeladen regel aan te passen of uit te zetten zonder dat de set verandert. Het record houdt bij of een voorwaarde uit de set kwam. Wijzigingen aan de set gelden vanaf de volgende cyclus.

### 4.3a Fase 1 — de instapvoorwaarden gaan met de hand, en niets gaat op slot

**De hele voorwaardenblok wordt in fase 1 niet gebouwd.** Geen rekenmotor, geen gewichten, geen score, geen harde gates, geen drempels die automatisch een status bepalen, geen feeds — en **geen vastklikken**.

Wat wél bestaat is een eenvoudige gerelateerde lijst op de cyclus waarin je per voorwaarde typt wat je ziet:

| Kolom | Wat |
| --- | --- |
| Voorwaarde | De naam, overgenomen uit de standaardset |
| Status | Groen, oranje, rood of *nog niet bepaald*, met de hand gezet |

**De status staat rechts naast de voorwaarde (0137).** Hij stond onder het kopje *Meting*, terwijl er niets meer gemeten wordt: je las eerst de voorwaarde, dan een kopje dat nergens meer over ging, en dáár stond het enige dat je moest zetten. Wat onder dat tweede kopje overblijft — waar je gekeken hebt en wat je ervan vond — heet nu *Notitie*.

**Er wordt niets gemeten (0135, 5 okt 2026).** De kolom *gemeten waarde*, met wie hem mat en wanneer, is uit de definitielaag. In de praktijk kijk je, je oordeelt, en je zet de status; het getal eromheen was een tweede administratie die niemand bijhield — waardoor de processtap bleef openstaan terwijl het werk gedaan was. De kolommen blijven in de tabel staan, zodat wat er ooit in gezet is leesbaar blijft, maar er komt niets meer bij. Wie de status zette en wanneer wordt nog wel genoteerd: het besluit steunt op dat oordeel.

**De stap heet *Instapvoorwaarden bepalen* en gaat af zodra er één voorwaarde staat.** Hij telde eerst of élke voorwaarde een oordeel droeg. Dat duwt een mens naar een status kiezen om van de stap af te zijn, en dat is precies niet waar het oordeel voor is. Het aantal staat erbij; wát er staat lees je in de lijst.

**En één naam die niet klopte:** *Tranche in de markt* → **Eerste Tranche geplaatst**. De stap gaat over wat je gedaan hebt, niet over waar iets staat.

**Een stap straft niet dat je méér opschrijft (0135, 0139).** *Instapvoorwaarden bepalen* gaat af bij de eerste voorwaarde, *Technische analyse* bij de eerste chart met een schermafdruk én een lezing. Ze telden eerst élke regel: voegde je er een toe, dan sprong de stap terug naar open terwijl het werk juist vooruit ging.

**Opslaan brengt je terug waar je vandaan kwam (0138).** Drie vlaggen op `db_table`, want dit is gedrag per tabel en geen uitzondering in een scherm: `na_opslaan = 'ouder'` brengt je na opslaan terug naar het record waar het onder hangt, met het juiste tabblad open; `opslaan_en_nieuw = 1` zet naast *Opslaan* een knop die opslaat en meteen een lege opent onder dezelfde ouder; `bijlageknop = 0` laat de bijlageknop weg. De chartlezing draagt alle drie: je vult er een paar achter elkaar in, en zijn afbeelding staat in het record zelf — een losse bijlage ernaast zou een tweede plek zijn waar hetzelfde kan staan.

**De begeleidende tekstjes zijn weg (5 okt 2026).** Overal, niet alleen op de werkbank: het zinnetje naast *Aanwezig bij dit besluit*, de telling boven de events, 'alleen lezen — bijwerken gebeurt op de cyclus', de uitleg naast *Versturen* en *Uitkomst vastleggen*, 'lezend — het systeem plaatst nooit zelf een order'. Ze legden uit wat het scherm zelf al laat zien, en samen maakten ze elk scherm druk. Wat er echt toe doet staat in de uitleg van de stap of in deze spec.

**Een vast persoonsveld is één vlak.** Een uitgeschakelde keuzelijst krijgt van de browser een eigen grijze vulling; binnen het vak dat zelf al grijs is gaf dat een grijs blok met witte randjes ernaast — zichtbaar bij *Deelnemer* en *Aangemaakt door* op elk formulier. Het omhulsel draagt nu de grijze achtergrond, de lijst erbinnen is doorzichtig, en de hoogte is gelijk aan die van de andere velden.

**De stappenbalk toont alleen de naam van de stap (0136, 5 okt 2026).** De stand eronder — '1 van 1 gelezen', '0 van 5 gemeten' — herhaalde wat de lijst eronder al laat zien, op een balk die je elke keer langsloopt. Hij staat nog in de tooltip. En *Technische analyse gelezen* heet nu *Technische analyse*: de balk leest als een lijst onderwerpen, dus hoort er een onderwerp te staan; het werkwoord zei wat de afvinkregel telt.

**Niets wordt bevroren.** Een eerder ontwerp zette de set op slot bij de start van het gesprek, zodat iedereen tegen dezelfde cijfers oordeelde. Dat is bewust losgelaten: de beoordeling wordt op maat gemaakt op het moment van de markt, en dat de drie co-founders op een iets ander moment naar een iets andere markt kijken is geen ruis maar **precies de waarde van drie perspectieven**. Een bevroren tabel zou die verschillen juist wegpoetsen.

**Wat de beoordeling dan verankert, is de inzending.** Omdat er geen gedeelde momentopname meer is, draagt elke inzending zelf wat die persoon zag: de positie (go of no-go), bij go de strike en de expiratie, bij no-go de reden, plus de motivering en de intuïtieve waarneming. Achteraf is daarmee nog steeds te reconstrueren waaróm iemand oordeelde zoals hij oordeelde — niet via een tabel die voor iedereen hetzelfde was, maar via wat ieder zelf opschreef. Aanbevolen extra veld op de inzending: **wat ik zag** — één regel met de stand van de markt op het moment van versturen.

- De voorwaardenlijst op de cyclus is daarmee een **werklijst**, geen bewijsstuk: hij helpt bij het kijken, hij legt niets vast.
- Elke wijziging staat in de **audit trail**, met oude en nieuwe waarde, wie en wanneer. Dat is het spoor; vastklikken is er niet voor nodig.
- `moment_voorwaarde` (de momentopname bij een beoordelingsmoment) wordt in fase 1 **niet gevuld**. De tabel blijft in het model staan voor fase 2.

**Wat vervalt tot fase 2:** de drempel-en-operator-logica, het gewicht, de harde gates, de gewogen score, de Tier-1-telling, de houdbaarheid, `db_calc`, de bouwsteeneditor en het vastklikmoment. Overal waar dit document die noemt — in het bijzonder 4.1 tot 4.4, de statusregel in 5.2 en de etappes 7 en 8 — beschrijft het **fase 2**, niet de MVP.

Omdat de voorwaarde en haar gemeten waarde er in fase 1 al zijn, is fase 2 het aanzetten van de rekenlaag erboven. Of het vastklikmoment dan alsnog terugkomt, is een aparte vraag die in fase 2 beantwoord wordt, niet nu.

### 4.3b Voorwaarden met brontype *beoordeling* — technische analyse van de charts

Niet elke instapvoorwaarde komt uit een feed. Een voorwaarde kan als brontype **beoordeling** hebben: een mens vult haar in. Geen nieuwe rekenmotor — de score gebruikt bouwsteen 2, statuswaarde per uitkomst.

**Geen eigen scherm.** De technische analyse is een gerelateerde lijst van de cyclus, net als posities, instapvoorwaarden, uitstapvoorwaarden en events. Je opent één cyclus, ziet het formulier, en daaronder de related lists als tabbladen (zie 10).

**Eén regel per chart.** De analist uploadt een printscreen van zijn chart en vult op die regel de parameters in. De parameters zijn **geen vaste kolommen**: `analyseveld` is het sjabloon, `chartanalyse_waarde` houdt de ingevulde waarde, en de lijst rendert zijn kolommen uit het sjabloon — dezelfde metadata-lijn als de rest van de applicatie. Beginset:

| Analyseveld | Type | Voorbeeld |
| --- | --- | --- |
| Tijdsframe | keuze | dagchart / weekchart / 4-uur |
| Trend | tekst | hogere bodems |
| Steun | getal | 6.240 |
| Weerstand | getal | 6.420 |
| RSI(14) | getal | 41 |
| Volume t.o.v. 20d | getal | 0,8× |

Het **oordeel per chart** (groen / oranje / rood) is een vast veld op `chartanalyse`, geen analyseveld — het is de enige parameter waar de rekenlaag op steunt.

- Upload via slepen, plakken (⌘V) of bestandskeuze. De afbeelding hangt aan de cyclus en gaat mee in het beoordelingsmoment.
- Velden toevoegen, hernoemen, verwijderen of herordenen gebeurt in de standaardset, zonder code. Een wijziging opent een nieuwe configuratieversie en geldt vanaf de volgende cyclus (3.4).
- Onder de regels staat één **eindoordeel** met motivering (verplicht bij oranje en rood), dat de score voedt.
- **Toegewezen aan één rol** (rol *technische analyse*, nu Pieter). Vaststaat dát ze gebeurt en wie tekent.
- **Statuswaarden configureerbaar**, standaard groen 18 · oranje 9 · rood 0 van een totaal van 100.
- **Nooit een harde gate.** Enig menselijk oordeel in de set; met vetorecht kan één chartlezing een cyclus tegenhouden of doordrukken. Het veto blijft bij het gesprek (drie go's).
- **Vastklikken vóór het voorlopige oordeel.** Anders kan de invuller de score sturen nadat hij de stand van de andere voorwaarden ziet.
- **Houdbaarheid** instelbaar, standaard ≤ 48 uur oud op de instapdag. Ontbrekend of verlopen telt als *niet gemeten*, niet als groen.
- **Post-analyse:** het eindoordeel komt terug in `toetsing` (hielp / neutraal / misleidend) naast het werkelijke verloop.

Dit is iets anders dan kopiëren van de vorige cyclus, wat **niet** gebeurt.

### 4.4 Niet gemeten is niet groen

Elke voorwaarde kan vier standen hebben: **groen**, **oranje**, **rood** en **niet gemeten**. De vierde is geen foutmelding maar een uitkomst met gevolgen.

- Een meting die door de betrouwbaarheidstoets zakt (7), ontbreekt, of ouder is dan de ingestelde houdbaarheid, levert *niet gemeten*.
- *Niet gemeten* telt in de gewogen som als nul en telt **niet** mee als "groen of oranje" in een N-uit-M-regel.
- Is een voorwaarde een harde gate en staat ze op *niet gemeten*, dan is de gate niet gehaald.
- Het scherm toont *niet gemeten* met de reden erbij (geen quote, spread te breed, buiten handelsuren, verlopen, niet ingevuld).

### 4.5 Drempels bij de start

Overgenomen uit de septemberanalyse. Dit zijn configuratiewaarden, geen code.

| Voorwaarde | Waarde |
| --- | --- |
| Daling ten opzichte van de vorige top | ≥ 2% t.o.v. de ATH van de vorige maand, binnen maximaal 3 handelsdagen |
| Volatiliteit | VSTOXX ≥ 16 en < 28 |
| Skew | IV van de OTM-put ≥ 20% boven de ATM-IV |
| Timing rond de trigger | geen instap op de triggerdag zelf |
| Resterende looptijd | ≥ 10 handelsdagen tot expiratie, per tranche |
| Na een zwaar event | ≥ 2 dagen herstel |
| Tier-1 | geen acute no-go, minimaal 4 van 6 lijnen groen of oranje |

Alles wat in dit blok "handelsdagen" heet, leest `handelsdag` (3.2). Ontbreekt de kalender voor een periode, dan staan die voorwaarden op *niet gemeten* — ze worden niet geschat.

Exitregels:

| Regel | Waarde |
| --- | --- |
| Stop loss (Premie-60) | harde verliesgrens als **absoluut laatprijsniveau**: zodra de **ask** van het contract het vastgelegde niveau bereikt, stappen we eruit. Het niveau is een prijs in indexpunten, geen percentage van de ontvangen premie — “Premie-60” betekent ask 60,0. Het niveau is **altijd ask 60,0** — het is een vaste grens van het model, geen keuze per tranche. Daaruit volgt ook dat er nooit een tranche wordt geschreven waarvan de ontvangen premie in de buurt van 60 ligt |
| Winstanker | sluiten bij beste laatprijs ≤ 30% van de ontvangen premie |
| Snelle winst | daling van 30% in de eerste één tot twee sessies |
| Eventblok | verplichte herbeoordeling vóór een zwaar eventblok |

**Beslist (2 okt 2026)** — na een rol rekenen de stoploss en het winstanker tegen de premie van **die ene tranche**. Of het doorrollen als geheel iets opleverde, wordt over de hele keten beoordeeld in de **post-analyse**. Een rol loopt niet via een besluit (6), dus de keten wordt achteraf getoetst en niet vooraf.

---

### 4.6 Voorwaarden bepalen en vastleggen — vijf stappen

Dit proces gaat aan alles vooraf en speelt zich af op het cyclusrecord.

1. **Standaardset ingeladen** — automatisch bij het openen van de cyclus, met de vastgepinde configuratieversie (3.4). Geen handeling, wel een zichtbare stap.
2. **Uitstapvoorwaarden bijstellen — het exitplan** — Premie-60, winstanker, snelle winst, stoploss, welke events een sluiting afdwingen. **Dit komt vóór de instapvoorwaarden.** Je bepaalt eerst waar je weer uit gaat, en pas daarna of je erin wilt. Andersom is de verleiding te groot om het exitplan zo te snijden dat het bij de gewenste instap past — en dan is het geen grens meer maar een verantwoording achteraf. De volgorde staat daarom in het proces, niet in de gewoonte: het menu, de tabbladen op de cyclus en de stappenbalk zetten uitstap overal vóór instap.
3. **Instapvoorwaarden bijstellen** — aan- of uitzetten, drempel, gewicht, gate; een nieuwe voorwaarde wordt aangemaakt vanuit het tabblad.
4. **Sluitend maken** — gewichten tellen op tot 100, elke harde gate heeft een werkende bron, elke voorwaarde met brontype *beoordeling* is toegewezen. Blokkeert stap 5.
5. **De set vastklikken** — *fase 2*. Bevriest met tijdstip; daarna wijzigen kan alleen met reden, zichtbaar in de audit trail. In fase 1 bestaat deze stap niet: de lijst blijft open en de audit trail draagt het spoor (4.3a).

**Eén vastklikmoment — fase 2.** Als het vastklikken in fase 2 terugkomt, gaan de instapvoorwaarden en de technische analyse sámen op slot, met één tijdstip. Twee aparte acties zouden betekenen dat je de cijfers kunt bevriezen en de chartlezing open laten.

**Twee vergrendelmomenten, bewust verschillend.** De instapset gaat op slot bij de start van het gesprek. Het exitplan kan dat nog niet: het stoplossniveau en het winstanker worden pas concreet als strike en ontvangen premie bekend zijn. In stap 2 leg je het *beleid* vast (percentages, welke events), bij het innemen worden daar *niveaus* van per strike — dat is stap 2 van "Positie innemen" (6).

---

## 5. Het go/no-go-protocol

Volgt het protocol van Jacqueline. Waar dit eerder anders in het plan stond, wint het protocol.

### 5.1 Voorbereiding met datums op de cyclus

| Moment | Wat |
| --- | --- |
| Twee weken vooraf | Ieder leest zich zelfstandig in en vormt een eigen marktbeeld |
| Uiterlijk één week vooraf | Eventskalender gereed; bespreking van inzichten, gebeurtenissen en staartrisico's |
| Daarna | Volgend analysemoment prikken |
| Op het analysemoment | Actuele markt toetsen, opnieuw go of no-go |

**Er is geen instapdatum vooraf.** Wat je plant is een **analysemoment**: een afspraak om samen te kijken en te beslissen. Of daar een instap uit komt, weet je pas op dat moment. De instapdatum is daarmee een *uitkomst* — de dag waarop de eerste tranche werkelijk is uitgevoerd — en geen planning. Het veld *eerste instap* op de cyclus is dus een vastgelegd feit, niet een voornemen.

**Afleiding van het analysemoment.** Zonder open posities: plannen na de macroanalyse. Met een open positie: de expiratiedatum van die positie is het logische moment, tenzij de analyse iets anders uitwijst — dan is de reden voor de afwijking een verplicht veld. Het formulier vult die datum voor.

**Elke no-go eindigt met een nieuw analysemoment.** Een cyclus die drie keer no-go geeft loopt niet achter; wachten is een toestand (2), geen vertraging.

### 5.2 Vaste agenda, vijf blokken

Het scherm toont vijf secties die worden afgevinkt en waarin per blok een aantekening kan; die aantekeningen komen in het beoordelingsmoment.

**Instapvoorwaarden op het meetingscherm.** Boven de agenda toont het scherm de voor deze cyclus geconfigureerde instapvoorwaarden als alleen-lezen tabel: per voorwaarde de bron, de ingestelde drempel, de laatst gemeten waarde, het gewicht, of het een harde gate is, en de status (groen / oranje / rood). Daarboven één statusregel: aantal voorwaarden groen of oranje, aantal harde gates gehaald, de gewogen score en het meettijdstip. *Deze statusregel hoort bij fase 2; zie 4.3a voor wat er in fase 1 staat.*

- **Fase 2.** Deze statusregel met score, Tier-1-telling en gates hoort bij fase 2. In fase 1 staat er een werklijst met gemeten waarde en een met de hand gezette status (4.3a), zonder score en zonder vastklikmoment.
- Niet bewerkbaar op dit scherm; wijzigen gebeurt op de cyclus en staat in de audit trail.
- Geen automatisch verdict: een rode harde gate verschijnt als waarschuwing bovenaan maar blokkeert geen knop. Het oordeel blijft menselijk.
- **Fase 2.** De momentopname bij het beoordelingsmoment (`moment_voorwaarde`) hoort bij fase 2. In fase 1 verankert de inzending zelf wat die persoon zag (4.3a).

**Eventstijdslijn op het meetingscherm.** Naast de voorwaarden toont het scherm de events van de cyclus op één horizontale as: van de laatste zware gebeurtenis vóór de instap tot de doelexpiratie, met de instapdag als markering. Per event een punt met zwaarte in kleur (zwaar / middel / licht / verstreken) en de vastgelegde behandeling eronder, plus een teller "behandeling vastgelegd voor N van M".

- Bron is `cyclus_event`; alleen-lezen op dit scherm, beheer gebeurt op de cyclus.
- Agendablok 2 is pas afvinkbaar als elk event een behandeling heeft; de teller maakt dat zichtbaar.
- De verstreken zware gebeurtenis links op de as blijft zichtbaar: de voorwaarde "herstel na zwaar event" meet daartegen.
- Gaat als momentopname mee in het beoordelingsmoment.

1. **Marktbeeld en gebeurtenissen** — EuroStoxx 50 stand en technische structuur, VSTOXX en volatiliteit, rente, obligaties, olie, macro-economie, geopolitiek; eventskalender voor de hele looptijd met de perioden waarin volatiliteit kan oplopen.
2. **Beheer van staartrisico** — per relevant event een behandeling: accepteren, vóór het event instappen, ná het event instappen, extra buffer aanhouden, strike of omvang aanpassen, of uitstellen. Vastgelegd in `cyclus_event`.
3. **Positie en portefeuillerisico** — expiratie en looptijd, strike(s), aantal contracten en verdeling; delta, theta, impliciete volatiliteit, skew, premie, afstand tot de markt, procentuele buffer, verhouding premie/risico; bestaande posities, totale blootstelling als percentage van het kapitaal, beschikbare buffer, gewenste maximale inzet.
4. **Exitplan en stoploss** — stoploss-niveau, stoplossniveau per strike als concrete ask-prijs, en welke events vóór expiratie een voortijdige sluiting afdwingen.
5. **Beheer tijdens de looptijd** — wie dagelijks volgt, wanneer tussentijds overleg plaatsvindt, wie de exit uitvoert.

### 5.3 Eén ronde, blind

| Wanneer | Vastgelegd | Zichtbaar |
| --- | --- | --- |
| Vóór het gesprek | Per persoon: go of no-go, bij go strike en expiratie, bij no-go een verplichte reden, plus de motivering en apart de intuïtieve waarneming | Pas als het quorum gehaald is, tegelijk voor iedereen |
| Tijdens het gesprek | Eén uitkomst voor de groep: go of no-go, bij go strike, expiratie en aantal contracten, met *wat het gesprek veranderde* en de aanwezigen | Direct |

- **Er is geen tweede inzendronde.** Wie tijdens het gesprek van mening verandert, doet dat in het gesprek; wat die verandering droeg staat in het veld *wat het gesprek veranderde* op het beoordelingsmoment.
- **Quorum.** Hoeveel inzendingen nodig zijn om de inhoud te openen, staat als veld op de processtap (bijvoorbeeld *2 van 3* als iemand er niet bij kan zijn). Het staat zichtbaar in de kop van de gerelateerde lijst.
- Gut feeling is een **eigen veld**, niet een zin in de motivering.

### 5.4 Blind versturen — twee momenten, één beeld

Beide momenten worden bereikt met de **actieknop op het cyclusrecord** (10.0e): eerst *Positie blind versturen*, en zodra het quorum gehaald is *Go / no-go meeting*. De twee schermen tonen hetzelfde materiaal; wat verschilt is of de inzendingen open zijn en of er een uitkomst vastgelegd wordt.

**Omvang wordt ingevuld als percentage, niet als aantal.** Op de inzending vul je *inzet in % van het kapitaal* in; het aantal contracten, de blootstelling en het premiebedrag volgen daaruit. Zo wordt een inzending meteen getoetst tegen de portefeuille (6.1) in plaats van tegen een los getal, en staan de drie inzendingen op één noemer naast elkaar. Het aantal contracten blijft wél het veld dat bij de uitvoering wordt vastgelegd — dat is wat de broker teruggeeft.

**Punten of euro's.** De invoer blijft in **indexpunten**: dat is wat Lynx quoteert, en Premie-60 en het winstanker zijn tegen de premie in punten gedefinieerd. Het scherm zet daar altijd het **eurobedrag** naast, afgeleid met de multiplier van € 10 per punt. Alles wat over omvang, blootstelling, portefeuille of resultaat per cyclus gaat, leidt in euro's; alles wat over de optie zelf gaat, leidt in punten.

**Scherm 1 — Positie blind versturen (asynchroon, vóór het gesprek).** Persoonlijk en rustig: het eigen oordeel go of no-go. **Het formulier vraagt alleen wat bij die keuze hoort**: bij een go de strike, de expiratiedatum en de inzet; bij een no-go de verplichte reden, direct onder de beslissing. Velden die niet van toepassing zijn staan er niet, want ze leiden af van de keuze die gemaakt wordt. Verder: bij go de strike en de expiratiedatum, bij no-go de verplichte reden, plus de motivering en de intuïtieve waarneming als apart veld. Versturen vergrendelt de inzending.

Boven het formulier staat de **eventstijdslijn** van de looptijd, met per event de vastgelegde behandeling. Daarnaast staan twee panelen met de feiten waartegen geoordeeld wordt:

- **Instapvoorwaarden** — de voorwaarden met hun gemeten waarde en status zoals ze op dat moment staan, met wie ze invulde en wanneer. Alleen-lezen op dit scherm; bijwerken gebeurt op de cyclus.
- **Technische analyse** — de chartlezing met de niveaus en het eindoordeel. Alleen-lezen.
- **Events** — alle events in de looptijd met datum, zwaarte en de vastgelegde behandeling. Wijkt een inzending af van een behandeling, dan hoort dat in de motivering.

Onderaan wie er al verstuurd heeft — alleen dát, nooit wát, tot het quorum gehaald is. **De gewogen score is op dit scherm niet zichtbaar**; een getal dat er staat voordat iemand oordeelt, stuurt dat oordeel en ondermijnt precies wat blind indienen moet beschermen.

**Scherm 2 — Go / no-go meeting (gedeeld scherm).** Hetzelfde beeld als bij het versturen, met de inzendingen open eronder en één blok om de uitkomst vast te leggen. Het bevat geen invoervelden per persoon meer; het gesprek beslist als groep.

- De **agenda** met vijf blokken, af te vinken tijdens het gesprek.
- De **eventstijdslijn** met de vastgelegde behandeling per event (agendablok 2).
- De **instapvoorwaarden** als volledige tabel: bron, drempel, gemeten waarde, gewicht, gate, status — plus de Tier-1-telling, de harde gates en **nu wel de score**, want het onthullen is geweest.
- De **drie inzendingen onder elkaar** in de gerelateerde lijst, met de verschillen zichtbaar: positie, strike, expiratie, inzet en reden.
- Onderaan **de uitkomst van het gesprek**: go of no-go, bij go strike, expiratiedatum en **inzet in % van het kapitaal** — dezelfde noemer als de inzendingen; het aantal contracten volgt uit de uitvoering en wordt daar vastgelegd — met wat het gesprek veranderde en wie aanwezig waren. Vastleggen zet de cyclus op *uitvoering ophalen*.
- De drie **motiveringen** bij de inzendingen, met de intuïtieve waarneming eronder.

Wat hier op het scherm staat, is wat een verandering van oordeel mag dragen: nieuwe informatie uit het gesprek, niet groepsdruk.

**Scherm 3 — De uitkomst van het gesprek.** Er is geen tweede inzendronde. Het gesprek eindigt in **één blok onderaan hetzelfde scherm**: go of no-go, en bij go de strike, de expiratiedatum en het aantal contracten, met *wat het gesprek veranderde* en wie aanwezig waren. Wie van mening veranderde en waarom, staat daarmee in het verslag van het gesprek en niet in een tweede formulier per persoon. Vastleggen zet de cyclus door naar *uitvoering ophalen*.

De regels zelf veranderen niet:

- Een inzending is tijdens *concept* alleen van de indiener. **Versturen** vergrendelt haar; daarna is ze niet meer te wijzigen.
- Anderen zien alleen dát er verstuurd is, door wie en wanneer.
- De inhoud gaat open zodra het **quorum** van de processtap gehaald is — niet eerder, ook niet voor degene die als eerste verstuurde.
- De afscherming zit aan de serverkant: de API geeft de inhoud van andermans inzending vóór dat moment niet terug. Een schermregel die alleen verbergt, is geen afscherming.

### 5.5 Beslisregel

| Oordelen | Vervolg | Uitkomst |
| --- | --- | --- |
| Drie go | Alle positieparameters bevestigen, daarna plaatsen | GO |
| Twee go, één no-go | Bezwaar opnieuw bespreken; alleen als degene met no-go zelf naar go gaat, kan uitvoering volgen | anders NO-GO |
| Eén go, twee no-go | Bezwaren vastleggen, nieuw beoordelingsmoment bepalen | NO-GO |
| Drie no-go | Redenen vastleggen, bepalen wanneer herbeoordeling zinvol is | NO-GO |

- **Voor uitvoering zijn drie go's nodig.**
- Niemand wijzigt een no-go onder druk. Het systeem kent geen route waarmee iemand anders' oordeel wordt aangepast.
- **Afwezigheid:** wie niet aanwezig kan zijn, levert vóór het gesprek schriftelijk een oordeel met motivering. **Zonder schriftelijk oordeel geldt no-go.** Afwezigheid verlaagt de lat niet.

### 5.6 Rollen, geen gewichten

| Persoon | Bijdrage |
| --- | --- |
| Pieter | Technische analyse en marktstructuur; meewegen of voorzichtigheid een valide instap onnodig tegenhoudt |
| Simon | Eigen analyse en gut feeling; signaleren wanneer marktgedrag afwijkt van de verwachting |
| Jacqueline | Macro, techniek, risico en marktgevoel samenbrengen tot een eindbeoordeling |

De rol wordt naast ieders oordeel getoond als context en telt niet mee in een berekening. Rolbeschrijvingen staan in de configuratie en zijn herzienbaar.

### 5.7 Vastleggen

Elk gesprek wordt gedocumenteerd, ongeacht de uitkomst: het voorlopige en definitieve oordeel van ieder met reden, de uitkomst, en bij go de positieparameters, het exitplan en de taakverdeling.

---

## 6. Van besluit naar positie

- **De positie komt van de broker.** Knop *Positie ophalen* vraagt de openstaande OESX-posities op; je wijst de juiste aan en die wordt als positierecord vastgelegd. Dat record is daarna de waarheid. Tot de brokerkoppeling er is: dezelfde velden met de hand.
- **De uitvoering wordt tegen de uitkomst gelegd.** Bij het koppelen van een opgehaalde positie aan de vastgelegde uitkomst van het beoordelingsmoment vergelijkt het systeem strike, expiratie, aantal en ontvangen premie. Wijkt er iets af buiten de ingestelde tolerantie — standaard: strike, expiratie of aantal ongelijk, of ontvangen premie meer dan 10 % onder de verwachte — dan zet het systeem *afwijking van besluit* op ja, vraagt om het soort afwijking (andere strike, andere expiratie, minder contracten, slechtere fill, deels uitgevoerd, anders) en om een verplichte toelichting. Het positierecord toont vastgelegd en uitgevoerd naast elkaar.
- Zonder die registratie toetst de post-analyse een besluit tegen een uitvoering die er misschien niet op leek. De tolerantie is een instelling, geen code.
- **Het exitplan gaat vóór de order.** De positie kan pas als uitgevoerd worden vastgelegd wanneer stoploss als ask-niveau per strike, de sluit-afdwingende events en de taakverdeling gevuld zijn. Volgorde, geen waarschuwing.
- **Stoploss wordt niet verruimd tijdens de looptijd.** Aanscherpen mag, verruimen wordt geweigerd en genoteerd.
- **Tranches** zijn aparte records met eigen strike, aantal, premie en expiratie. Verschillende expiraties binnen één cyclus zijn toegestaan. De cyclus toont de eerstvolgende en de laatste expiratie.
- **Sizing** wordt ingevuld bij het innemen van de eerste tranche en getoetst **op portefeuilleniveau**, niet per cyclus. Zie 6.1. **OPEN** — onder welke omstandigheden mag de tweede tranche geschreven worden?
- **Doorrollen** is de vierde uitkomst naast waardeloos expireren, vervroegd sluiten en exitplan-activatie. Rollen gebeurt bij de broker; het dashboard neemt het over. De oude tranche krijgt status *doorgerold* met verwijzing naar de opvolger, de nieuwe krijgt herkomst *roll van*. De rol wordt doorgerekend als één bedrag (teruggekochte premie tegenover nieuw ontvangen premie). Het rolbesluit komt met reden in de besluitlog.

**Eenmaal in positie beslist niet meer de vergadering, maar de markt.** Het besluitproces — aanwezigen, blind inzenden, quorum, gesprek — geldt voor de **instap**, en daar houdt het op. Doorrollen, vervroegd terugkopen en een stoploss die raakt zijn **tijdsgevoelig**: wie daarvoor eerst drie blinde inzendingen moet verzamelen en een overleg moet beleggen, is het moment kwijt. De handeling gebeurt dus bij Lynx, door wie er op dat moment aan zet is, en de cockpit **leest achteraf wat er gebeurd is en vraagt om duiding**. Dat is geen gemis aan zorgvuldigheid maar een andere plek ervan: niet vooraf stemmen, maar achteraf verantwoorden, met de transacties van de broker als bewijs in plaats van een verslag.

Daaruit volgt wat er **niet** gebouwd wordt: er komen geen besluitsoorten *rol*, *vervroegd sluiten* en *afwijken van het exitplan*. Het veld `beoordelingsmoment.soort` houdt alleen *instap* over; de andere drie waarden vervallen. Wat die besluiten zouden vastleggen — wat er gebeurde en waarom — legt het vastleggen van de uitkomst vast, op de tranche zelf.

**Het systeem herkent wat er gebeurd is; het bepaalt het niet.** Een rol ziet er bij de broker uit als twee transacties: de lopende tranche wordt gesloten en een nieuw contract wordt geopend. Vervroegd terugkopen is alleen die eerste. Waardeloos aflopen is geen transactie maar een positie die verdwijnt op haar expiratiedag. Die drie zijn uit het Flex-rapport te onderscheiden, en het systeem doet dat — maar als **voorstel**, met erbij welke transacties het zag. Een mens bevestigt of kiest een andere uitkomst. Het rapport is bovendien minuten oud (zie 11): dit is een middel om vast te leggen wat er gebeurd is, geen middel om te bewaken wat er gebeurt.

**Een doorrol laat de volgende tranche ontstaan zonder besluit erboven.** Het systeem koppelt de nieuwe positie aan dezelfde cyclus met tranchenummer n+1, vult contract, strike, expiratie, aantal en premie uit de uitvoering bij Lynx, en zet `herkomst` op *van de broker* — niet op *uit een besluit*, want er was er geen. De oude tranche krijgt uitkomst *doorgerold* met `doorgerold_naar` naar de nieuwe. Het veld `beoordelingsmoment` blijft bij zo'n tranche leeg, en de velden *wat het besluit zei* blijven dus ook leeg: er valt niets te vergelijken, en een afwijking tegen een besluit dat niet bestaat is geen afwijking. Het **exitplan** van de nieuwe tranche wordt wel klaargezet zoals bij elke tranche, en zolang het niet volledig is komt de tranche de eerste stand niet uit.

**Wat er verplicht bij moet.** Precies omdat er geen overleg aan voorafging, vraagt het vastleggen om een **toelichting** zodra de handeling van het plan afwijkt: een tranche die gesloten werd terwijl de stoploss niet geraakt was, een stoploss die niet uitgevoerd werd terwijl hij wél geraakt was, of een rol die verder weg of groter is dan de portefeuilleregels toelaten. Dat is één verplicht veld bij het vastleggen, geen proces — en het staat in de audit trail met wie het schreef.

**Uitkomst vastleggen loopt via de brokerkoppeling.** Een tranche eindigt doordat jíj iets doet bij Lynx; het systeem ziet dat en vraagt om duiding. De volgorde is vast: de koppeling **meldt de wijziging** (contract, aantal, prijs, tijdstip), het systeem **stelt de uitkomst voor** op grond van wat het gelezen heeft, en een mens **bevestigt of corrigeert** — vastleggen gebeurt nooit automatisch. Zolang de uitkomst niet vastligt staat de tranche in de tussentoestand *bij Lynx gewijzigd, nog niet vastgelegd* en gaat er niets naar de leden.

| Wat de koppeling ziet | Voorgestelde uitkomst |
| --- | --- |
| aantal naar 0 op de expiratiedag, laatprijs vrijwel nul | waardeloos geëxpireerd |
| teruggekocht vóór expiratie, onder break-even | vervroegd teruggekocht |
| sluiting plus een nieuwe opening op een verdere expiratie, zelfde dag | doorgerold, met de opvolger eraan gekoppeld |
| sluiting terwijl de ask in de waarschuwingszone of voorbij de stoploss stond | exitplan uitgevoerd |

Bij *doorrollen* wijs je de opvolger aan, bij *exitplan* is een reden verplicht. Het vastleggen zet vier dingen in gang: de tranche krijgt zijn uitkomst en gaat mee in de post-analyse, de cyclus sluit alleen als er geen tranche meer open staat, de barometer herrekent op de nieuwe zwakste tranche, en de **publicatie staat klaar** met het sjabloon van die uitkomst. Vastleggen gaat altijd vóór publiceren: eerst het feit, dan het verhaal.

**Een rol houdt de cyclus open.** *Doorgerold* is een uitkomst van een **tranche**, nooit van een cyclus. De opvolger hoort bij dezelfde cyclus, dus zolang die opvolger open staat kan de cyclus niet afgesloten worden — ook niet als alle andere tranches al weg zijn. Sluiten kan pas als **elke** tranche in de cyclus een eindtoestand heeft (waardeloos afgelopen, vervroegd gesloten of exitplan uitgevoerd); *doorgerold* is geen eindtoestand maar een verwijzing naar de volgende tranche. Een rol verlengt dus de boog, en daarmee ook het moment waarop een volgende cyclus kan openen (2).

### 6.1 Blootstelling en sizing op portefeuilleniveau

Blootstelling en buffer zijn eigenschappen van de **portefeuille**, niet van een cyclus. Ook nu cycli elkaar niet overlappen (2) blijft dat zo, om drie redenen. Binnen één cyclus stapelen tranches op elkaar, en een rol verlengt de looptijd — de vraag “hoeveel staat er op dit moment uit” is dus nooit te beantwoorden met één getal op de cyclus. Een cyclus kan lopen terwijl het verslag van de vorige nog open is, en een cyclus is niet de enige mogelijke bron van blootstelling. En de ondergrens die telt is de reserve op het totaal, niet de ruimte binnen één boog.

- **Blootstelling** = som over alle open tranches, ongeacht cyclus, van `strike × multiplier (€10) × aantal contracten`. Dit is de notionele waarde die bij een naked put tegenover je staat.
- **Inzet in procent** = blootstelling ÷ kapitaal. **Reserve** = 100 % − inzet.
- `portefeuille_instelling` houdt kapitaal, maximale inzet, minimale reserve, maximale inzet per cyclus, en of een overschrijding waarschuwt of blokkeert. Standaardwaarden uit de septemberanalyse: eerste tranche ≤ 24 %, minimaal 40 % reserve.
- De instelling heeft *geldig vanaf*; een verhoging van het kapitaal maakt oude toetsingen niet met terugwerkende kracht anders.
- Nieuwe bronnen voor voorwaarden: `portefeuille.blootstelling`, `portefeuille.inzet_pct`, `portefeuille.reserve_pct`, `portefeuille.inzet_deze_cyclus_pct`. Daarmee is een sizing-regel gewoon een voorwaarde met bouwsteen 4, geen aparte machinerie.
- De cyclus toont **zijn aandeel** plus de portefeuillestand: *reeds ingezet (andere cycli) + voorgenomen = totaal, tegen het plafond*. Op het go/no-go-scherm staat die som bij agendablok 3.
- Het overzichtsscherm krijgt een portefeuillestrook: ingezet, reserve, blootstelling in euro, en welke cycli eraan bijdragen.

**Te bevestigen met Jacqueline:** meten we de inzet op notionele waarde (strike × multiplier × contracten) of op de margin die Lynx werkelijk vasthoudt? Notioneel is conservatiever, stabieler en niet afhankelijk van het marginmodel van de broker, en is daarom de standaard. De keuze is een instelling, geen herbouw.

---

## 7. Bewaking tijdens de looptijd

- Per tranche: afstand tot de strike in punten en procenten, aandeel verdiende premie, huidige waarde, dichtstbijzijnde drempel, resterende handelsdagen, events binnen de resterende looptijd.
- Drie ingangen op hetzelfde bouwwerk: de related list onder de cyclus, de cross-cyclus lijst *Lopende posities* (een `db_view` met vast filter), en het formulier van de positie zelf.
- **Betrouwbaarheidstoets vóór elke melding:** spreadbreedte niet abnormaal, koers vers, binnen handelsuren, en voor een drempel die tot handelen zou leiden een tweede bevestigende meting.
- **Staartrisico.** **OPEN, voorstel:** per tranche, voor de keten én voor de hele portefeuille het verlies bij −5%, −10% en −15%, in euro's en als veelvoud van de ontvangen premie. Reden: de stoploss beschermt tegen de drift, niet tegen een gap; het bedrag is berekenbaar waar de kans dat niet is.

---

## 8. Post-analyse

- Het maandverslag is een **beknopt document dat de co-founders zelf schrijven** aan het eind van de cyclus.
- Voorgevuld door het systeem: uitkomst, ontvangen en teruggekochte premie, netto resultaat, doorlooptijd vanaf de eerste instap, rendement, kleinste afstand tot de strike, tijdlijn van de besluiten, aantal rollen.
- Door de co-founders geschreven: verloop, marktbeeld, besluiten en waarom, plus zelfreflectie.
- **Uitkomst hoort bij de tranche, niet bij de cyclus.** Een cyclus heeft één resultaat, één doorlooptijd en één kleinste buffer; *waardeloos geëxpireerd*, *vervroegd gesloten*, *doorgerold* en *exitplan uitgevoerd* zijn eigenschappen van een `positie`. Een cyclus met drie tranches kan dus drie verschillende uitkomsten dragen. Overzichten tonen per cyclus een telling per uitkomst en zijn uit te klappen naar de tranches eronder, met vanaf daar een doorklik naar het positierecord.
- **Toetsing per instapvoorwaarde:** hielp / neutraal / misleidend, met één zin toelichting. De toetsing leest `moment_voorwaarde`, zodat ze de cijfers gebruikt zoals ze bij het besluit stonden.
- **Afwijking tussen besluit en uitvoering** komt in het verslag terug: wat was goedgekeurd, wat is uitgevoerd, en waarom het verschilde.
- **Een no-go wordt ook geëvalueerd.** Bij no-go legt het systeem de niet-ingenomen positie vast zoals ze op tafel lag, en rekent na afloop van die periode uit hoe ze zou zijn afgelopen. Zonder dat leert het track record alleen van instappen en niets van terughoudendheid.
- Omdat het voorlopige en definitieve oordeel van ieder bewaard blijft, is per persoon terug te kijken hoe oordelen uitvielen. Dat is de basis om de rolverdeling te herzien. Met twaalf cycli per jaar is dit gespreksstof, geen ranglijst.
- Het verslag hangt onder de cyclus en wordt nooit verwijderd.

---

## 9. Klantcommunicatie

**Koppelvlak.** Eén afgeleide toestand per cyclus: fase, stand in vijf niveaus, richting, kernzin van de co-founders, positiegegevens alleen na publicatie, en het tijdstip van bijwerken. Eén endpoint, de app leest alleen.

- **De meter meet per fase iets anders.** Eén schaal van vijf, maar met een andere betekenis per fase. De labels en niveaus staan in de configuratie, niet in code.

| Fase | De meter meet | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Pre-analyse | nabijheid tot een instapmoment | rustig afwachten | aan het kijken | analysemoment gepland | beeld komt samen | besluitmoment vandaag |
| In positie | veiligheidsmarge van de positie | onder druk | krap | ruim | comfortabel | vrijwel afgerond |
| Post-analyse | uitkomst van de cyclus | exitplan uitgevoerd | met verlies gesloten | vlak | met winst gesloten | waardeloos afgelopen |

- Ook de **richting** betekent per fase iets anders: dichterbij of verder weg in de pre-analyse, veiliger of krapper in positie, en geen richting in de post-analyse.
- **Bij een fasewissel wordt de stand altijd opnieuw gepubliceerd**, met een zin die uitlegt waar de meter nu naar kijkt. Nooit stilzwijgend: anders verandert "stand 3" van betekenis zonder dat een lid het merkt.
- De drempels en de hysterese horen bij de schaal van die fase, niet bij de barometer als geheel.
- **Eén cyclus, één barometer — en die volgt de zwakste positie.** In *in positie* kan de cyclus meerdere tranches dragen (in de praktijk hoogstens drie), elk met een eigen gezondheid. De stand wordt dan bepaald door de **slechtst staande open tranche**, zonder ondergrens: ook een kleine tranche die tegen een exitregel aan loopt trekt de stand omlaag. Dat is bewust conservatief — de meter is er om actie uit te lokken, en een gemiddelde zou juist het geval verbergen waarin iets moet gebeuren. Een ruime tranche kan de stand dus nooit optillen.
- **Onder de meter wordt het specifiek.** Eén cijfer, en daaronder staat wélke positie aandacht vraagt. Intern draagt die tranche in de lijst de pil **bepaalt barometer**, zodat meteen duidelijk is waar de stand vandaan komt en waar de actie zit. Extern staat er onder de meter dezelfde aanwijzing in woorden, zonder cijfers of strikes (“van onze twee posities staat die van half oktober het krapst, en die bepaalt de stand”), en bij een voorstel benoemt het systeem de tranche, het overschreden niveau en het tijdstip.
- **De nuance gaat in de zin, niet in een tweede meter.** De leden houden zelf geen posities; ze volgen de cyclus. Er komt daarom nooit een tweede meter bij als er een tranche bij komt. Wat er speelt staat in de kernzin (“twee posities staan ruim, één staat krap tegen het rentebesluit”) en in de reden bij het voorstel, waar het systeem benoemt wélke tranche de stand bepaalt en sinds wanneer.
- **Een nieuwe tranche kan de stand doen verspringen.** Dat is nieuws, geen fout: die publicatie krijgt altijd de zin erbij waarom de stand verschoof. Intern blijft de gezondheid per tranche zichtbaar op het dashboard; extern blijft het één getal.
- Merkbare vertraging (orde van een kwartier). Geen onbewerkte marktwaarde in de uitvoer.
- Een stand verandert pas bij het overschrijden van een niveau, met hysterese.
- Een positie verschijnt pas ná uitvoering én na een bewuste publicatie. Idem bij sluiten.
- Berichten per fase met sjabloon dat de cijfers voorvult. Video's worden buiten de Cockpit opgenomen en toegevoegd; een tekstversie bij elke video.
- Elk bericht is onveranderlijk na publicatie; een rectificatie is een nieuw bericht dat naar het vorige verwijst.
- Elk bericht draagt dezelfde voet: kennis en eigen posities, geen individueel beleggingsadvies.
- **Afhankelijkheid:** hergebruik van marktdata richting leden moet bevestigd zijn door LYNX en IBKR vóór het ledendeel gebouwd wordt.

### 9.1 Het publicatieproces

**Wat we ermee willen bereiken.** De leden horen het van ons en niet van de markt; alles wat naar buiten gaat hangt aan een vastgelegd feit; iedereen krijgt dezelfde boodschap op hetzelfde moment; de vorm is herkenbaar en de tekst is onveranderlijk en herleidbaar. Daar volgt één proces uit, en elke communicatie met de leden loopt erdoor — zonder uitzondering, ook een korte mededeling.

**De afzender is Delta Blueprint, nooit een persoon.** Er staat geen naam van een co-founder onder een bericht en er is geen persoonlijke ondertekening. De leden volgen één stem; wie schreef en wie publiceerde staat wel intern vast in de registratie. Dat maakt het proces ook schaalbaar: er kan iemand bij komen zonder dat de buitenkant verandert.

**Vijf stappen, altijd dezelfde.**

| # | Stap | Eigenaar | Wat de stap afdwingt |
| --- | --- | --- | --- |
| 1 | **Aanleiding** | systeem | Geen bericht zonder gebeurtenis. De aanleiding kiest het sjabloon; je begint nooit met een leeg scherm |
| 2 | **Opstellen** | elke deelnemer | De cijfers komen uit het onderliggende record en zijn niet vrij invulbaar; alleen de duiding is vrije tekst |
| 3 | **Controle** | tweede lezer | De automatische toets plus een lezer die niet de schrijver is |
| 4 | **Publiceren** | vaste rol | Eén handeling, één tijdstip, app en mail dezelfde tekst |
| 5 | **Vastlegging** | systeem | Onveranderlijk; een correctie is een nieuw bericht dat naar het vorige verwijst |

**De aanleidingen zijn configuratie, geen code.** Ze staan als gewone tabel onder BEHEER, met de gerelateerde lijst *Aanleidingen* op het procesrecord **Publicatie**. Een aanleiding is één van twee soorten, en die keuze bepaalt welke velden zichtbaar zijn:

- **Gebeurtenisgedreven** — een statuswissel op een bestaande tabel, precies zoals de bouwstenen elders in het systeem: *brontabel, bronveld, van-waarde, naar-waarde*. “Positie ingenomen” is `positie.status` van *voorgenomen* naar *uitgevoerd*; “uitkomst van een tranche” is dezelfde tabel naar een van de vier eindtoestanden. Er komt geen regel code bij als je er één toevoegt.
- **Ritmisch** — fase, frequentie, dag en tijdstip. “Wekelijkse update” is: fase *in positie*, wekelijks, maandag 17:00. De aanleiding ontstaat alleen zolang de cyclus in die fase staat.

Elke aanleiding draagt verder het **sjabloon**, de **maximale reactietijd** en of er een **standwijziging** verplicht mee moet. Wijzigingen volgen de configuratieversie (3.4), net als de rest van de rekenende laag: ze gelden vanaf de volgende cyclus.

De lijst zoals hij nu is, elk met een eigen sjabloon: cyclus geopend, analysemoment verzet, go/no-go-uitkomst, positie ingenomen, standwijziging, uitkomst van een tranche (waardeloos, vervroegd, doorgerold, exitplan), cyclus afgesloten, maandbericht, en de wekelijkse update — de enige met de klok als aanleiding. Een nieuwe soort communicatie betekent een nieuwe aanleiding met een sjabloon, niet een los bericht: zo blijft het proces schaalbaar zonder dat de vorm uiteenloopt.

**Een standwijziging gaat altijd samen met een bericht.** De barometer verschuift nooit stil. Op het opstelscherm staat daarom bovenaan de huidige en de voorgestelde stand naast elkaar, met een vinkje dat de stand meeverhuist bij het publiceren. Omgekeerd kan een stand ook niet gepubliceerd worden zonder tekst.

**Stiltebewaking.** Elke aanleiding draagt een maximale reactietijd. Een vastgelegde gebeurtenis die nog niet gepubliceerd is, verschijnt na die tijd als taak in *Mijn taken*, bij naam. De klok loopt vanaf het vastleggen, niet vanaf het moment dat iemand tijd heeft.

**Rectificatie is eersteklas.** Een fout bericht wordt niet bewerkt maar gevolgd door een nieuw bericht dat ernaar verwijst; de leden zien de correctie in plaats van dat de geschiedenis verandert.

**Geen tweede handtekening voor de inhoud.** De automatische controle waarschuwt (geen koersen, geen drempels, geen strikes, voettekst aanwezig, vertraging actief, tekstversie bij video) maar blokkeert niet; wat er uitgaat blijft een menselijk besluit. De tweede lezer in stap 3 leest, hij keurt niet goed.

**Er is geen aparte publicatiecockpit meer.** Wat over de lopende cyclus naar buiten gaat staat in de rechterkolom van het operationele dashboard, de sjablonen staan onder BEHEER, en *Publicaties* is de gewone lijst van wat er is uitgegaan.

**Datamodel erbij:**

| Tabel | Eén record is | Velden |
| --- | --- | --- |
| `barometer_schaal` | Eén niveau binnen de schaal van één fase | Fase, niveau 1–5, label, betekenis, welke afgeleide grootheid het niveau bepaalt, drempel, hysterese |
| `barometer_stand` | Eén stand van de barometer | Cyclus, fase, afgeleid niveau, gepubliceerd niveau, richting, kernzin, afgeleid op, gepubliceerd op, door wie (intern), reden van wijziging, fasewissel ja/nee, bepalende tranche |
| `aanleiding` | Eén soort gebeurtenis die een bericht vraagt | Naam, **soort** (gebeurtenis of ritme), sjabloon, maximale reactietijd, standwijziging verplicht ja/nee, actief, `versie_vanaf`/`versie_tot`. Bij soort *gebeurtenis*: brontabel, bronveld, van-waarde, naar-waarde. Bij soort *ritme*: fase waarin het geldt, frequentie, dag en tijdstip |
| `publicatiesjabloon` | Eén sjabloon | Naam, fase, soort, tekst met plaatshouders, welke velden voorgevuld worden, video verplicht ja/nee |

Op `publicatie` komt erbij: aanleiding, bronrecord, sjabloon, fase, status (concept / in controle / te publiceren / gepubliceerd / gerectificeerd), kanaal, bereik, opsteller, lezer, publicist, en bij een rectificatie de verwijzing naar het bericht dat het corrigeert. De afzender is vast: Delta Blueprint.

---

## 10. Schermen en navigatie

### 10.0 Applicatie-architectuur — bindend voor alles wat nog gebouwd wordt

Dit is de zwaarste regel van hoofdstuk 10. Wie een scherm ontwerpt begint hier, niet bij het beeld.

**Het model is lijst → record → gerelateerde lijsten.** Elke tabel heeft precies één lijstscherm en één recordscherm. Op het record staat bovenaan het formulier met de eigen velden, daaronder de records die eraan hangen als tabbladen. Er bestaat geen scherm dat iets anders is dan één van die twee, op drie benoemde uitzonderingen na (hieronder). Een scherm bouwen begint dus altijd met de vraag: *van welke tabel is dit de lijst of het record?* Is daar geen antwoord op, dan is het geen scherm maar een tabblad.

**Niet elke verwijzing is ouderschap.** Een gerelateerde lijst wordt afgeleid uit het **ouderveld**, en dat herken je eraan dat het niet op het formulier staat: je kiest het niet, het ligt vast zodra het record bestaat. Een verwijzing die je wél kiest — het besluit onder een tranche — is een koppeling, en levert dus geen tabblad op. Een positie hoort bij haar cyclus; dat ze naar een beoordelingsmoment wijst, maakt haar geen onderdeel van dat moment.

**Een verwijzing naar de eigen tabel is geen kindlijst.** `doorgerold naar` wijst van de ene tranche naar de volgende; dat maakt de opvolger geen onderdeel van zijn voorganger. Zulke verwijzingen staan als veld op het formulier, nooit als tabblad eronder — anders zou elk record zichzelf als gerelateerde lijst dragen.

**Een kindtabel heeft geen eigen menu-ingang en geen eigen lijstscherm.** Ze verschijnt als **gerelateerde lijst** op het record van haar ouder; dat tabblad *is* de lijst. Alleen tabellen die zelfstandig betekenis hebben — cycli, posities, publicaties, besluiten, processen — krijgen een eigen lijst in het menu. Stappen horen bij een proces, aanleidingen bij het proces Publicatie, voorwaarden bij een cyclus: die staan nergens los.

**Een nieuw record typ je in de lijst zelf (5 okt 2026).** Onderaan elke lijst en elke gerelateerde lijst staat een lege regel: je typt erin en drukt op Enter, en het record bestaat. Geen knop, geen formulier, geen terugkomen. De knop *Nieuw* blijft staan voor wie het hele formulier wil — voor een record met tien velden is dat de betere weg — maar voor een voorwaarde of een event was een scherm openen om twee woorden in te typen drie handelingen te veel.

De regel staat er alleen waar aanmaken mag: in een gerelateerde lijst als `magNieuw` niet uit staat, in een volledige lijst als de tabel `nieuw_vanuit_lijst` draagt. In een gerelateerde lijst krijgt de ouderverwijzing vanzelf de ouder mee, net als bij de knop. Cellen die je niet kunt typen — een verwijzing naar een record, een afbeelding, een systeemkolom — blijven leeg; die vul je op het formulier. Een lege regel plus Enter maakt niets aan. Ontbreekt er een verplicht veld dat niet in de kolommen staat, dan zegt de lijst dat, en open je alsnog het formulier.

**Niet elke tabel krijgt een toevoegregel (0140).** `db_table.inline_nieuw` zet hem per tabel uit. Een besluit draagt een datum, een uitkomst, een strike, een expiratie en een inzet, en het opent een beoordelingsronde: dat vul je op het formulier in, waar je ziet wat er gevraagd wordt. Een halve regel in een lijst zou een half besluit zijn.

**De toevoegregel ligt te rusten tot je typt (5 okt 2026).** Zichtbaar is één uitnodiging — *Nieuw — typ en druk op Enter* — in de eerste invulbare kolom. Zodra daar iets staat, komen de andere kolommen erbij. De cellen blijven wel staan, zodat de kolommen niet verspringen. Een datum typ je als `dd/mm/jjjj` in een gewoon tekstvak: een kalenderknop in elke datumcel maakt van een lege regel een rij knoppen, en getypt is het korter. Een verplichte datum — *geopend op* — staat er meteen in, want dat is toch vandaag. Enter maakt de regel aan, ook in een tekstvak; een witregel typ je met shift-Enter.

**Records worden gemaakt vanaf hun ouder, nooit vanuit het menu.** Een instapvoorwaarde maak je op de cyclus, een stap op het proces, een aanleiding op het proces Publicatie, een publicatie vanaf haar aanleiding. Het menu opent lijsten en dashboards; onder BEHEER staat alleen inrichting. De breadcrumb toont die ouderketen altijd volledig: *Beheer › Processen › Publicatie › Aanleidingen › Uitkomst van een tranche*.

**Eén record, meerdere toestanden — geen scherm per toestand.** Een cyclus in pre-analyse en dezelfde cyclus in positie zijn hetzelfde recordscherm met andere waarden en een ander actief tabblad; een positie doorloopt zes processtappen op één recordscherm. Dat er in de mockups aparte boards voor staan is een eigenschap van de mockup, niet van de applicatie.

**Twee uitzonderingen, en niet meer:**

1. **Het operationele dashboard** — een 360-view over één cyclus heen. Het toont, het bewerkt niet; elke regel erop linkt naar het record waar de bewerking hoort.
2. **Actieschermen bij een stap** — een scherm dat één processtap afhandelt met een handeling die niet in een formulierveld past: *positie blind versturen*, *go / no-go meeting*. Ze worden geopend met de actieknop op het record waar het proces loopt, dragen de stappenbalk van dat proces, en schrijven in dat record of in een kindtabel ervan — ze maken geen eigen tabel aan en staan niet in het menu.

**Wat er uit de uitzonderingen is gehaald:**

- *Mijn taken* is nu een **gewone lijst** met de standaardopmaak, gegroepeerd per cyclus. Dat er geen `taak`-tabel onder ligt maar een afleiding van processtappen, verandert niets aan het scherm: een lijst is een lijst.
- *Positie innemen* en *uitkomst vastleggen* zijn **standen van het positierecord** geworden — zie 10.0f. De lijst *Posities* opent nu een record in plaats van niets.
- De go/no-go is geen eigen schermfamilie meer — zie 10.0e.

### 10.0f Positie is één record met een status

**Wat er in etappe 11 gebouwd is (fase 1, met de hand).** De tabel `positie` staat er met het proces **POSITIE** als zes standen van één statusveld, en met het exitplan als velden op het record. Vier dingen regelt het systeem, de rest is het gewone recordscherm:

1. **Een go laat de eerste tranche ontstaan.** Bij het vastleggen van een go-uitkomst maakt het systeem de tranche aan en kopieert het besluit erin — strike, expiratiedatum en inzet — én bewaart apart *wat het besluit zei*. Overtypen is precies hoe een uitvoering ongemerkt van een besluit gaat afwijken.
2. **De uitvoering wordt tegen het besluit gelegd.** Verschilt de strike of de expiratie, of ligt de inzet meer dan de tolerantie onder het besluit, dan zet het systeem *afwijking* op ja en stelt het soort voor. De tolerantie staat op `portefeuille_instelling`, niet in de code. Tijdens het invullen is dat een waarschuwing; **de tranche kan pas gaan lopen als de afwijking geduid is.**
3. **Het exitplan gaat vóór de order.** Zolang stoploss, eventregel en wie dagelijks volgt niet gevuld zijn, komt de tranche niet voorbij *besluit goedgekeurd*. Volgorde, geen waarschuwing.
4. **De stoploss wordt niet verruimd.** Aanscherpen mag; een hogere ask wordt geweigerd en in de audit trail genoteerd. Dit is beslist en kent geen uitzondering, ook niet met een toelichting: een stoploss die je kunt oprekken is geen stoploss.

**Het formulier toont alleen de stand waarin de tranche staat.** Boven staat *Het besluit*, daaronder het kader **Open posities bij Lynx**, en daaronder *De tranche*. *De uitvoering* verschijnt pas vanaf de stand *order bij Lynx*, *Uitkomst* pas vanaf *bewaken* — leeg staan wachten op iets wat nog niet gebeurd is, is geen informatie (`db_sectie.standen`). De sectie *Systeem* staat er niet: wanneer en door wie een record ontstond, staat in de audit trail.

**De koppeling is een open verbinding, geen rapport.** Het Flex-rapport is rapportage: je vraagt het aan en krijgt een beeld van minuten tot een dag oud. Voor het vastleggen van wat er gebeurd is, is dat genoeg — voor het bewaken van een stoploss niet, en daar draait het exitplan op. De bron waar de cockpit op werkt is daarom de **TWS API**: geen vraag-en-antwoord maar een verbinding die aantikt op het moment dat er iets verandert.

**De brug.** Naast IB Gateway draait een klein programma (`brug/brug.mjs`) dat luistert naar posities, nettowaarde en uitvoeringen en elke verandering meteen doorduwt naar `/api/brug`. Het stuurt het **hele** positiebeeld mee, niet losse mutaties: één gemiste zending zou het beeld anders voorgoed laten afwijken. Daarnaast een **hartslag** van tien seconden, ook als er niets gebeurd is — zo kent de cockpit het verschil tussen *er gebeurt niets* en *ik hoor niets meer*. Blijft het meer dan vijfendertig seconden stil, dan is de verbinding niet langer *live* en zegt elk scherm dat erbij. Stil oude getallen tonen is erger dan niets tonen.

**Het verkeer gaat één kant op.** De brug belt naar de cockpit; de cockpit kan de brug niet bereiken en heeft geen enkele route naar de broker. In het bestand van de brug staat geen aanroep die een order kan plaatsen, wijzigen of annuleren. Twee sloten op dezelfde deur, en ze zitten allebei in wat wij bouwen — niet in een instelling die iemand ooit per ongeluk omzet.

**Read-Only API staat uit (beslist 3 okt 2026).** Dat was het derde slot, en het is bewust losgelaten. Met read-only aan komt orderinformatie niet door: je ziet een positie naar nul gaan maar niet tegen welke prijs. Dat is onverenigbaar met het voornemen, waar de nieuwe tranche met de échte fill-prijs moet ontstaan voordat er naar de leden gepubliceerd wordt — en liever een minuut later publiceren dan een geschatte premie versturen. De afweging is dus: één slot minder bij IBKR, in ruil voor een publicatie die klopt. Wat overblijft is sterker dan een instelling: de cockpit kent geen route naar de broker, en in de brug bestaat de aanroep om een order te plaatsen niet.

**Flex blijft, als vangnet.** Eén keer per nacht, niet elk kwartier. De stroom levert alleen wat er gebeurt terwijl de brug luistert; wat er gebeurde terwijl hij eruit lag, kent de TWS API niet meer. Het rapport kijkt terug en vult dat aan — en corrigeert de prijzen en commissies met wat er werkelijk afgerekend is. Stroom voor de tijd, rapport voor de waarheid.

**Drie tabellen.** `brokerpositie` is wat er nú open staat (de brug overschrijft het hele beeld), `brokergebeurtenis` is het spoor van wat er gebeurde — een aantal dat naar nul gaat, een uitvoering met haar prijs — en wordt nooit overschreven, en `brokerverbinding` draagt de stand van de verbinding zelf. Een uitvoering draagt haar eigen nummer (`execId`), zodat dezelfde fill bij een herhaalde zending niet twee keer in het spoor belandt.

**De machine.** De brug hoort op iets dat niet slaapt: een kleine VPS in Frankfurt of Amsterdam, met IB Gateway headless en IBC voor het dagelijkse herstarten. De blokkade die de Flex-webservice tegenhield, geldt hier niet — die zat op IBKR's webkant; IB Gateway belt zelf naar buiten. Op die machine staan brokergegevens: geen inkomende poorten behalve SSH met sleutels, Gateway alleen op localhost, de brug ernaast.

**Einde van een tranche — gebouwd (3 okt 2026).** Het scherm *Einde van een tranche* onder VASTLEGGING leest het laatste rapport en zet per lopende tranche naast elkaar: wat het rapport laat zien, en wat het systeem denkt dat het was. Vier uitkomsten — waardeloos geëxpireerd, doorgerold, vervroegd teruggekocht, exitplan uitgevoerd — en een vijfde antwoord dat het systeem ook mag geven: *dit weet ik niet, kies zelf*. Het bewijs staat náást het voorstel en niet erachter; een voorstel dat je moet geloven is geen voorstel. Vastleggen doet een mens, per tranche, en bij een rol ontstaat dan de volgende tranche van dezelfde cyclus met het contract uit het rapport — dat is de enige plek waar dit scherm iets aanmaakt. Het resultaat in punten is een aftrekking (ontvangen premie min terugkoopprijs), zichtbaar en te overschrijven.

**De broker is de bron; de cockpit spiegelt (4 okt 2026).** Hiervóór hield de cockpit een eigen begrip bij — de tranche — en probeerde dat te koppelen aan wat er bij de broker stond. Alles wat moeizaam voelde bestond alleen om die koppeling te onderhouden: herkenning, voorstellen, een vlag per cyclus, aangekondigde voornemens, het overnemen van onbekende contracten. Dat is geen bedrijfsproces maar boekhouding om twee lijsten gelijk te houden, en het staat bovendien in de weg op het enige moment dat het snel moet gaan.

De broker weet wat er openstaat. Dus spiegelt de cockpit dat, en verdwijnt de machinerie:

- **Besluit** hoort bij de cyclus. Nul of meer, chronologisch. Het zegt één ding: mogen we (nog) een positie innemen, en onder welke parameters. Een no-go terwijl je in positie zit gaat over de vólgende positie, niet over de lopende. Uitstappen gaat altijd en alleen via het exitplan; de twee overlappen nergens.
- **Positie** spiegelt de broker (`worker/spiegel.js`). Verschijnt er een contract, dan ontstaat de positie met de echte fill-prijs uit de uitvoeringen en een exitplan, en staat ze meteen op *publiceren naar leden*. Verdwijnt het contract, dan sluit de positie met de terugkoopprijs en het resultaat. Zonder fill-prijs ontstaat ze wel maar blijft ze op *uitvoering ophalen*: liever een minuut later publiceren dan een geschatte premie versturen.
- **Exitplan** hangt aan een positie en rekent tegen háár premie.
- **Cyclus** ís de keten. De besluiten en de posities naast elkaar op de tijdlijn — dat is het verhaal, en de post-analyse telt op wat eruit kwam.

Twee dingen zijn afgeleid en worden nooit gevraagd. Een positie verwijst naar het laatste *go*-besluit van haar cyclus vóór ze openging; zit dat in een raar geval naast, dan breekt er niets, want het is een verwijzing voor de post-analyse en geen mechaniek. En de uitkomst volgt uit de feiten: teruggekocht als er een terugkoop staat, waardeloos geëxpireerd als het contract verdween met de expiratie voorbij.

**Het bericht aan de leden is de rem (4 okt 2026).** Een positie staat binnen een seconde in de cockpit met de echte prijzen, maar daarmee is ze niet klaar om naar buiten te gaan: de cijfers vertellen wát er gebeurd is, niet waaróm. Dat laatste is het enige deel van deze hele keten dat een mens moet schrijven, en het enige deel dat leden werkelijk lezen.

Dus levert elke opening én elke sluiting een **concept** op in `publicatie`, met de feiten er al in en de begeleidende tekst leeg. Zolang dat concept openstaat, blijft de positie op *publiceren naar leden* staan — zichtbaar wachtend. Pas als jij de tekst schrijft en verstuurt, gaat ze door naar *bewaken*. Versturen is een eigen handeling met een eigen knop die om bevestiging vraagt, en nadrukkelijk geen gevolg van een gevuld veld: het is onomkeerbaar, en wat eruit ging ging eruit. Daarom draagt een verstuurd bericht ook zijn eigen kopie van de feiten; verandert de positie later, dan verandert het bericht niet mee.

Het scherm heet *Klaar voor de leden* en staat onder WERKEN, naast de posities zonder cyclus — geen tabel om in te kijken maar iets wat op je ligt te wachten. De tabel *Publicaties* onder VASTLEGGING houdt wat verstuurd is.

**'Doorgerold' bestaat niet meer als gegeven.** De cockpit weet dat een contract sloot en een ander opende; dát het één de opvolger van het ander was, is een verhaal over twee posities. Verhalen horen in de ledencommunicatie, niet in een datamodel.

Er blijft één vraag over die de broker niet kan beantwoorden: **bij welke cyclus hoort deze positie?** Loopt er één, dan is het die. Lopen er meerdere, dan blijft ze onverdeeld staan tot iemand kiest — één rolmenu, geen flow. Een positie die er niet bij hoort, zet je *buiten de cycli*. En één controle blijft: duikt er een positie op in een cyclus zonder voorafgaande go, dan valt dat op. Het blokkeert niets — de positie bestáát — maar je ziet het.

Wat verviel staat in `legacy/spiegel-overgang/`: het voornemen, de herkenning met haar voorstellen, de duidingsvlag, het scherm *Einde van een tranche*. Het is niet weggegooid maar opzijgezet; het heeft de aanname waarop het rustte grondig getest, en die aanname bleek de verkeerde.

**Een rol verlengt de boog (3 okt 2026).** Opent er een tranche met een expiratie voorbij de doelexpiratie van de cyclus, dan rekt die doelexpiratie mee. Anders lijkt de looptijd op elk scherm korter dan ze is, en — erger — vallen de events ná de oude datum buiten de cyclus terwijl je er juist doorheen moet. Het bijtrekken gebeurt overal waar een tranche ontstaat of van expiratie wijzigt, en trekt meteen de eventskalender opnieuw door de nieuwe periode.

**Een tranche uit een rol draagt geen besluit (3 okt 2026).** Het besluitproces liep op de eerste tranche; rollen gaat daar bewust buitenom omdat het tijdsgevoelig is. De opvolger erft dus niet het beoordelingsmoment en ook niet 'wat het besluit zei' — anders zou het formulier drie regels tonen over een besluit dat voor deze tranche nooit genomen is, en zou de afwijkingstoets een uitvoering vergelijken met een beslissing die er niet bij hoort. De keten blijft leesbaar via `doorgerold_naar`; dáár volgt de post-analyse hem. Het blok *Het besluit* verdwijnt op zo'n tranche van het formulier.

**Lezen in de lijst (3 okt 2026).** Drie regels die voor alle lijsten gelden. Een stand — status, uitkomst — staat altijd als **tweede kolom**, direct na de naam: je scant van links naar rechts, wat iets ís vooraan en hoe het ervoor staat meteen erachter. *Gesloten* is **grijs**, niet groen: groen betekent hier 'goed', en een gesloten tranche is niet goed of slecht maar klaar. En wat een tranche opbracht lees je in **punten**, zoals het in de optieketen staat — geschreven op 38,5, teruggekocht op 12,0, resultaat 26,5 — met de terugkoopprijs erbij, want zonder dat getal zie je het resultaat wel maar niet waaruit het bestaat. Een waardeloze expiratie staat op 0: je betaalde niets om eruit te komen, en dat is een getal en geen leegte.

**Break-even is een ask, niet een indexstand (3 okt 2026).** Het exitplan rekende break-even als *strike min premie* en noemde dat een indexniveau: "onder dit niveau kost de tranche geld". Dat klopt alleen op de expiratiedag. Eerder hangt de waarde van de optie ook af van volatiliteit en tijdswaarde — op datzelfde indexniveau staat de put dan ver boven de ontvangen premie en sta je onder water terwijl de regel zegt van niet. Een exitregel waar je op een slechte dag de verkeerde conclusie uit trekt is erger dan geen exitregel.

Het echte break-even is wél een ask, en het is een getal dat er al was: **de ontvangen premie**. Koop je terug boven dat bedrag, dan kost de tranche geld. Dat geldt op elk moment, ongeacht volatiliteit — het is een aftrekking, geen model. Daarmee staan alle drie de bewakingsregels in dezelfde eenheid, en dat is ook de eenheid die de brug streamt. Het indexniveau blijft bestaan als eigen soort *expiratieniveau* met een eerlijke omschrijving: een referentiepunt, geen bewakingsregel.

**De stroom gaat vóór het rapport (3 okt 2026).** Het scherm *Einde van een tranche* las het laatste Flex-rapport, ook als de brug live was. Daardoor keek je naar een beeld van vanochtend terwijl er net iets gebeurd was — en kreeg elke tranche die ná dat rapport ontstond de vlag *staat niet meer open bij Lynx*. De stand komt nu van de brug zolang die binnen vijf minuten iets van zich liet horen, en anders uit het rapport. Het scherm zegt erbij welke van de twee het is.

Dus wordt het gesplitst. Het feit neemt het systeem over, het verband vraagt het. Bij elke stand die binnenkomt draait `markeer`: per lopende tranche wordt vastgelegd wát er gezien is, en op de cyclus komt een vlag te staan die in de cyclilijst zichtbaar is. Daarnaast levert `verweesd` de contracten die bij Lynx openstaan en die geen enkele tranche kent, mét de tranches die net iets deden als mogelijke herkomst. Eén handeling legt het verband: `neemOver` sluit de oude tranche als doorgerold met het echte resultaat en maakt de nieuwe aan met de echte fill-prijs, op *publiceren naar leden* — of maakt er een losse tranche van als er geen voorganger is. De vlag gaat uit zodra de tranche is afgehandeld; een vlag die blijft staan leert je hem te negeren.

Beide wegen komen dus op hetzelfde uit — een tranche met echte prijzen die klaarstaat om te publiceren. Het verschil zit alleen in wanneer de mens aan zet is: vooraf bij een aankondiging, achteraf bij een noodhandeling.

Het matchen draait op elke stand die binnenkomt — bij elke push van de brug, en bij het nachtelijke rapport. Bron doet er niet toe: `pasVoornemensToe` krijgt posities en uitvoeringen, en `worker/brug.js` giet de stroom in diezelfde vorm. Mislukt het matchen, dan laat het de zending niet falen; de volgende push probeert het opnieuw.

Drie grenzen die erbij horen. **Zonder fill-prijs geen publicatie:** komt de uitvoering binnen zonder prijs, dan ontstaat de nieuwe tranche wel maar blijft ze op *uitvoering ophalen* staan tot de prijs er is — liever een minuut later publiceren dan een geschatte premie naar de leden. **Wat niet past, valt terug op duiding:** een andere strike dan aangekondigd, een deelvulling, of een sluiting zonder aankondiging zet het voornemen op *wijkt af* met daarbij wat er wél geopend werd, en dan neemt het scherm *Einde van een tranche* het over. Dat blijft het vangnet, niet de hoofdweg. **En een voornemen is een aantekening van jou:** de cockpit plaatst nooit een order en stelt nooit voor om te rollen (hard uitgangspunt 1).

Hieruit volgt één openstaande beslissing bij de broker: **Read-Only API moet uit**, anders komt orderinformatie niet door en zie je de positie wel naar nul gaan maar niet tegen welke prijs. Dat verzwakt één van de drie sloten; de andere twee blijven — het verkeer gaat één kant op, en in de brug staat geen aanroep die een order kan plaatsen.

**Voorwaarden en exitregels blijven uit elkaar (3 okt 2026).** Ze lijken op elkaar en doen iets anders. Een voorwaarde is een *waarneming*: je kijkt, je schrijft op wat je zag, je zet er een kleur bij, en daarna gebeurt er niets meer mee. Een exitregel is een *afspraak met een drempel die blijft lopen*: ze kan geraakt worden, ze mag nooit verruimd worden, ze wordt herberekend als de ontvangen premie wijzigt, en de herkenning aan het einde van een tranche leest haar om een terugkoop te duiden als *exitplan uitgevoerd* in plaats van *vervroegd teruggekocht*. Ze hangen ook aan iets anders: een voorwaarde aan de cyclus, een exitregel aan de tranche — rolt een cyclus door, dan krijgt tranche 2 een eigen stoploss tegen een eigen premie (zie 1, premie-referentie). Samenvoegen zou al dat gedrag achter een `if soort = 'stoploss'` zetten: geen vereenvoudiging, maar complexiteit verplaatsen naar waar ze minder zichtbaar is.

Wat wél dubbel was: `voorwaarde.soort = 'uitstap'`, een overblijfsel van vóór het exitplan bestond, waar geen worker en geen scherm iets mee deed. Je kon een uitstapafspraak op twee plekken vastleggen zonder dat iemand wist welke telde. Die keuze staat op niet-actief; bestaande rijen blijven leesbaar. Voorwaarden heten nu *Instapvoorwaarden*, en het exitplan heeft zijn menu-ingang terug — die ging in 0073 weg omdat een exitregel buiten zijn tranche niets zou zeggen, en dat argument vervalt nu de kolom *Tranche* in het overzicht staat.

Daarvoor is één algemene regel bijgekomen in `worker/lijst.js`: **een kolom waarop al op één record gefilterd is, valt uit de lijst.** In het exitplan ónder een tranche hoeft *Tranche* er niet bij te staan, in het overzicht over alle tranches heen juist wel — dezelfde weergave, zonder dat er twee van hoeven te bestaan.

De herkenning is getoetst tegen een nagemaakt Flex-rapport met alle vier de gevallen erin (`scripts/proef/materiaal/afloop.xml`), via `scripts/proef/afloop-gevallen.mjs` voor de redenering en `scripts/proef/afloop-vastleggen.mjs` voor wat er daarna in de database staat. Beide draaien zonder brokerkoppeling. Tegen een écht paper-rapport is het nog niet gedraaid; dat wacht op de activering van het paper account.

**Wat de opzet ons leerde (3 okt 2026).** IBKR antwoordt op drie verschillende problemen met dezelfde zin — *invalid username or password*. Een fout wachtwoord, een onzichtbaar Windows-regeleinde achter `IbPassword=` in `ibc-config.ini`, en een paper account dat nog geen handels- en marktdatatoegang heeft, zijn van buitenaf niet te onderscheiden. Het laatste herken je alleen in de portal, aan de regel *Trading access is unavailable for this user*. Daarom: eerst de portal, dan pas het wachtwoord. Het installatiescript schrijft nu `delta-ibc-schoon`, dat bij elke start de regeleinden weghaalt en weigert te starten zolang de inloggegevens nog op de sjabloonwaarden staan, en `brug/controleer.sh` geeft in één commando de stand van config, diensten, poort 7497 en — als er niets luistert — de tekst die op het scherm van de Gateway staat. Het virtuele scherm staat op 1920×1080, want de brede foutmeldingen van de Gateway vielen op 1024 buiten beeld.

**Het meetingscherm opnieuw ingedeeld (3 okt 2026).** Geen tabbladen meer: alles staat tegelijk op het scherm, want een gesprek waarin iemand eerst iets moet aanklikken om het te zien, is een gesprek waarin niet iedereen naar hetzelfde kijkt. Vijf blokken onder elkaar — de looptijd over de volle breedte met de events op de as en daaronder wat ieder zou schrijven; dan links de events van de cyclus en rechts de instapvoorwaarden, allebei de echte lijst van de applicatie met dezelfde kolommen; dan de technische analyse; dan de uitkomst; dan de portefeuille. De actieknop staat rechtsboven, zoals op elk recordscherm.

**De chartlezing (3 okt 2026).** Per gesprek één regel per chart: een schermafdruk en wat je erin leest. De eerste regel ligt vast — *Moving Average 8, 20, 50* — zodat elk gesprek met dezelfde blik begint en twee cycli naast elkaar te leggen zijn; daaronder voeg je zelf regels toe. De regels bewaren zichzelf zodra je iets wijzigt, want een schermafdruk die je plakte mag niet verloren gaan omdat de uitkomst nog niet is vastgelegd. De afbeelding staat als data-URL in de rij, net als een avatar, na verkleining in de browser tot 1400 pixels breed. Dat is een tussenstation: zodra er een R2-bucket is, verhuizen de afbeeldingen daarheen en blijft hier alleen de verwijzing over. **Herzien dezelfde dag:** de chartlezing hangt aan de **cyclus**, niet aan het gesprek. Het is geen verslag van het overleg maar materiaal dat erbij ligt. De vaste regel staat er dus vanaf het aanmaken van de cyclus, de lezing verschijnt als gerelateerde lijst op het cyclusrecord, en er is een verplichte processtap in de pre-analyse: *Technische analyse gelezen*. Zolang niet elke chart een schermafdruk én een lezing draagt, weigert de worker een blinde inzending — iedereen schrijft blind, maar wel op hetzelfde beeld. De afbeelding past zich aan de rij aan in plaats van andersom; het hele gesprek hoort op één scherm te passen, en binnen de lijsten scrol je naar de rest. Migratie 0082 herbouwt de tabel in plaats van hem uit te breiden: `beoordelingsmoment` stond op NOT NULL, en een chartlezing die bij een cyclus hoort heeft geen gesprek. **Les:** een migratie proefdraaien op een lege database bewijst niets — een insert die nul rijen raakt kan geen NOT NULL breken. Daarom `scripts/proef/migraties.mjs`, dat eerst een cyclus, een gesprek, een event en een voorwaarde zaait en dan de migraties eroverheen draait; met een versienummer als argument zaait het vlak vóór die migratie. In de app heet het geheel **Technische analyse**; `chartlezing` blijft de naam in de database. Het menu-item *Chartanalyses* — een overblijfsel uit de oude cockpit dat naar een tabel wees die nooit is gebouwd — wijst nu naar deze tabel en geeft een overzicht over alle cycli heen.

**De kalender is de bron voor de weging (3 okt 2026).** Een event droeg tot nu toe een eigen zwaarte én een behandeling per cyclus. Daarmee kon dezelfde dag in de kalender en in een cyclus iets anders zeggen, en moest je elk event twee keer wegen. Vanaf nu staat de zwaarte in de eventskalender en neemt een cyclus hem over zoals hij is; de weging per cyclus en de behandeling vervallen, net als de processtap die erom vroeg. Wat erbij komt is *notities* op het event, dat meereist naar de looptijd — beide lijsten tonen dezelfde kolommen en dezelfde inhoud. De kolommen blijven in de database staan: wat is vastgelegd wordt niet gewist.

**Formulieren: alles is een veld (3 okt 2026).** Overgenomen uit het werkmodel van ServiceNow, niet uit het uiterlijk. Een veld dat vastligt blijft een vak — grijs en uitgeschakeld — in plaats van kale tekst; een formulier dat wisselt tussen vakken en tekst legt zijn regels niet meer op één lijn en verzwijgt waarom het ene wel en het andere niet te wijzigen is. Een keuzeveld blijft een keuzelijst, ook als het proces en niet de gebruiker bepaalt wat erin komt: dan zie je welke standen bestaan en waar dit record staat. Een verplicht veld draagt links een streepje, oranje zolang het leeg is en groen zodra het gevuld is, zodat je vóór het opslaan ziet waar het misgaat. Wat uitgeschakeld staat, gaat ook niet mee naar de server. Twee staande regels die hieruit volgen: **een formulier draagt geen sectie 'systeem'** — *aangemaakt op* en *aangemaakt door* zijn boekhouding, ze staan al in de lijst en in de auditlog, en een nieuwe tabel krijgt die sectie dus niet; en **een record dat je vanuit een gerelateerde lijst aanmaakt, brengt je na het bewaren terug naar dat ouderrecord** (`db_table.na_aanmaken = 'ouder'`), want daar ging je mee verder.

**Het rapport wordt aangeleverd, niet opgehaald.** IBKR weigert verzoeken die van Cloudflare komen — *Access denied* vóór het token ook maar bekeken wordt. De worker kan het rapport dus niet zelf halen. Een klein script op een machine met een gewoon IP haalt het op en levert het af op `/api/lynx/rapport`, met een eigen sleutel die los staat van de aanmelding: dit is een script en geen mens. De cockpit bewaart het laatste rapport en leest daaruit. Dat verandert niets aan het uitgangspunt — er gaat alleen informatie van de broker naar ons, nooit andersom — en het maakt zichtbaar hoe oud het beeld is: bij de lijst staat wanneer het rapport binnenkwam.

**De koppeling is de Flex Web Service van IBKR.** Een rapport dat met een token wordt opgehaald: geen sessie die verloopt, geen machine die moet draaien, en — dit is geen bijvangst maar de reden — **geen enkel eindpunt dat kan schrijven**. Ophalen gaat in twee stappen (`SendRequest` levert een referentiecode, `GetStatement` de XML); het token en de query-id staan als secret bij Cloudflare en nergens in de repo. Het rapport telt twee secties: *Open Positions* voedt het kader, *Trades* draagt de werkelijk ontvangen premie en het uitvoeringstijdstip, gekoppeld op `conid`. Het is **rapportage en geen live beeld**: een paar minuten oud. Voor het vastleggen van een uitvoering is dat genoeg; voor het bewaken van een stoploss hebben we een andere bron nodig.

**De volgorde op het scherm is de volgorde van het denken:** eerst *Het besluit*, dan het kader met wat er bij de broker open staat, dan pas de tranche. Op een nieuwe tranche staat het formulier er nog niet: je kiest een positie uit het kader en dán verschijnt het, ingevuld. Een leeg formulier naast een lijst waaruit je kunt kiezen, nodigt uit tot overtypen. Lukt kiezen niet — het rapport loopt een dag achter, of de koppeling ligt eruit — dan is er één knop *De tranche met de hand invullen*.

**Kiezen in plaats van overtypen.** Het kader *Open posities bij Lynx* toont wat er bij de broker open staat; je wijst de juiste aan en het systeem vult contract, strike, expiratie, aantal, premie en uitvoeringstijdstip in, met herkomst *van de broker*. Het eindpunt (`/api/lynx/posities`) bestaat al en is **lezend**: het systeem plaatst nooit zelf een order. Zolang de koppeling er niet is (etappe 12, openstaand punt 6) zegt het kader dat eerlijk en vul je de tranche met de hand in — het scherm hoeft niet op de koppeling te wachten en verandert er later niet door.

**Het formulier begint bij het besluit.** De eerste sectie is *Het besluit*: links de keuze, rechts wat dat besluit zei. Wat eruit volgt — strike, expiratiedatum en inzet — wordt **overgenomen in plaats van overgetypt**, zowel bij het aanmaken als wanneer je een ander besluit kiest. Dat overnemen stopt zodra er iets is uitgevoerd: vanaf de stand *order bij Lynx* staat er een werkelijkheid in die velden, en die overschrijft het systeem niet met een voornemen — dan wordt alleen *wat het besluit zei* bijgewerkt, want dat is waartegen de uitvoering vergeleken wordt.

**Onder welk besluit deze tranche valt, is een keuze.** Eén cyclus kent meerdere beoordelingsmomenten en meerdere tranches. Het veld *Besluit* is daarom een keuzelijst van de **vastgelegde go-besluiten van déze cyclus** — geen moment dat nog loopt, geen no-go. Het laatste staat voorgevuld; kies je een ander, dan laadt het formulier meteen wat dát besluit zei, en bij het opslaan doet de worker hetzelfde nog eens: het scherm mag vooruitlopen, maar het is niet de plek waar de waarheid vandaan komt. Wat het besluit zei wordt **gekopieerd en niet opgezocht** — een besluit dat later wordt bijgesteld mag de vergelijking met deze uitvoering niet met terugwerkende kracht veranderen. `db_field.keuzelijst` zegt dat een verwijzing zo getoond wordt.

**De premie wordt ingevuld in contractwaarde, en gerekend in punten.** Op het formulier staat *Ontvangen premie (€ per contract)*; het systeem rekent die om met de multiplier uit de portefeuille-instelling (€ 10 per punt) en bewaart de punten eronder. Daarin rekenen het exitplan, de stoploss en de vergelijking met het besluit verder. Eén van de twee is invoer, de ander volgt — allebei laten invullen levert vroeg of laat twee waarheden op.

**Het formulier vraagt alleen wat je dan weet.** Het nummer van de tranche telt het systeem uit de cyclus, de contractnaam stelt het samen uit expiratie en strike, de stoploss staat op ask 60,0 en het winstanker begint op 70 % van de ontvangen premie. Secties die pas later iets te melden hebben — de uitvoering en de uitkomst — staan niet op het aanmaakformulier (`db_sectie.verbergen_bij_nieuw`), en een sectie waarvan alles alleen-lezen én leeg is wordt helemaal niet getoond: een rij streepjes is geen informatie.

De cyclus volgt zijn tranches: gaat er één bewaken, dan staat de cyclus *in positie*; is elke tranche gesloten, dan begint de post-analyse. Wat de brokerkoppeling straks doet — ophalen en voorstellen — doet een mens nu met de hand; wat het systeem nooit doet, blijft hetzelfde: orders plaatsen.

`positie` heeft **één recordscherm** met het proces **POSITIE** (besluit goedgekeurd → order bij Lynx → uitvoering vastgelegd → publiceren naar leden → bewaken → gesloten) en één statusveld dat zegt waar de tranche staat. *Exitplan vastgelegd* is geen eigen stand: het exitplan is een gerelateerde lijst en een voorwaarde om de eerste stand uit te komen. **Publiceren naar leden** staat tussen de uitvoering en het bewaken, want vastleggen gaat altijd vóór publiceren — eerst het feit, dan het verhaal (6) — en zolang het bericht niet uit is, is de tranche nog niet in bewaking. De lijst *Posities* opent dat record; wat eerder losse actieschermen waren, zijn statussen ervan.

Bovenaan staat altijd hetzelfde formulier: tranche, cyclus, status, expiratie, contracten, ontvangen premie, besluit, exitplan en aandeel van de portefeuille. Daaronder wisselt het beeld met de status:

- **order geplaatst → uitvoering importeren** — het goedgekeurde besluit, het exitplan, de vergelijking met wat Lynx teruggeeft (strike, expiratie, aantal, premie) en de sizing op de portefeuille. Buiten de tolerantie zijn soort en toelichting van de afwijking verplicht.
- **bewaken** — het exitplan als vier regels met hun stand (stop loss ask 60,0 · winstanker · break-even · eventregel), en de gerelateerde lijst **Metingen**: laatprijs, biedprijs, onderliggende, buffer, resultaat en de barometerstand die eruit volgt.
- **uitkomst vastleggen** — wat de koppeling zag, de vier uitkomsten met het voorstel van het systeem, de velden om vast te leggen en wat het vastleggen in gang zet.

Gerelateerde lijsten op de positie: **Exitplan · Metingen · Uitvoeringen · Publicaties · Historie**.

**Het exitplan is een gerelateerde lijst van vier regels** (`exitregel`), geen blok velden. Tijdens de looptijd is het namelijk geen plan maar vier afspraken die ieder hun eigen stand hebben: niet geraakt, waarschuwingszone, geraakt, uitgevoerd of vervallen. Het systeem zet ze klaar zodra de tranche bestaat:

| Regel | Niveau | Waar het vandaan komt |
| --- | --- | --- |
| **Stoploss** | ask 60,0 | Vast (6) |
| **Winstanker** | 30 % van de ontvangen premie als laatprijs | 70 % van de premie verdiend |
| **Break-even** | strike − ontvangen premie | Rekenwerk |
| **Eventregel** | — | Een afspraak tussen mensen; blijft leeg tot iemand hem invult |

Verandert de ontvangen premie of de strike, dan rekent het systeem winstanker en break-even opnieuw — behalve voor een regel die al geraakt is: die hoort bij wat er toen gebeurde. **De tranche komt de stand *besluit goedgekeurd* niet uit** zolang het stoplossniveau of de eventregel ontbreekt, en de stoploss laat zich daarna wel aanscherpen maar niet verruimen.

### 10.0g Eén woord per begrip

- **status** — de toestand van een record: cyclus, positie, inzending, publicatie. Intern woord, staat in elk formulier.
- **stand** — uitsluitend de barometer richting de leden, 1 tot 5. Dat woord zien klanten; het wordt nergens anders voor gebruikt.
- **fase** — de indeling die de klant ziet (fase 1 tot 5), en waaraan de barometerschaal hangt.

Een tabel die vandaag *stand* of *fase* gebruikt voor iets interns, heet voortaan `status`.

**Wat er in de huidige opzet nog van afwijkt** (op te lossen vóór de bouw, niet erna):

| Scherm | Wat er niet klopt | Wat het wordt |
| --- | --- | --- |
| ~~Mijn voorstel · Het gesprek · Definitief oordeel · Wachten · Uitkomst~~ | *doorgevoerd* | **twee actieschermen op de cyclus**: *positie blind versturen* en *go / no-go meeting*, met de inzendingen als gerelateerde lijst op de cyclus (10.0e) |
| ~~Cyclus · Cyclus (besluiten) · Cyclus (in positie)~~ | *doorgevoerd — de boards heten nu naar het tabblad dat openstaat* | één cyclusrecord; het actieve tabblad en de fase bepalen het beeld |
| ~~Uitkomst vastleggen~~ | *doorgevoerd* | actiescherm op het `positie`-record, bereikbaar vanaf die positie en vanaf de tranchekaart |
| ~~Publicatie opstellen~~ | *doorgevoerd* | het `publicatie`-record in de stand *concept*, bereikbaar vanaf de aanleiding en vanaf de lijst *Publicaties* |
| Nieuwe instapvoorwaarde | klopt al | blijft: kindrecord aangemaakt vanaf het tabblad op de cyclus |
| Aanleidingen | stond eerst als eigen lijst in het menu | gerelateerde lijst op het procesrecord *Publicatie*; het aanleidingrecord is een kindrecord van dat proces |

**Elke tabel krijgt dezelfde behandeling.** Ook een tabel die vandaag maar één keer per maand wordt geopend — chartanalyses, metingen, handelsdagen, rollen — krijgt een gewone lijst en een gewoon record. Geen maatwerkscherm omdat een tabel klein is, en geen samengevoegd scherm omdat twee tabellen op elkaar lijken.
### 10.0h Voorwaarden bestaan één keer zelfstandig: in de standaardset

Instap- en uitstapvoorwaarden staan **niet** in het menu. Ze bestaan op twee plaatsen, met een duidelijk verschil:

- **Standaardset** (onder BEHEER) is de bibliotheek: alle voorwaarden met soort, bron, drempel, gewicht, gate, in hoeveel cycli ze gebruikt zijn en hun configuratieversie. Dit is de enige lijst waar een voorwaarde zelfstandig bestaat, en de enige plek waar je er een toevoegt of wijzigt. Een regel wordt nooit overschreven: wijzigen sluit de bestaande versie en opent een nieuwe, die geldt vanaf de volgende cyclus.
- **Op de cyclus** staan de **kopieën** van die set, als de tabbladen *Instapvoorwaarden* en *Uitstapvoorwaarden*. Daar wordt gemeten en beoordeeld. Een lopende cyclus rekent tegen de versie die bij het openen gepind is (fase 2; in fase 1 wordt er niet gerekend).

Daarmee klopt de architectuurregel weer: een kindtabel heeft geen eigen menu-ingang, en wat wél in het menu staat, staat er omdat het zelfstandig betekenis heeft.


### 10.0d Audit trail

**Alles wat gebeurt laat een regel na.** Eén tabel `audit`, append-only: geen wijzig- en geen verwijderroute, ook niet voor een beheerder. Dat is dezelfde regel als "niets wordt verwijderd" (1), maar dan voor het spoor zelf.

**Twee soorten regels in één stroom**, zodat de historie van een record één chronologisch verhaal is:

- **veldwijziging** — veld, oude waarde, nieuwe waarde. *"Gewicht 25 → 18."*
- **gebeurtenis** — een handeling die geen veld is. *"Positie blind verstuurd", "quorum gehaald", "uitkomst vastgelegd", "uitvoering geïmporteerd van Lynx", "gepubliceerd", "gerectificeerd".*

Elke regel draagt: wie, wanneer, **waarvandaan** (scherm · koppeling · regel · import), de configuratieversie die toen gold, en een volgnummer per record — een gat is daarmee zichtbaar.

**Wat wél en wat niet.** Welke velden een regel opleveren staat in de metadata: `db_field` krijgt de vlag `audit`. Bewust uit: **live marktwaarden** (bid, ask, afstand, buffer — die veranderen per seconde en zijn geen besluit) en **afgeleide waarden** (score, barometerstand, premie binnen — herberekenbaar uit de bron). Wat er wél in gaat zijn de besluiten en de instellingen: gewichten, drempels, standen, uitkomsten, publicaties. Een auditlog die alles logt is even onbruikbaar als geen auditlog.

**Waar hij staat.** Als laatste tabblad **Historie** op élk recordscherm, afgeleid net als *Mijn taken* — een nieuwe tabel krijgt zijn historie dus gratis. Daarnaast één lijst **Auditlog** onder BEHEER over alles heen, met de gewone filterbalk, om vragen te beantwoorden als *"wat is er die week aan de exitregels veranderd"*. Die lijst heeft geen knop *Nieuw*: je schrijft er niet in.

**Drie plekken met extra betekenis:**

- Op de **cyclus** een samengevoegde historie over alle onderliggende records heen — voorwaarden, besluiten, posities, publicaties. Dat is het scherm waar je een half jaar later naar teruggaat.
- Op de **inzending** geldt de blinddoek ook voor de audit: de historie van andermans inzending is niet zichtbaar vóór het quorum gehaald is. Anders lekt via de achterdeur wat vooraan is dichtgezet.
- Op de **publicatie** is de audit het bewijs: wie stelde op, wie las, wie publiceerde, om welk tijdstip.

**Reden verplicht, in de auditregel zelf.** Verandert een veld ná het versturen van een inzending, ná het vastleggen van een uitkomst of ná publicatie, dan is een reden verplicht en staat die in de regel. Zo is *waarom* onderdeel van het spoor in plaats van iets dat je achteraf moet reconstrueren.

**Datamodel erbij:**

| Tabel | Eén record is | Velden |
| --- | --- | --- |
| `audit` | Eén regel in het spoor | Volgnummer per record, brontabel, bron-id, soort (veld / gebeurtenis), veld, oude waarde, nieuwe waarde, omschrijving, reden, door wie, waarvandaan, tijdstip, configuratieversie |

### 10.0e De go/no-go loopt via de actieknop op de cyclus

De go/no-go is geen aparte schermfamilie en ook geen los record dat je uit een menu opent. Je werkt op het **cyclusrecord**: je leest de gegevens van de cyclus en haar gerelateerde lijsten — events, instapvoorwaarden, technische analyse — en de **actieknop rechtsboven** brengt je naar de stap die aan de beurt is. De knop verandert met de stap; er staat er nooit meer dan één.

**1 · Positie blind versturen.** De knop opent één scherm met precies het materiaal dat nodig is om te oordelen: de eventtijdlijn, de instapvoorwaarden zoals ze op dat moment staan en de technische analyse — alle drie alleen lezen. Onderaan kies je **go** of **no-go**. Bij *go* geef je **strike** en **expiratiedatum**; bij *no-go* is een **reden** verplicht. Versturen vergrendelt je inzending.

**Een naam verslepen ís de wijziging (5 okt 2026).** De aanwezigenkiezer slaat meteen op: de stap *Aanwezigen gekozen* vinkt af zodra er één naam rechts staat, en *waarom alleen besloten* verschijnt op hetzelfde moment als er precies één staat — dat veld stond al in de definitielaag met `toon_als = aantal(aanwezigen_ids) = 1` (0118), maar wachtte op een opslagknop. Wie het quorum zet, doet dat bewust; daar hoort geen tweede handeling achteraan.

**1b · De knop ademt met de stap.** Rechtsboven op het cyclusrecord staat altijd precies één primaire actie: die van de stap waar de cyclus nu in staat. Bij *go / no-go* is dat *Positie blind versturen*, en zodra het quorum gehaald is *Go / no-go meeting*. In fase 1 heeft de stap *instapvoorwaarden* geen eigen actieknop — er valt niets vast te klikken (4.3a). Welke knop er staat komt uit `processtap`, niet uit het scherm.

**1d · Eén knop, drie standen.** Rechtsboven staat altijd precies één actie, en die zegt wat er nú van jou verwacht wordt: *Positie blind versturen* zolang jij nog niet verstuurd hebt, *Wachten op de anderen* zodra jij klaar bent maar het quorum nog niet gehaald is, en *Go / no-go meeting* zodra het er wel is. Alle drie de labels staan op de **processtap** (`actieknop`, `actieknop_klaar`, en de knop van de volgende stap) — ook dit is definitie en geen code.

**1e · Het quorum wordt geteld wanneer er gekeken wordt, niet alleen bij het versturen.** Komt een inzending langs een andere weg binnen dan het scherm — proefdata, een herstelde regel — dan klopt het beeld daarna nog steeds: bij het openen van de go/no-go telt het systeem opnieuw en opent alsnog als het quorum er is.

**1c · De status opent het moment.** Een cyclus op *go / no-go* zetten **ís** het openen van een beoordelingsmoment: het systeem maakt het aan op het moment dat de status verandert, met de datum van vandaag. Er is geen tweede knop die hetzelfde nog eens zegt, en er bestaat geen tussentoestand waarin de cyclus in de stap staat maar er niets onder hangt. Komt er na een no-go een nieuwe ronde, dan geldt hetzelfde: de status terugzetten op *go / no-go* opent een volgend moment.

**2 · De inzendingen staan op de cyclus.** Een inzending is een kindrecord van de cyclus en verschijnt in het tabblad **Inzendingen** op het cyclusrecord — het tabblad dat eerder *Besluiten* heette. Eén regel per deelnemer per beoordelingsmoment, met moment, positie, strike, expiratie, reden en tijdstip. Zolang niet iedereen verstuurd heeft zie je **dát** er verstuurd is, niet **wát**: naam, status en tijdstip zijn open, positie, strike, expiratie en reden zijn dicht. Dat is een **leesregel op de kindtabel**, niet een schermtruc — hij geldt dus ook in de lijst, in een export en in het auditlog.

**3 · Quorum is een instelling, geen aanname.** Hoeveel inzendingen nodig zijn om door te mogen, staat als veld op de **processtap** in Procesbeheer (bijvoorbeeld *2 van 3* als iemand er niet bij kan zijn). Het staat zichtbaar in de kop van de gerelateerde lijst, zodat je ziet waaraan je toe bent. Wordt het quorum gehaald, dan gaan de inzendingen open en verandert de actieknop.

**4 · Go / no-go meeting.** De knop *Uitkomst samen bepalen* op het besluitrecord — dezelfde naam als de stap waar hij voor staat — opent hetzelfde scherm als bij het versturen — dezelfde tijdlijn, dezelfde voorwaarden, dezelfde technische analyse — maar nu met de gerelateerde lijst *Inzendingen* **open** eronder: ieders positie, strike, expiratie en reden naast elkaar.

**1a · De argumentatie hoort bij allebei.** Het veld heette *Reden bij no-go* en kwam alleen bij een no-go in beeld. Maar waarom je wél wilt schrijven is net zo goed het gesprek waard als waarom je het niet wilt: het veld heet **Argumentatie**, staat er altijd en is altijd verplicht.

**4a · Eén as voor de events en de voorstellen.** Het meetingscherm opent met de looptijd, over de volle breedte. Links een scrollbare lijst van alle events van de cyclus — datum, zwaarte, naam, behandeling — even hoog als het blok ernaast. Rechts diezelfde events op een as. De as draagt zijn eigen datumliniaal: elke vrijdag en elke laatste dag van de maand krijgt een datum, want dat zijn de dagen waarop week- en maandopties aflopen; labels die elkaar zouden raken wijken voor het maandeinde. Events krijgen géén eigen datumlabel meer — dat liep bij veertig events in elkaar over. Ze staan als punt op de as, één punt per dag met een telling als er meer dan één is, en alles wat je erover wilt weten — naam, tijdstip, soort, zwaarte, behandeling en motivering — staat in de hoverkaart. Een regel in de lijst en zijn punt op de as lichten samen op.

Vlak onder de as, op datzelfde raster, één balk per inzending: van vandaag tot de expiratie die die persoon voorstelt, met het contract erin zoals de broker het schrijft — *OESX 30OKT26 5800 PUT* — en de rechterrand precies op die datum op de as. Zo zie je in één blik welk event binnen wiens looptijd valt. Links van de balk staat, naast de naam, de inzet in procent van het kapitaal: zonder dat getal zegt de balk wel wélk contract iemand wil schrijven, maar niet voor hoeveel. Een no-go krijgt geen balk maar de regel *zou nu niets schrijven*.

**4b · De portefeuille als twee balken.** Naast elkaar, met wit ertussen. Links het beschikbare kapitaal dat het plafond toelaat — lichtgroen wat vrij is, donkergroen wat er al uitstaat over alle open tranches heen, over alle cycli. Rechts, in het lichtgrijs, de marge die er altijd moet blijven. De scheiding tussen de twee ís het plafond; daar hoeft geen streepje bij. Eronder de bedragen met hun percentage van het kapitaal. Het kapitaal komt van de broker zelf zodra het Flex-rapport de nettowaarde draagt (de secties *Net Asset Value* of *Change in NAV*); draagt het die niet, dan geldt het ingestelde bedrag en zegt het scherm dat erbij.

**4b‑1 · De balk volgt het inzetveld.** Terwijl je de inzet intikt, schuift het voorstel als derde tint in de linkerbalk mee: je ziet meteen wat dit besluit van de portefeuille zou vragen, wat er dan nog beschikbaar blijft, en of het samen met wat er al uitstaat boven het plafond uitkomt — dan vult het de linkerbalk en kleurt rood. Het getal eronder zegt wat je typte, ook als dat niet meer in de balk past. Het is een rekensom en geen oordeel: het systeem rekent op, het adviseert niet, en het houdt niets tegen.

**4c · Het materiaal staat onderaan, als gewone lijsten.** Instapvoorwaarden, uitstapvoorwaarden, technische analyse en inzendingen zijn gerelateerde lijsten in tabbladen onderaan het scherm — dezelfde kolommen, dezelfde zoekvensters en dezelfde stijl als overal, alleen zonder *Nieuw*: hier wordt gekeken, bijgewerkt wordt er op de cyclus. Daarboven staat het blok waarin de uitkomst wordt vastgelegd, zodat je eerst het materiaal passeert en dan pas beslist.

**4d · De knop staat rechtsboven.** *Uitkomst vastleggen* hoort in de actiebalk van het record, waar elke actieknop staat, niet onderaan het formulier. **4e · Vastleggen brengt je naar de cyclus.** Het besluit is daarmee af; wat je daarna wilt zien is de cyclus, met bij een go de positie die er net onder ontstaan is.

**5 · Eén uitkomst, geen tweede ronde.** De tweede inzendronde is vervallen: het gesprek beslist. Op het meetingscherm staat één blok *Uitkomst van het gesprek* — **go** of **no-go**, en bij go de **strike**, de **expiratiedatum** en de **inzet in % van het kapitaal**, met wat het gesprek veranderde en wie aanwezig waren. **Alle velden zijn verplicht**, aan beide kanten gecontroleerd: een halve uitkomst is geen uitkomst, en ook *niets* is een antwoord op wat het gesprek veranderde. De aanwezigen kies je met dezelfde tweekolommenkiezer als elders, voorgevuld met wie heeft ingestuurd. Bij een go toont het scherm meteen de contractnaam die eruit volgt. Het aantal contracten staat er niet: dat is wat de uitvoering teruggeeft, niet wat het gesprek besluit.

**6 · Daarna luistert het systeem.** Vastleggen zet de cyclus op **uitvoering ophalen**: de brokerkoppeling wacht tot de order bij Lynx verschijnt en haalt de uitvoering binnen. De koppeling leest alleen — het systeem plaatst nooit zelf een order.

**7 · Vergelijken en vastleggen.** De uitvoering wordt naast het besluit gelegd (strike, expiratie, aantal, premie). Binnen de tolerantie leg je vast; daarbuiten leg je soort en toelichting van de afwijking vast voordat de tranche als uitgevoerd geldt.

**8 · Vastleggen start de publicatie.** Zodra de tranche vastgelegd is, ontstaat de aanleiding *Positie ingenomen* en loopt het publicatieproces (9.1) vanzelf aan.

**Wat dit opruimt.** Geen beoordelingsmoment met vier standen, geen ronde 2, geen aparte go/no-go-lijst in het menu. Wat overblijft is: één cyclus, één actieknop per stap, twee actieschermen die hetzelfde beeld tonen, en één kindtabel *inzending* waarvan de zichtbaarheid door een leesregel wordt bepaald.

### 10.0a Vormtaal

Interactiemodel in de stijl van ServiceNow (lijst → record → gerelateerde lijsten, dichte tabellen, filterrij, lijsttoolbar), uitgevoerd in het eigen merkpalet. Geen ServiceNow-merk, -logo of -iconografie overnemen.

- **Applicatiebalk** over de volle breedte, `#08293D`, met beeldmerk, *Delta Blueprint · Cockpit*, zoeken, meldingen, help en de gebruiker rechts.
- **Navigatiekolom** 232 px, `#0B425F`, met een filterbalk bovenaan, drie tabbladen (alles / favorieten / geschiedenis), inklapbare groepen en een actief item op `#136289` met een linkerrand `#63808F`.
- **Werkvlak** op `#F7F6F3`; panelen wit met rand `#E8E6E1` en hoeken van 2–3 px. Kolomkoppen `#E8E6E1`, filterrij `#FAF9F6`.
- **Accent en links** `#136289`; primaire knop `#136289`, secundair wit met rand.
- **Statuskleuren:** groen `#1F5E45` op `#DCEBE2`, oranje `#8A5A12` op `#F7E7C6`, rood `#9A3227` op `#F7E0DC`.
- **Typografie** Bricolage Grotesque, met systeem-sans als terugval.
- Schermmaat van de mockups: 1440 × 960.


**WERKEN** — Operationeel dashboard · Mijn taken
**GEGEVENS** — Cycli · Posities · Chartanalyses · Eventskalender · Metingen
**VASTLEGGING** — Besluiten · Publicaties · Maandverslagen
**BEHEER** — Procesbeheer · Standaardset · Bouwstenen · Portefeuille · Publicatiesjablonen · Auditlog · Tabellen en velden · Rollen en toegang

Wat er **niet** in staat en waarom: *Instapvoorwaarden* en *Uitstapvoorwaarden* zijn kindtabellen van een cyclus — hun bibliotheek staat onder BEHEER · Standaardset (10.0h). *Go / No-Go* was een tweede ingang naar dezelfde tabel als *Besluiten* en is vervallen; de go/no-go bereik je met de actieknop op de cyclus (10.0e).

### 10.0b Processen in beeld

De applicatie kent een aantal processen die over meerdere schermen lopen. Waar dat zo is, staat dat op het scherm.

| Proces | Stappen | Waar |
| --- | --- | --- |
| De cyclus | Pre-analyse · Go/no-go · Uitvoering ophalen · In positie · Post-analyse | Cyclusstrook op het dashboard en de stappenbalk op het cyclusrecord |
| Voorwaarden bepalen | 5 (zie 4.6) | Cyclusrecord |
| Go / no-go | Voorstel · Gesprek · Definitief oordeel · Uitkomst | De vier schermen van 5.4 |
| Positie innemen | 5 (zie 6) | Scherm *Positie innemen* |
| Publicatie | Sjabloon · Opstellen · Controle · Publiceren | Scherm *Nieuwe publicatie* |

- De **cyclusstrook** op het dashboard zegt welke cyclus in welke fase staat; de **stappenbalk** op het cyclusrecord zegt welke stap aan de beurt is, en de actieknop ernaast doet die stap.
- **De stappenbalk** staat direct onder de titelbalk, altijd op dezelfde plek en met hetzelfde uiterlijk: procesnaam, "stap n van m", genummerde bollen (afgerond groen, huidig blauw, nog te doen grijs) met wie en wanneer bij afgeronde stappen. Nooit twee stappenbalken op één scherm.
- Een stappenbalk verschijnt op elk scherm dat een stap in een proces is, ook op een record — het cyclusrecord is immers de plek waar proces 4.6 zich afspeelt.
- **Voorbereiding volgens het protocol** (5.1) en **verslag afronden** (8) blijven checklists, geen stappenbalk: je doorloopt ze niet via schermen, je vinkt ze af. Dat visuele onderscheid is de helft van de duidelijkheid.

### 10.1 Twee soorten scherm, en niets daartussen

- Er is **één dashboard**, dat zich aanpast aan de fase van de gekozen cyclus. De fase is een toestand, geen navigatie.
- Een **tabel** geeft een lijst. Klik je een rij aan, dan krijg je het record met zijn gerelateerde lijsten als tabbladen (10). Verder niets: geen 360-view op een lijstscherm.
- *Posities* is dus een gewone lijst over alle cycli heen, geen dashboard. De samenhang zit op **In positie**.

### 10.1 Wat het systeem zelf weet, vraagt het niet (migratie 0117)

Een formulier dat opent met een leeg veld dat niemand ooit anders invult, is een vraag die geen vraag is. `db_field.standaard` kent daarvoor drie waarden die de worker invult in plaats van jou: `vandaag`, `nu` en `ik`.

- **`aangemaakt_door` staat overal op `ik`.** Dit veld is alleen-lezen, dus het werd ook nooit met de hand gevuld — het bleef leeg op het formulier, en pas bij het bewaren zette de worker er alsnog iets in. Je zag dus iets anders dan wat er ging gebeuren.
- **`cyclus.geopend_op` staat op `vandaag`.** De dag waarop een cyclus opengaat is de dag waarop je hem aanmaakt. Is dat een keer niet zo, dan pas je hem aan — maar een formulier hoort naar de regel te staan, niet naar de uitzondering.

De inrichtingsaudit bewaakt allebei: elke `aangemaakt_door` moet `ik` zijn, en elke standaard op een datum-, tijdstip- of verwijzingsveld moet een zijn die de worker kent. `gisteren` zou anders gewoon als tekst in het veld belanden.

### 10.1a Filteren op een kolom met twee waarden

Een zoekvak waarin je moet raden wat er mag staan is geen filter. Kolommen met
maar twee mogelijke waarden krijgen daarom in de zoekregel een **keuzelijst** in
plaats van een tekstvak:

- **Actief** (de keerzijde van `archief`): `true` / `false`.
- Elk veld van het type **ja_nee**: `ja` / `nee`.

De lege stand van zo'n keuzelijst heet `Zoeken` en betekent *allebei*, net als
een leeg zoekvak. De keuze werkt meteen, zonder de wachttijd van 300 ms die
typen wel nodig heeft.

Twee dingen die hierbij misgingen en nu vastliggen:

- Een lijst staat standaard op `archief = 0`. Kies je in de kolom **Actief** de
  waarde `false`, dan gaat die keuze **vóór** de stand van de lijst — anders
  staan beide voorwaarden er samen in en blijft het scherm leeg, wat leest als
  een kapot filter.
- Een `ja_nee`-kolom viel vroeger in de restregel 'bevat', en die zoekt in `1`
  of `0`. Zoeken op `ja` vond dan niets. De worker vertaalt `ja`/`nee` nu naar
  `= 1` en `coalesce(…, 0) = 0`.

### 10.1b ~~De werkbank — het scherm waarop je begint~~ (vervallen; app/src/werkbank.js is verwijderd)

> **Vervallen op 5 oktober 2026.** Het scherm wordt opnieuw gebouwd uit `docs/mockup-werkbank.html`: de positie monitoren, het venster en de barometer zetten, en de ledencommunicatie doen. Zie §13b.

Het dashboard laat zien hoe het ervoor staat; de werkbank zegt wat er nog moet gebeuren. Dat tweede is waarvoor je inlogt, dus de werkbank staat bovenaan in WERKEN (migratie 0108).

Drie lagen, in deze volgorde:

1. **De meter.** Eén regel, en die gaat over de leden en niet over ons: *"De leden lopen 2 dagen achter op 3 dingen."* Daarnaast de barometerstand met, als wij iets weten dat zij niet weten, het merkje **niet gemeld**.
2. **Acties.** De kaarten uit de wachtrij, dringend bovenaan, binnen één dringendheid het oudste eerst.
3. **De cyclus.** De stroom van de lopende cyclus, met de naam van de cyclus als kop — niet "Naslag". Hij staat open: hij is er om naast de kaarten te liggen, niet om opengeklikt te worden.

#### Regels waar dit scherm zich aan houdt

- **Knoppen staan alleen op een kaart.** Een scherm vol knoppen is een scherm waarop je moet zoeken wat je moet doen.
- **Geen uitleg in lopende zinnen.** Een kaart draagt zijn reden in één regel; wie meer wil weten klikt door naar het record.
- **Eén gekleurd vlak per scherm.** De achterstandsbalk draagt de kleur; de kaarten eronder zijn wit met één gekleurd label. Twee gekleurde vlakken onder elkaar lezen allebei als het belangrijkste.
- **Prioriteit is rood, amber, grijs.** Nooit groen; de proef controleert dat in de CSS.
- **De feiten gaan over de volle breedte**, de knoppen eronder rechts, en het vuilbakje rechts van de knoppen zonder omkadering. Een grijs vlak dat per kaart een andere breedte heeft omdat er een knop meer onder staat, leest als slordigheid.

#### Niet elke knop is een antwoord

| Doel | Wat het scherm doet |
|---|---|
| `publicatie` | zet een concept klaar en gaat erheen; de kaart gaat pas dicht als het bericht verstuurd is |
| `scherm` | gaat naar het scherm waar het werk gebeurt; de kaart gaat dicht als dat gedaan is |
| `afsluiten` / `splitsen` / `terug` | beantwoordt de kaart meteen |

Een knop die om een reden vraagt, krijgt die reden **op de kaart zelf**. Een venster van de browser dat je moet wegklikken is geen plek om iets te schrijven dat straks in de stroom staat.

**Waar een kaartsoort je heen stuurt staat in `werkbank.js`, niet in de definitielaag.** Dat zijn routes van déze app, en een kaartdefinitie hoort niet te weten hoe het adres van een scherm eruitziet. `scripts/proef/werkbankscherm.mjs` bewaakt wel dat élke kaartsoort met `knop1_doel = 'scherm'` ook echt ergens heen kan — een knop die niets doet merk je anders pas als die kaart voor het eerst verschijnt.

**Wat die proef verder doet**, omdat een scherm hier niet getekend kan worden: elke route die het scherm aanroept bestaat in de worker, elke `api.js`-functie die het importeert wordt ook geëxporteerd, en elk veld dat het uitleest wordt door de wachtrij ook echt meegestuurd.

### 10.1c De opsteller — één bericht, één scherm (app/src/opsteller.js)

Route `/bericht/:id`. De volgorde van het scherm is de volgorde van het werk: **wat er gebeurd is, wat wij erover schrijven, en dan pas de deur.**

De feiten staan boven de tekst en liggen vast. Ze zijn vastgelegd zoals ze waren toen het bericht werd klaargezet — verandert de positie later, dan verandert een verstuurd bericht niet mee. Alleen gevulde feiten komen erin; een regel `Strike —` maakt een bericht niet duidelijker.

**De knoppen hangen van de stand af, en het scherm biedt niets aan wat de worker zou weigeren.** Een knop tonen die niet mag en hem dan laten mislukken is erger dan hem weglaten: je had al bedacht dat je erop ging drukken.

| Stand | Wat het scherm aanbiedt |
|---|---|
| `concept` / `klaar` | bewaren, nalezen vragen, versturen |
| `nalezen`, en jij bent de lezer | vrijgeven, terugsturen (met reden) |
| `nalezen`, en jij bent het niet | niets — en één regel die zegt bij wie het ligt |
| `verstuurd` | niets; alleen wanneer en door wie |

Drie dingen die hier bewust zo zijn:

- **Elke handeling bewaart eerst.** Anders verdwijnt de laatste zin die je net typte op het moment dat je op versturen drukt, en dat is de zin waar je het langst over hebt gedaan.
- **"Nalezen vragen" gaat pas aan als er iemand gekozen is.** Een knop die alvast aanklikbaar is en dan zegt "kies eerst iemand" is een knop die liegt.
- **Er is geen wisknop.** Een bericht dat niet weg moet, laat je staan; de kaart waar het uit kwam heeft een prullenbak die zegt "gezien, en we doen niets".

### 10.1d Het barometerscherm (app/src/barometerscherm.js)

Route `/barometer/:cyclus`. Twee vragen naast elkaar in plaats van in één meter — zie §3.2g voor waarom.

**Bovenaan staat wat wij weten en wat de leden zien.** Zijn ze gelijk, dan één blok; lopen ze uiteen, dan twee, want dán is dat het nieuws en krijgt het eerste blok de nadruk.

**Het scherm kent geen enkele standnaam.** Het bouwt de schaal uit wat de API teruggeeft, en die komt uit `db_choice`. De proef controleert dat letterlijk: geen van de vijf namen mag in `barometerscherm.js` voorkomen. Hernoem je ze in beheer, dan verandert het scherm mee zonder deploy.

**Het scherm opent op wat er staat**, niet leeg — anders moet je alles opnieuw zeggen om één ding te veranderen. De knop gaat pas aan als er een stand, een venster én een reden is, én de combinatie anders is dan wat er al staat; staat hij hetzelfde, dan zegt de knop dat ("Dit is de huidige stand") in plaats van je erop te laten drukken voor een foutmelding.

**Vastleggen is niet melden.** Na het vastleggen zegt het scherm in één regel dat de leden het nog niet weten en dat daar een bericht bij hoort. Er is met opzet geen tweede knop die dat stilletjes ook doet.

Het verloop eronder komt uit de gewone lijst. Een eigen route erbij zou hetzelfde doen met een tweede stuk code dat achter kan gaan lopen.

### 10.1d-bis Een scherm dat weg is, schrijft niet meer

> **Blijft als regel.** Het scherm dat hem het hardst nodig had is weg; de proef erop staat in de tak `voor-de-herbouw` en komt terug met de nieuwe werkbank.

De werkbank peilt elke tien seconden. Klik je intussen door naar een besluit, dan tikte die klok gewoon door — en tien seconden later tekende hij zichzelf over het scherm waar je inmiddels was.

Dat zag eruit als een omleiding naar de werkbank. Het was erger: op een formulier waar je in zat te typen was je je werk kwijt.

**Elk scherm dat een timer of een luisteraar op het document zet, moet kunnen zeggen of het nog van deze wereld is.** De werkbank heeft daarvoor `leeftNog()`, dat drie dingen controleert: is dit nog het laatste bezoek (twee werkbanken mogen elkaar niet overschrijven), staat de route nog op `/werkbank`, en hangt het element nog in het document.

Die wacht staat op drie plekken, en dat is geen overdaad:

1. **Bij het afgaan van de klok** — je kunt in die tien seconden weg zijn geklikt.
2. **Na het antwoord van de server** — ook tussen de vraag en het antwoord kun je weg zijn.
3. **Vóór het tekenen** — het ophalen van de wachtrij duurt even.

De luisteraar op `visibilitychange` verwijdert zichzelf zodra het scherm niet meer leeft. Zonder dat stapelen ze op: na tien keer de werkbank openen peilen er tien tegelijk.

**Een les over de proef zelf.** De eerste versie van deze controle telde of `leeftNog` ergens in het bestand voorkwam. Toen ik het lek opzettelijk terugzette om te kijken of de proef hem ving, bleef hij groen — er stonden nog zes andere vóórkomens. De proef controleert nu dat de wacht de **eerste regel** is van de klok en van de afhandeling van het antwoord, en dat is wel aangetoond door het lek twee keer terug te zetten.

### 10.1e ~~De werkbank werkt live bij~~ (migraties 0114, 0115, vervallen)

> **Vervallen op 5 oktober 2026.** Het principe blijft — de brug is de klok, geen cron — maar de peiling hing aan de wachtrij en is mee verdwenen. Zie §13b.

**Een kaart hoort er te staan voordat jij kijkt, niet een uur later.**

De brug duwt elke verandering van de TWS-verbinding meteen door, dus de gebeurtenis bestaat binnen een seconde. Wat ontbrak was de stap daarna: de kaart ontstond pas als de cron toevallig langskwam. `neemStand()` draait nu zelf een ronde (`aanleiding: 'brug'`), en die ronde weegt alleen — de klok en de toestandsvragen horen bij een rondgang over de dag, niet bij een melding van de broker, en de brug duwt bij elke tik.

#### Er is geen cron. De brug is de klok. (migratie 0116)

De motor draaide eerst op een uurcron. Dat betekende dat een kaart die uit een toestand komt — *jouw stem ontbreekt*, *de charts zijn niet gelezen* — tot negenenvijftig minuten op zich kon laten wachten. Voor een go/no-go die nú begint is dat onbruikbaar.

Maar er draait al een klok: **de brug stuurt elke tien seconden een hartslag vanaf de VPS**, dag en nacht, ook als er niets gebeurt. Dat is precies wat de cron deed, alleen tweehonderdveertig keer zo fijn — en het is één ding minder dat stil kan vallen zonder dat iemand het merkt.

| Waarom | Wat de ronde doet | Hoe snel |
|---|---|---|
| `brug` — elke hartslag | wegen altijd; de rondgang langs kalender en toestanden hoogstens elke `motor_rondgang_seconden` | 10 seconden |
| `mens` — een schrijfactie die een toestand kan maken | toestanden en weging, zonder de kalender | meteen |
| `scherm` — een openstaande werkbank peilt toch al | zelfde als `brug` | 10 seconden |
| `cron` | alles | **staat uit** |

**`motor_rondgang_seconden` staat op 10**, gelijk aan de hartslag, dus in de praktijk gebeurt alles meteen. Hoger zetten is de knop om aan te draaien als de database het te druk krijgt — niet eerder. Een handeling van een mens doorbreekt die grens altijd: die is er juist voor het geval dat het nú moet.

**Een volledige rondgang legt altijd een `motorronde` vast**, ook als hij niets vond. Anders weet de volgende tik niet wanneer de vorige was en draait hij elke tien seconden opnieuw alles. Een kale weegronde laat alleen een spoor na als hij iets vond.

**Het vangnet is het scherm.** De brug is de klok, maar een klok die stilstaat moet iemand merken — en als jij naar de werkbank kijkt, ben jij die iemand. De peiling van `/api/wachtrij/stand` draait zelf een ronde, dus een openstaande werkbank houdt de motor draaiend ook als de brug eruit ligt.

**Wat we daarmee opgeven:** ligt álles stil — geen brug, niemand ingelogd — dan gebeurt er niets. Dat is geen verlies. Een kaart die niemand kan zien hoeft niet te bestaan, en zodra er iemand kijkt staat hij er. Het enige dat hier wél een echte klok voor nodig zal hebben is de dagelijkse mail, en die bestaat nog niet.

De `scheduled`-handler blijft in `worker/index.js` staan. Blijkt de brug ooit geen betrouwbare klok, dan is één regel in `wrangler.jsonc` genoeg om de cron weer aan te zetten.

**Zolang de brug nog niet bestaat** — het live handelsaccount is nog niet actief — is het scherm de enige klok. Alles wat uit een handeling komt werkt gewoon; wat uit de kalender komt (de week-update, het maandverslag) verschijnt pas zodra iemand de werkbank openzet. Dat is voor nu precies goed: er zijn nog geen leden die op een week-update wachten. Zodra de brug draait, draait de klok mee.

**Een toestand wacht niet op het uur.** Zet je een beoordelingsmoment op `blind inzenden` omdat het gesprek nú begint, dan hoort de kaart "jouw stem ontbreekt" er een seconde later te staan — niet over negenenvijftig minuten. Elke geslaagde schrijfactie (`PATCH`, nieuw record, samen, archiveren, en de go/no-go-knoppen) hangt daarom een korte ronde in `ctx.waitUntil`: het scherm wacht er niet op, de kaart staat er wel.

**Welke tabellen ertoe doen staat niet in de code.** `raaktEenAanleiding()` kijkt of een ingerichte `aanleiding` de gewijzigde tabel noemt. Richt iemand morgen een aanleiding in over een andere tabel, dan werkt dit vanzelf mee. Weet hij het niet zeker, dan draait hij liever een ronde te veel dan een kaart te laat: een ronde is goedkoop, een gemiste go/no-go niet.

**Het scherm peilt, het haalt niet op.** `GET /api/wachtrij/stand` geeft één merk terug: een tekst die verandert zodra er iets te zien is. Het scherm vraagt dat elke tien seconden en haalt de volle wachtrij alleen op als het merk anders is. De hele rij elke tien seconden opbouwen — met feiten, sjablonen en verwijzingen — is honderd keer zoveel werk voor een antwoord dat meestal "nee" is. Peilen gebeurt alleen als het tabblad vooraan staat, en bij terugkomst meteen in plaats van na tien seconden.

**De motor laat zien dat hij draait (0114).** Eén rij per ronde in `motorronde`, met wat hij deed en hoe lang hij erover deed. Niet in de stroom: daar hoort te staan wat er in een cyclus gebeurde, niet dat een machine elk uur zijn werk deed. Onderaan de werkbank staat één regel — *"De motor draaide 14 minuten geleden"* — die amber wordt na drie uur stilte of bij een mislukte ronde. **Een wachtrij die te leeg is ziet eruit als rust; dit is het enige waaraan je ziet dat het dat niet was.**

Niet élke ronde laat een spoor na. De brug duwt veel vaker dan er iets gebeurt, en een tabel vol lege rondes maakt juist onzichtbaar wat je zoekt. Een ronde die niets deed en op niets stuitte wordt alleen vastgelegd als de klok hem begon — want juist dán is "er gebeurde niets" het bericht.

### 10.1f ~~Een kaart heeft een eigenaar~~ (migratie 0115, vervallen)

> **Vervallen op 5 oktober 2026.** Zie §13b.

Alles stond in ieders rij. Voor het meeste klopt dat: wie als eerste tijd heeft, stelt het bericht op. Voor twee soorten niet.

**"Go/no-go: jouw stem ontbreekt" is per persoon.** Pieter zag die van Jacqueline, kon hem wegklikken, en dan was de sleutel bezet en werd zij nooit meer gevraagd — haar stem ontbrak in een besluit dat wél doorging. **Een naleeskaart** ligt bij één iemand; dat de opsteller hem ziet is niet erg, dat hij hem kan beantwoorden wel.

**Waar de eigenaar vandaan komt staat in de definitie** (`processtap.eigenaar_bron`): van ons samen, wie de aanleiding aanwijst, of de nalezer van het bericht. De drie manieren om hem op te zoeken staan in code; de keuze staat in beheer.

**Niemand is een geldig antwoord, en het is de standaard.** Het meeste werk is van ons samen, en een kaart die van niemand is, is van ons allemaal — die staat dus ook onder "van mij". Werk van een ander wegfilteren zou de wachtrij leeg laten lijken.

De werkbank staat standaard op **Van mij**, met **Alles** ernaast; die keuze onthoudt de browser, want het is een voorkeur van wie kijkt. Een kaart van een ander staat er wel — je mag zien wat er bij je collega ligt — maar met zijn naam erop en de knoppen uit. De worker weigert het antwoord ook, want een slot dat alleen op het scherm zit is geen slot.

### 10.2 Het operationele dashboard

Eén scherm met vier toestanden, dat je door het proces begeleidt.

- **Cyclusstrook** bovenaan: een **horizontale scroller** (zoals het kiezen van een expiratie bij Lynx) met de afgesloten cycli als compacte chips met hun resultaat, en rechts daarvan de hoogstens ééne open cyclus, gemarkeerd en met zijn fase. De strook is links uitgelijnd en begint bij de oudste cyclus; bij het openen scrolt hij automatisch naar de cyclus die in beeld is, zodat die altijd zichtbaar staat. Daarnaast *+ nieuwe cyclus*: uitgeschakeld zolang er een cyclus loopt, met de reden “kan pas als … is afgesloten — cycli overlappen niet”. De strook is er ook als er niets loopt; de lijst met stand is het beginpunt, niet een lege-toestandmelding.
- **De eventstijdslijn staat bovenaan, over de volle breedte.** Direct onder de cyclusstrook en boven de kengetallen, in elke toestand waarin de cyclus events heeft. Hij is **gekoppeld aan de gekozen cyclus**: kies je een andere cyclus in de strook, dan springt het venster van de tijdslijn mee naar de looptijd van die cyclus. Op de tijdslijn staat per gebeurtenis de datum, wat de behandeling is, en het **gewicht** als pil — *zwaar*, *middel* of *licht* — zodat je in één blik ziet welke gebeurtenis het beeld kan kantelen en welke ruis is. Expiraties staan er als open blokje tussen; die dragen geen gewicht.
- **De tranches liggen als banen onder de tijdslijn.** Onder de gebeurtenissen loopt per open tranche een balk over dezelfde tijdschaal, van instap tot expiratie, met het contract en het aantal erin. Begint een tranche vóór het venster, dan is de balk aan die kant open. De verticale **nu-lijn** snijdt door alle banen heen, zodat je in één beeld ziet welke gebeurtenis nog vóór welke expiratie valt en welke tranches erdoor geraakt worden. Daarmee vervalt de tekst per gebeurtenis over welke tranche hij raakt — dat leest de overlap nu zelf.
- **Geen begeleidingsband.** Er stond eerst een band met “volgende stap” boven het dashboard. Die is vervallen: hij herhaalde wat de stappenbalk op het onderliggende record al zegt en wat in *Mijn taken* staat, en hij dwong het dashboard in één verhaallijn terwijl het beeld zelf al toont waar het knelt. Begeleiding zit nu waar de handeling zit — in de stappenbalk op het record, in de knoppenrij en in Mijn taken.
- **Splitsing twee derde / één derde.** Links het interne beeld voor de co-founders, rechts vast in beeld **wat de klant ziet**: de barometer zoals de leden hem in de mobiele app zien, met de schaal van die fase, een eventueel voorstel van het systeem om de stand bij te werken, en wat er over deze cyclus is uitgegaan. Geen schakelaar — beide altijd zichtbaar, zodat niemand vergeet dat er een buitenkant is.
- **Inzendingen zijn een gerelateerde lijst op de cyclus.** Een inzending is een kindrecord van de cyclus met deelnemer, positie (go/no-go), strike, expiratie, reden en tijdstip. Één lijst, één keer, met de standaard related-list-opmaak; de zichtbaarheid van de inhoud volgt uit de leesregel, niet uit het scherm.
- **Inzendingen en uitkomst staan op de cyclus.** Op de cyclus is er één tabblad *Inzendingen*: één regel per deelnemer per beoordelingsmoment, met positie, strike, expiratie en reden. De uitkomst van het gesprek is geen aparte tabel maar de vastgelegde uitkomst van dat moment — één go of no-go, met de positie die eruit volgt.
- **Een tranche kent zijn voorgangers.** Het goedgekeurde besluit op het scherm *Positie innemen* zegt **welke tranche** dit is en voor **welk percentage van de marge** — met de tranches die al lopen eronder en het totaal na uitvoering. Elke volgende tranche doorloopt opnieuw het hele go/no-go-proces, en bij dat besluit staat dus al in beeld waarmee we in de markt staan, zodat het percentage daarop wordt aangepast in plaats van op een leeg blad. Het exitplan en de portefeuilletoets staan er niet nog eens bij: de stappenbalk zegt al dat het exitplan vastligt, en de sizing wordt bij het besluit zelf getoetst.
- **De marge staat zoals de broker hem toont.** Op *Positie innemen* staat de inzet in het format van Lynx: de rijen **initial margin**, **maintenance margin**, **available funds** en het aandeel van het kapitaal, met de kolommen **current · change · post-trade**. Current is wat er nu staat, change is wat deze tranche toevoegt, post-trade is de stand erna. Zo lees je hetzelfde getal als in de brokerinterface en hoef je niet te vertalen; available funds loopt de andere kant op en draagt daarom de tegengestelde kleur.
- **Van uitkomst naar positie.** *Positie innemen* komt pas beschikbaar als de uitkomst is vastgelegd **en** die uitkomst drie go’s is; tot dan is die knop er niet. Daarna gaat het in deze volgorde: exitplan vastleggen, de order met de hand bij Lynx plaatsen, en de uitvoering **importeren** uit de brokerkoppeling. De koppeling leest alleen — het systeem plaatst nooit zelf een order. Wat binnenkomt wordt naast het besluit gelegd en een afwijking buiten de tolerantie wordt met soort en toelichting vastgelegd voordat de tranche als uitgevoerd geldt.
- **Er is geen ronde 2.** De tweede inzendronde is vervallen; het gesprek beslist en legt één uitkomst vast op de cyclus. Wat iemand tijdens het gesprek van mening deed veranderen, staat in het veld *wat het gesprek veranderde* — niet in een tweede inzending.
- **De actieknoppen volgen de processtap.** Rechtsboven staat **alleen de actie van de stap waar je nu in zit**. Acties van latere stappen staan er niet — ook niet grijs of vergrendeld: een knop die je niet kunt indrukken voegt niets toe en maakt de rij onleesbaar. Acties van stappen die gedaan zijn verdwijnen. Waar je in het proces zit en wat er nog komt, leest de stappenbalk eronder; de knoppenrij is voor doen, niet voor uitleggen. Zit de handeling zelf al als knop in het formulier (versturen, vastleggen), dan herhaalt de titelrij hem niet en toont ze alleen de vergrendelde volgende stap. Welke knop waar staat, komt daarmee uit `processtap`, niet uit het scherm: verandert het proces in Procesbeheer, dan verandert de knoppenrij mee. *Opslaan* staat er altijd als secundaire knop.
- **De stappenbalk hoort bij het record van het proces dat hij beschrijft.** Op de cyclus staat alleen **DE CYCLUS** (aanmaken → standaardset → voorwaarden → events → analysemoment). Twee balken op één scherm betekent dat je op de verkeerde plek werkt.
- **Een aanmaakformulier van een kindrecord draagt geen stappenbalk.** Een instap- of uitstapvoorwaarde maak je aan vanaf de gerelateerde lijst op de cyclus. Dat is één handeling binnen de stap *voorwaarden* van het cyclusproces, geen eigen proces: het proces loopt op de cyclus, en daar staat de balk. Het formulier begint dus meteen bij het eerste veld.
- **Eén knop per scherm, en die staat rechtsboven.** Acties staan altijd op dezelfde plek: rechts in de titelrij. De cyclusstrook heeft geen eigen knop; loopt er een cyclus, dan staat rechts in de strook alleen de regel “cycli overlappen niet — eerst … afsluiten”, zonder knop. *Nieuwe cyclus openen* bestaat daardoor alleen op het moment dat het mag, op één plek. Op het cyclusrecord is die ene knop de actie van de lopende processtap: *Positie blind versturen*, en zodra het quorum gehaald is *Go / no-go meeting*.
- **Eén cyclus per scherm.** De gekozen cyclus is het onderwerp; gegevens over andere cycli staan er niet bij. Overzichten over meerdere cycli horen in *Cycli* en in de post-analyse van het jaar, niet in het beeld van één cyclus.
- **Resultaat altijd in kleurcode.** Overal waar een resultaat in punten staat — in de strook, in de lijsten, in de staafgrafiek — is een plus **groen** en een min **rood**. De kleur is afgeleid van het teken, niet apart ingevoerd. De selectie in de strook is daarom een **omlijning**, geen gevulde vlak: anders zou de kleurcode op de gekozen cyclus wegvallen.
- **Een afgesloten cyclus kiezen toont altijd zijn eigen post-analyse — ook als er een cyclus loopt.** Elke afgesloten stand in de strook is een link naar de post-analyse van díé cyclus, alleen lezen. Loopt er intussen een cyclus, dan blijft die als laatste chip **vast rechts** in de strook staan en schuift hij nooit uit beeld; boven het beeld staat één regel dat je terugkijkt en hoe je terug bent bij de lopende cyclus. De lopende chip is zelf ook een link, naar het dashboard van de fase waar die cyclus in zit. Terugkijken verandert dus nooit wat er loopt.
- **Een afgesloten cyclus kiezen toont zijn post-analyse.** De strook is geen filter op een lijst maar de keuze van het onderwerp van het scherm. Kies je een afgesloten cyclus, dan staat de post-analyse van die cyclus er: resultaat, uitkomst per tranche met doorklik naar de positie, en het verslag. Rechts staat wat de klant destijds zag, met de **laatst gepubliceerde stand**, grijs en stil — de meter loopt niet door tussen twee cycli en de volgende cyclus begint met een eigen stand.
- **Uitkomst vastleggen is een status van het positierecord** (10.0f). Bereikbaar vanaf de tranche zodra de koppeling een wijziging ziet: bovenaan wat er bij Lynx gelezen is, daaronder de vier uitkomsten met het voorstel al aangevinkt, links de velden om vast te leggen en rechts wat het vastleggen in gang zet. De knop heet *Vastleggen en publicatie opstellen*, want die twee horen bij elkaar.
- **Vijf toestanden:** afgesloten cyclus in beeld terwijl er niets loopt, pre-analyse, in positie, post-analyse, en afgesloten cyclus terugkijken terwijl er één loopt (alleen lezen). De vierde is de cyclus die nog open staat terwijl het verslag geschreven wordt; pas als die sluit, kan *nieuwe cyclus*.
- **Er is geen lege toestand.** Loopt er niets, dan staat de laatst afgesloten cyclus in beeld met zijn post-analyse, en daaronder één kaart met de vijf stappen die volgen na *nieuwe cyclus openen*. “Er staat geen cyclus open” wordt nergens als melding getoond: de strook met de standen is zelf het beginpunt.

Er is geen aparte publicatiecockpit meer: wat over één cyclus naar buiten gaat staat in de rechterkolom van het dashboard, de sjablonen staan onder BEHEER, en *Publicaties* blijft de gewone lijst.

| Toestand | Beantwoordt | Het interne beeld bevat |
| --- | --- | --- |
| **Pre-analyse** | Mogen we instappen, en waarop wachten we? | Score met configuratieversie, Tier-1, harde gates, volgend analysemoment, vrije ruimte in de portefeuille; instapvoorwaarden met de afstand tot hun drempel; de lijst met zwaarte en behandeling; stand van de technische analyse; de eerdere go/no-go-momenten van deze cyclus; de protocol-checklist |
| **In positie** | Hoe veilig staan we, gemeten tegen de exitregels? | Keten netto, **premie binnen** (welk deel van de ontvangen premie al verdiend is over de open tranches), dichtstbijzijnde drempel, kleinste buffer, dagen tot expiratie; per tranche de tranchekaart hieronder beschreven; wat er nog aankomt; portefeuille en staartrisico; meldingen en wat de leden zien |
| **Post-analyse** | Hoe hebben we het gedaan, en klopten onze voorwaarden? | Gerealiseerd resultaat in punten én euro's, positief afgesloten, doorlooptijd, kleinste buffer ooit, afwijkingen bij uitvoering; resultaat per cyclus als staafdiagram; toetsing per instapvoorwaarde over alle afgesloten cycli; besluitvorming per persoon met de schaduwevaluatie van de no-go's; de status van het lopende verslag; de afgesloten cycli, uitklapbaar naar de tranches met hun eigen uitkomst |

De **tranchekaart** in de toestand *in positie* is de kern van dat beeld. **Elke tranche heeft een eigen kader** — niet twee rijen in één lijst, want een tranche is een op zichzelf staande positie met een eigen besluit, eigen prijs en een eigen exitplan. Er is dus ook geen gezamenlijke kopregel meer boven de tranches. Per kader staat er:

- **Kop**: contract, expiratie, aantal contracten, afstand tot de markt en — bij de tranche die de barometer bepaalt — de blauwe pil **bepaalt barometer**. Géén groen/oranje/rood-badge op de tranche zelf: de balk eronder en de exitlijst zeggen al waar hij staat, en een kleurlabel erbij zou de aandacht wegtrekken van de pil die er wél toe doet. De pil staat alleen op die tranche zelf en niet als legenda in de kopregel: hij spreekt voor zich, en een tweede exemplaar bovenaan zou suggereren dat er iets te kiezen valt.
- **Alle cijfers in één blok rechts.** Links staat alleen wát de positie is (contract, expiratie, contracten, afstand, en de pil als hij de barometer bepaalt). Rechts staan in één rij drie neutrale getallen: **verkocht** (wat we ontvingen, zonder kleur — het is een feit, geen uitkomst) en **bid** en **ask** in twee neutrale vakjes zoals bij de broker. Zo lees je in één oogopslag wat er binnenkwam en wat het nu doet. Er is **geen aparte premiebalk**: die deed met een eigen nullijn en een eigen schaal hetzelfde werk als de gezondheidsbalk eronder, en twee balken met twee nulpunten is er één te veel. Het resultaat staat in plaats daarvan als **P&L** bij de markering (zie hieronder). Bid en ask dragen elk een klein, stil hartslagje naast het cijfer: dat markeert precies de twee getallen die live meelopen met de brokerkoppeling, zonder te pulseren of aandacht te trekken. De cijfers zelf staan klein en halfvet — ze zijn naslag, niet de kop van het scherm. Geen kleurcodering op de vakjes, geen ordergroottes en geen los spreadoordeel — de twee prijzen naast elkaar láten de spread al zien.
- **De gezondheidsbalk**: één schaal per tranche met de huidige prijs als markering. De drie ijkpunten zijn **niet generiek maar afgeleid uit de uitstapvoorwaarden van die tranche**, met hun concrete niveau erbij: *stop loss · ask 60,0*, *break-even · ask 18,0*, *winstanker 70 % · ask 5,4*. De balk loopt **van verlies links naar winst rechts**. Boven de markering staat op dezelfde plek het resultaat: *P&L: − 16 %*, met het label in zwart en niet vet en alleen het getal in de kleur van het teken — het getal hoort bij de streep en concurreert niet met de prijzen rechts. Zo lees je stand èn resultaat op één punt, in één leesrichting. De ask daalt dus naar rechts, wat klopt — een geschreven optie die goedkoper wordt is winst.
- **De ijkpunten staan op vaste posities, zodat de balken vergelijkbaar zijn.** Stoploss, de grens op ask 50, break-even en het winstanker staan op elke tranchebalk op dezelfde plek, met **break-even in het midden**. Binnen elk vak wordt lineair geïnterpoleerd, dus de markering beweegt vloeiend mee met de ask. Zo tonen twee tranches met verschillende premies dezelfde zonebreedtes en kun je ze naast elkaar lezen zonder eerst de schaal te ijken — wat bij een doorlopende prijsschaal juist niet lukt, omdat elke premie dan een andere verdeling geeft. Tussen de zones staat een haarfijne witruimte, zodat de overgang van licht naar donker oranje zichtbaar is zonder een lijn te tekenen. **Alle drie staan als ask-niveau**, want dat is de prijs waartegen je er werkelijk uit komt en het getal dat de regels toetsen: de stoploss is altijd ask 60,0, het winstanker is de ask op 30 % van de ontvangen premie, en break-even is de ask gelijk aan wat je ontving. Ook de markering op de balk is de actuele ask, niet de middenprijs — anders zou het scherm een gunstiger beeld geven dan de markt. De markering draagt geen eigen label: het getal staat al in het ask-vakje rechts, en een tweede keer op de balk maakt hem alleen drukker.
- **De zones óp de balk zíjn de barometerstanden.** De gezondheidsbalk is verdeeld in precies de vijf standen van de fase *in positie*, met hun naam er zacht in gezet, plus een smal rood stuk voorbij de stoploss:

| Zone | Van | Tot | Stand |
| --- | --- | --- | --- |
| voorbij de grens | — | stop loss (ask 60) | de positie hoort gesloten te zijn |
| onder druk | stop loss | ask 50 | **1 · onder druk** |
| krap | ask 50 | break-even | **2 · krap** |
| ruim | break-even | de helft van de premie binnen | **3 · ruim** |
| comfortabel | helft binnen | winstanker (70 % binnen) | **4 · comfortabel** |
| afgerond | voorbij het winstanker | — | **5 · vrijwel afgerond** |

Daarmee is de barometer geen apart rekenwerk meer: de stand die het systeem voorstelt is de zone waarin de markering van de **zwakste tranche** staat, en iedereen kan op het scherm zien waarom. De grenzen zijn instellingen in de standaardset, net als de stoploss zelf.
- **Een waarschuwingszone vóór de stoploss.** Tussen de stoploss en break-even is de balk in twee tinten verdeeld: dieper oranje van de stoploss tot **ask 50,0**, lichter vanaf daar tot break-even. Die grens staat niet in tekst op het scherm — hij hoeft niet gelezen te worden, alleen gezien. Het is het punt waarop de positie de aandacht verdient vóórdat de harde grens in zicht komt, en het is ook de logische **drempel voor de barometer** om een stand te laten zakken: een tranche die de diepe zone binnenloopt is precies het geval waarin de leden een bijgestelde stand horen te zien. Het niveau is een instelling in de standaardset, net als de stoploss zelf.
- **De koers staat er als bid/ask, zoals bij de broker.** Twee neutrale vakjes naast elkaar met BID en ASK erboven, daarnaast en een hartslagje dat aangeeft dat ze live meelopen met de brokerkoppeling. Geen kleurcodering op de vakjes, geen ordergroottes eronder en geen los spreadoordeel: de twee prijzen naast elkaar láten de spread al zien, en alles wat daar nog bij komt is ruis. De ask is bovendien het getal waar de stoploss tegen gemeten wordt, dus hij hoort hier zichtbaar te zijn.

Daarmee is "hoe veilig staan we" één blik, in plaats van een rekensom uit vier kolommen. Er staat geen aparte tabel met exitvoorwaarden meer onder: die herhaalde precies wat de balk en de ijkpunten al tonen. De volledige lijst met uitstapvoorwaarden blijft op de cyclus staan, in haar eigen tabblad.

### 10.0c Vaste componenten — niet per scherm opnieuw bedenken

De applicatie kent een klein aantal **vaste componenten**. Wie een scherm bouwt kiest daaruit; er wordt niet per scherm een eigen tabel of een eigen kaartje uitgevonden, ook niet als dat mooier oogt. Consistentie gaat vóór vormgeving, want het scherm moet leesbaar zijn voor iemand die het voor het eerst ziet.

**De lijst** (één vorm voor elke tabel, zoals *Posities*):

- **Werkbalk**: menu-icoon, naam van de tabel, de acties van de lijst, het woord *Zoeken* met een kolomkeuze en een zoekveld, en rechts de paginateller (“1 tot 50 van 70”) met knoppen om te bladeren. De **kolomkeuze stuurt waar gezocht wordt**: *Alle velden* zoekt over de hele regel, een gekozen kolom zet de tekst als filter op die kolom — hetzelfde filter dat ook in de filterrij verschijnt, zodat er maar één waarheid is.
- **Filterbalk**: trechtericoon, *Alle*, de actieve voorwaarden als chips, *+ voorwaarde*, en rechts ruimte voor één toelichtende zin.
- **Kolomkop**: grijze balk met selectievakje, zoekicoon, en per kolom een greepje, de kolomnaam in kleinkapitaal en een sorteerpijl op de gesorteerde kolom.
- **Filterrij**: per kolom een smal invoerveld met *Zoeken*. Het zoeken is **vergevingsgezind**: overal geldt *bevat*, niet *is precies*. Zoeken op `7` vindt dus ook `70`, zoeken op een datum begrijpt `jul`, `202607` en `6/7/2026`, een keuze wordt op haar label gezocht en een verwijzing op de **naam** waar ze heen wijst — niet op het nummer dat eronder zit. Een gerelateerde lijst bouwt dezelfde filterchips op als een gewone lijst; alleen het ouderfilter blijft buiten beeld, want dat is de lijst zelf.
- **Een record heet naar wat het is, niet naar zijn nummer.** Is het titelveld een verwijzing, dan draagt het record de naam waar die heen wijst. Een verwijzing op het formulier toont diezelfde naam: naar een persoon kies je uit de deelnemers, en een verwijzing die vastligt zodra het record bestaat staat er alleen-lezen.
- **De breadcrumb is de navigatie terug; er staat geen terugknop meer.** Een knop *Terug naar …* zei hetzelfde als de kruimel ernaast en nam plaats in de actiebalk in, waar alleen hoort wat je met dít record doet. Hij is overal weg.
- **De kruimel van de gerelateerde lijst waar je uit komt, is geen link.** Sta je op een besluit dat je vanaf de cyclus opende, dan leest de breadcrumb *Cycli › 2026-11 › Besluiten › 2 okt 2026*, maar *Besluiten* is tekst: je staat er al, en die lijst heeft buiten die cyclus geen betekenis. Zonder ouder — rechtstreeks uit het menu — is dezelfde kruimel wél een link naar het volledige bestand.
- **Een tabel staat in het menu als ze over haar ouders heen te lezen is.** Omdat de terugknop weg is en de lijstkruimel niet klikt, kwamen voorwaarden, inzendingen, besluiten, processtappen en handelsdagen erbij: *alle inzendingen van dit kwartaal* of *alle voorwaarden die rood stonden* is een vraag die je stelt zonder eerst een cyclus te kiezen. **Events in de looptijd en exitplannen niet**: de behandeling van één event binnen één cyclus zegt buiten die cyclus niets — je leest *vermijden* zonder te zien waarvan — en een exitregel hoort bij één tranche. Die blijven tabblad waar ze betekenis hebben. Via het menu krijg je het hele bestand, via een record de lijst van dat record.
- **Een verwijzing die geen ouderschap is, levert geen tabblad op** (`db_field.geen_lijst`). Een inzending draagt zowel het beoordelingsmoment als de cyclus, zodat je zonder omweg kunt filteren — maar ze hangt aan het moment. Zonder die vlag stonden de inzendingen ook onder de cyclus, waar ze niets toevoegen.
- **De breadcrumb draagt zijn filter mee.** Kom je via een cyclus bij een voorwaarde, dan toont *Voorwaarden* in de breadcrumb de voorwaarden van díé cyclus, niet die van alle cycli: de kruimel linkt naar `?fid.<ouderkolom>=<id>` en de lijst opent met dat filter als chip (*Cyclus = 2026-10*). Dat filter is weg te klikken — dan sta je in de volledige lijst — behalve in een gerelateerde lijst, want daar ís het ouderfilter de lijst.
- **Twee soorten filter, en het verschil is bewust.** `f.<kolom>` is wat iemand intypt: vergevingsgezind, *bevat*. `fid.<kolom>` is een vast filter op één verwezen record: precies dat nummer. Een gerelateerde lijst en de breadcrumb gebruiken de tweede soort, zodat 'cyclus 3' nooit per ongeluk cyclus 13 meeneemt.
- **Een regel die een tweede veld eist, blokkeert geen cel.** In de lijst bewerk je één cel tegelijk; een blokkerende regel die een ánder veld verplicht stelt, maakt bewerken dan onmogelijk. Zulke regels zijn **waarschuwingen**: ze verschijnen als melding in het scherm — nooit in een venster van de browser — en de wijziging wordt bewaard. Wat echt niet mag (een verstuurde inzending wijzigen, opslaan op een verouderde revisie) blokkeert wél.
- **Een verwijzing toont een naam, nooit een nummer.** De lijst haalt de titels van de verwezen records in één vraag per kolom op. Stond er een nummer, dan is dat een fout en geen bedoeling.
- **Rijen**: de cellen, zonder selectievakje of info-icoon — die leidden nergens heen. De eerste kolom is een link naar het record; een rij die aandacht vraagt krijgt een zachte gele achtergrond. Dubbelklikken op een cel bewerkt haar ter plekke.
- **Het systeem vraagt niet om wat het zelf al weet.** Een verplicht veld dat niet op het aanmaakformulier staat en in de database een standaardwaarde heeft, wordt bij het aanmaken aan de database overgelaten. Alleen wanneer er werkelijk niets is om op terug te vallen — zoals de verwijzing naar de ouder — volgt de melding *X is verplicht*.
- **Een sectie kan nadruk krijgen** (`db_sectie.accent`): een blauwe rand links, een lichte achtergrond en grotere waarden. Op het positieformulier draagt *Het besluit* die nadruk, want daar komt de hele tranche uit voort.
- **Een invoerveld is zo breed als wat erin komt.** Een datum krijgt 180 pixels, een getal 160, een keuzelijst 320, een tekstveld 360 en een lang veld 560 — niet de volle breedte van de kolom. Een vak van duizend pixels voor tien tekens leest als een fout in de opmaak, en het oog moet onnodig ver tussen label en waarde.
- **Waar een veld staat, zegt de definitielaag.** `db_field.kolom_rechts` bepaalt de kolom; de volgorde binnen een kolom komt uit `db_field.volgorde`, en het aanmaakformulier gebruikt dezelfde volgorde als het record. Zegt geen enkel veld van een tabel iets over zijn kolom, dan vult het formulier om en om links en rechts en staat **de status op de tweede regel links** — dan is hij op elk scherm op dezelfde plaats te vinden in plaats van te moeten zoeken.
- **Kolombreedte wordt gemeten, niet geraden.** De breedte volgt uit de breedste van twee dingen: de kolomkop (een kop die halverwege afbreekt is onleesbaar) en de getoonde waarden, met ruimte voor wat erbij hoort — de badge van een keuze, de avatar bij een persoon, de zoneafkorting bij een tijd. `db_field.breedte` is daarbij de **ondergrens**, niet de uitkomst; er geldt een minimum van 92 en een maximum van 360 pixels. Wat iemand zelf versleept wint van alles en wordt per persoon onthouden in `gebruiker_voorkeur` — dat is een voorkeur, geen eigenschap van de gegevens.
- **Nieuw vanuit de lijst** staat in de werkbalk, maar alleen waar het mag: `db_table.nieuw_vanuit_lijst` zegt per tabel of een record zonder ouder gemaakt kan worden. Dat staat aan voor de zelfstandige tabellen (cycli, events) en uit voor kindtabellen — die worden gemaakt vanaf hun ouder (regel 10.0). Of het knopje er staat is dus definitie, geen code.

**Waar een actieknop staat.** Dit onderscheid is bindend, want het zegt waar je moet kijken:

| Soort scherm | Waar de actie staat |
| --- | --- |
| **Lijst** | in de **werkbalk van de lijst**, direct naast de naam van de tabel (*Nieuw*, *Inlezen uit document*) |
| **Record** | **rechtsboven in de recordbalk**, naast de naam van het record (*Opslaan*, *Terug naar …*, *Bijlage*) |
| **Gerelateerde lijst** | in de kop van die lijst, rechts (*Nieuw*, met de ouder al ingevuld) |

De vorm van de knop is overal dezelfde — één hoogte, één stijl, primair donkerblauw en secundair wit. Alleen de plaats verschilt, en die volgt uit het soort scherm. Een lijst heeft geen recordbalk, dus daar hoort de actie in de werkbalk; een record heeft er een, dus daar hoort hij rechtsboven.

**De gerelateerde lijst** (één vorm voor elk recordscherm, zoals op de cyclus). Hier moet in één oogopslag te zien zijn welke lijsten aan dit record hangen, in welke je staat, en hoeveel regels erin zitten:

- **Tabbladen** op een eigen grijze strook boven het paneel, met per tab een teller in een pil. Het actieve tabblad is wit, vet, draagt een blauwe streep bovenaan en zijn teller is blauw; de strook sluit naadloos aan op het witte paneel eronder.
- **Nieuw staat er alleen als er iets te maken valt.** Op de cyclus verschijnt *Nieuw* bij **Posities** pas zodra er een beoordelingsmoment met een vastgelegde **go** ligt: zonder goedgekeurd besluit bestaat er geen tranche om in te nemen, en een knop die suggereert van wel nodigt uit tot een positie zonder besluit. Bij **Exitplan** staat hij nooit: die vier regels zet het systeem klaar bij het aanmaken van de tranche.
- **Paneelkop**: de naam van de lijst één keer — niet nog eens klein herhaald onder het tabblad dat hem al toont — met daarnaast de knop voor de actie van die lijst (*Nieuw*, met de ouder al ingevuld). Staat er maar één gerelateerde lijst en dus geen tabbalk, dan staat de teller wél in de kop.
- **Lege lijst**: *Nog geen voorwaarden* zolang er niet gezocht wordt. Het ouderfilter van een gerelateerde lijst is geen zoekopdracht van de gebruiker en levert dus niet de melding *geen regels die hieraan voldoen*.
- **Tabel** met **selectievakjes**: in een gerelateerde lijst maak je records aan, dus daar ruim je een vergissing ook op. Zijn er regels aangevinkt, dan verschijnt naast *Nieuw* een prullenbakje. Dat **archiveert** meteen: de regel verdwijnt uit de lijst en blijft bestaan, met wie hem weghaalde in de audit trail. Er wordt niet om bevestiging gevraagd — je hebt al aangevinkt en geklikt, en er gaat niets verloren. Verwijderen bestaat niet (hard uitgangspunt 1), en het woord wordt in de applicatie dus ook niet gebruikt. Een **verstuurde inzending** is niet te archiveren: is het moment zelf verkeerd, dan archiveer je het beoordelingsmoment. De selectievakjes staan in **elke** lijst, ook in het volledige bestand: een eventskalender van zeventig regels maak je niet op een ouderrecord aan, en opruimen moet daar net zo goed kunnen. De teller *n aangevinkt* staat in de werkbalk.

Beide componenten staan als functie in de gedeelde laag. Een nieuw scherm roept die aan en geeft alleen kolommen en rijen mee.

- **De procesbalk draagt zijn stappen.** Onder elke fase staan de stappen van díé fase, in dezelfde kolom als de chevron erboven. De fase waarin het record staat draagt de kleur en leest zwart; de fasen ervoor en erna staan gedoofd maar zijn leesbaar — zo zie je wat er al gebeurd is en wat er nog komt zonder van scherm te wisselen. Een stapnaam is kort; de toelichting eronder is vervallen, want vier regels grijze tekst leest niemand twee keer. Een stap die de fase niet tegenhoudt draagt een gestippeld rondje in plaats van het woord *(mag later)*, en de stand van een telling (*3 van 3*) staat achter de naam. Niets is aan te vinken: elke stap vinkt zichzelf af zodra het gedaan is.
- Drie zones: navigatiekolom links, breadcrumb bovenaan, inhoud daaronder. De navigatie leest `db_module`.
- **De navigatiekolom is een navigator, geen lijstje links.** Bovenaan een **filterveld**: typen zoekt in de naam van de module én van haar groep, laat alleen wat past staan en klapt alles open zolang je typt; Escape maakt het veld leeg. Daaronder per groep een **kop die je open- en dichtklapt** met de modules eronder. Wat iemand dichtlaat staan wordt per persoon onthouden in `gebruiker_voorkeur` (`menu.dicht`). Welke groepen en modules er zijn, blijft `db_module` — dit gaat alleen over hoe ze getoond worden.
- **De navigator heeft drie tabbladen: Alles, Favorieten en Geschiedenis.** Het filterveld en de groepen hierboven zijn het tabblad *Alles*. De twee andere lossen hetzelfde op als het menu niet oplost: het menu toont wat er ís, niet waar jij elke dag bent.

#### 10.3a Favorieten

- **Een favoriet is een bewaarde plek, geen tweede menu.** Hij draagt de hele staat van de URL: de tabel, het filter, de sortering en de zoekterm. *Cycli waar ik op wacht* of *Mijn open tranches* is daarmee een favoriet en geen nieuwe module in `db_module` — de inrichting van het menu blijft van de beheerder, de favorieten zijn van de gebruiker.
- **Drie plekken om er een te maken, en ze delen hun staat.** Een sterretje verschijnt als je over een **menu-item** zweeft; een sterretje staat in **elke lijstregel**, zodat je één cyclus of één tranche kunt vastzetten; en het **plusje** in het tabblad Favorieten bewaart de pagina waar je op staat. Een sterretje dat gevuld is, is al favoriet — klikken haalt hem er weer af. Alle drie lezen ze uit dezelfde kaart van route naar favoriet, zodat ze nooit uit elkaar lopen.
- **Je maakt er een met het plusje in het tabblad Favorieten**, terwijl je op de lijst of het record staat dat je wilt bewaren. De route komt uit de adresbalk, dus het filter en de sortering gaan mee; de naam wordt voorgesteld uit de titel van het scherm en is te overschrijven. Het potlood ernaast opent het inrichtingsscherm.
- **Bewerken doe je in één scherm** (`#/favorieten`): links je favorieten in hun volgorde, rechts de gekozen favoriet met naam, bestemming, een kleur uit negen en een icoon uit dertig. De kleur en het icoon staan voor de leesbaarheid in de lijst, niet voor decoratie: je herkent een favoriet aan zijn vorm voor je zijn naam leest. Verder: verwijderen, en slepen om de volgorde te veranderen.
- **Per persoon, serverzijdig bewaard**, zodat je favorieten meekomen op een andere computer. Tabel `favoriet`: gebruiker, label, route, kleur, icoon, volgorde. Geen gedeelde of opgelegde favorieten — dat is wat het menu al doet. **Weghalen is hier wél verwijderen.** Een favoriet legt niets vast over een cyclus, een besluit of een positie — hij zegt alleen waar jij graag heen gaat. Hem archiveren zou een lijst opbouwen die niemand ooit nog leest. Dit en de eigen geschiedenis zijn de enige twee uitzonderingen op uitgangspunt 2; de worker laat `DELETE` alleen op precies die twee routes toe.
- Een favoriet die naar een record wijst dat gearchiveerd is, blijft staan maar wordt gedoofd getoond: stil laten verdwijnen wat iemand zelf heeft vastgezet, is verwarrender dan het laten zien.

#### 10.3b Geschiedenis

- **De laatste dertig plekken waar je was**, nieuwste bovenaan, met het soort record, zijn titel en hoe lang geleden. Lijsten tellen mee, niet alleen records: terugkomen op een gefilterde lijst is net zo goed terugkomen.
- **Bezoeken, geen wijzigingen.** Wie wat veranderde staat in de audit trail en hoort daar; de geschiedenis is een hulpmiddel om terug te vinden waar je was, meer niet. Twee keer achter elkaar hetzelfde record openen levert één regel op.
- **Per persoon, serverzijdig, afgekapt op dertig.** Tabel `bezoek`: gebruiker, route, titel, soort, moment. Afkappen is het enige verwijderen in de applicatie, en het verwijdert geen vastlegging maar een hulpmiddel. Een gebruiker kan zijn eigen geschiedenis leegmaken.
- De geschiedenis van een ander is niet te bekijken. Het is een werkspoor, geen toezichtsmiddel.

- **Onder BEHEER staat alleen inrichting** (bouwstenen, tabellen en velden, standaardset, rollen). Operationele records worden nooit vanuit het menu aangemaakt.
- **Een nieuwe instapvoorwaarde maak je op de cyclus**, via *Nieuw* in het tabblad Instapvoorwaarden. Het formulier opent met de cyclus als ouder; de breadcrumb is Cycli › cyclus › Instapvoorwaarden › Nieuw. Hetzelfde geldt voor uitstapvoorwaarden, chartanalyses en events-behandelingen.
- Lijst → record → gerelateerde records. Elke tabel inline bewerkbaar. De URL draagt de staat.
- **Eén cyclusscherm.** Formulier met de cyclusvelden bovenaan, daaronder alle gerelateerde lijsten als **tabbladen** in één paneel: Posities · Uitstapvoorwaarden · Instapvoorwaarden · Technische analyse · Events · Besluiten · Metingen · Publicaties. Uitstap staat vóór instap (4.6) en *Voorstellen* is opgegaan in *Besluiten*. Eén tab tegelijk zichtbaar, met teller per tab. Geen aparte schermen per gerelateerde lijst.
- Het tabblad *Technische analyse* bevat een uploadzone voor chart-printscreens en één regel per chart met de parameters (zie 4.3b).
- Het overzichtsscherm draagt een **portefeuillestrook** (ingezet, reserve, blootstelling, bijdragende cycli) — zie 6.1.
- Bij elke score staat de **configuratieversie**. Een grafiek van scores over cycli heen wordt onderbroken waar de versie wisselt. Het veld staat **niet op het formulier**: welke versie gold toen een cyclus ontstond, stempelt het systeem erop. Het is een feit over het moment, geen keuze van wie klikt.
- Live velden dragen een hartslagicoon: 5 s in een lopende cyclus, 60 s daarbuiten, uit de cache van de worker.
- Ongeslagen wijzigingen blokkeren navigatie met een waarschuwing.
- Het go/no-go-scherm opent met de eventstijdslijn, daaronder de instapvoorwaarden en de technische analyse (alle drie alleen-lezen, zie 5.2), dan de inzendingen en, op het meetingscherm, de uitkomst van het gesprek.
- **Responsive:** navigatiekolom wordt uitklapmenu; lijst valt terug op kaarten; formulier stapelt tot één kolom met inklapbare related lists; bewerkbare cellen zijn zichtbaar bewerkbaar zonder hover met raakvlakken ≥ 44px; bij terugkeer uit de achtergrond wordt meteen opnieuw opgehaald en de versheid getoond; de go/no-go-meeting moet op een telefoon te doen zijn.

---

### 10.4 Procesbeheer en Mijn taken

**Processen zijn configuratie.** Onder BEHEER staat *Procesbeheer*: de lijst van acht processen — de cyclus (6), voorwaarden bepalen (5), go/no-go (4), positie innemen (5), bewaking (4), positie sluiten (4), publicatie (5) en post-analyse (4) — met per proces de stappen. Per stap: volgorde, naam, **eigenaar** (een vaste rol of "elke deelnemer"), verplicht ja of nee, en wat de stap afdwingt.

Een wijziging werkt door in de applicatie:

- de **stappenbalk** op de betrokken schermen telt mee;
- de **knoppenrij** rechtsboven volgt mee: elk scherm toont alleen de actie van de stap waar je in zit;
- **Mijn taken** leidt zijn lijst opnieuw af;
- de wijziging opent een nieuwe **configuratieversie** en geldt vanaf de volgende cyclus (3.4); lopende cycli blijven op hun gepinde versie.

Wat een stap afdwingt is instelbaar, maar de **harde uitgangspunten** (1) staan er niet aan bloot: het systeem plaatst nooit een order, niets wordt verwijderd, en drie go's blijven drie go's.

**Mijn taken** staat onder WERKEN. Een taak is hier **geen record**. Er is geen `taak`-tabel, niets om aan te maken, toe te wijzen, af te vinken of te sluiten. Elke processtap die een eigenaar heeft en nu aan de beurt is, verschijnt als regel voor die persoon; zodra de stap in het onderliggende scherm gedaan is, verdwijnt de regel vanzelf. Daarom is er ook geen status, geen vervaldatum en geen eigen historie — die staan al op de processtap en in de besluitlog.

De lijst is een **gewone lijst met de standaardopmaak** — dezelfde kop, filterbalk, kolomzoekvelden en rijen als elke andere lijst in de applicatie — **gegroepeerd per cyclus**. De cyclusnaam staat als groepskop met zijn status ernaast: bovenaan de lopende cyclus met alles wat openstaat, daaronder de afgesloten cycli met wat jij daarin deed, afgevinkt en met datum. Dat er geen `taak`-tabel onder ligt maar een afleiding van processtappen, verandert niets aan het scherm: een lijst is een lijst, en een afleiding is geen reden om een eigen vormtaal te verzinnen.

De kolommen zijn: **taak** (met daaronder waarom de stap nu van jou wordt verwacht), **proces**, **stap** (“3 van 4”), **termijn** als badge — *vóór 14:00*, *uiterlijk 1 okt*, of afgerond met datum — **bij wie** de stap ligt, en het **record** waar hij op slaat. De taaknaam is de link: hij brengt je rechtstreeks naar het scherm en het veld waar de handeling gebeurt. Er is geen knop *Nieuw*, want je maakt hier niets aan.

**Datamodel erbij:**

| Tabel | Eén record is | Velden |
| --- | --- | --- |
| `proces` | Eén proces | Naam, omschrijving, actief, `versie_vanaf`, `versie_tot` |
| `processtap` | Eén stap binnen een proces | Proces, volgorde, naam, eigenaar (rol of "elke deelnemer"), verplicht, wat de stap afdwingt, doelscherm, **actieknop** (label en doel), **quorum** (hoeveel deelnemers de stap moeten afronden voordat de volgende opengaat, bijvoorbeeld 2 van 3) |

Er is bewust **geen** `taak`-tabel: de takenlijst is een query over `processtap` en de stand van de lopende cyclus.

**Wat er in etappe 10 van Procesbeheer gebouwd is.** De tabellen `proces` en `processtap` staan er, met één gevuld proces: **Go / no-go**, met vier stappen (instapvoorwaarden invullen · positie blind versturen · go/no-go meeting · uitvoering ophalen). Per stap staat erbij bij welke **status** van het record hij hoort (`stand`), welk **label de actieknop** draagt, naar welk **doelscherm** hij gaat, en het **quorum** (3 van 3). Daarmee is het quorum een instelling en geen aanname in de code, en komt de knop rechtsboven op het cyclusrecord uit de database: `processtap.stand` = `cyclus.status`. Verandert het quorum, dan verandert alleen die regel. De andere zeven processen uit de lijst hierboven komen in etappe 12; de tabellen groeien mee zonder dat er iets herbouwd hoeft te worden.

---

## 11. API

```
GET    /api/t/:table              lijst met filter, sortering, paginering
GET    /api/t/:table/:id          één record
POST   /api/t/:table              nieuw record
PATCH  /api/t/:table/:id          één of meer velden wijzigen
GET    /api/meta                  alle tabel-, veld- en moduledefinities
GET    /api/live?ids=...          live waarden voor het zichtbare scherm
GET    /api/barometer/:cyclus     afgeleide toestand voor de ledenapp
```

- Geen DELETE-route.
- **Aanmelden gaat met e-mailadres en wachtwoord, per persoon.** Het e-mailadres is de gebruikersnaam (`simon@deltablueprint.nl`), het wachtwoord staat er los van en kan gewijzigd worden zonder dat de identiteit verandert. Verstuurd als HTTP Basic over TLS; het wachtwoord staat nergens opgeslagen, alleen de SHA-256 hash ervan, en de vergelijking gebeurt in vaste tijd. Dit vervangt het model van de delta-proxy worker, waar één sleutel tegelijk identiteit én wachtwoord was: dat kende geen "wachtwoord vergeten" zonder ook de identiteit kwijt te raken.
- Elk record draagt een revisie voor botsingsdetectie bij gelijktijdig bewerken.
- De inhoud van een `inzending` van een ander wordt niet teruggegeven zolang het quorum niet gehaald is: **positie, strike, expiratie, inzet en reden ontbreken**, via welk endpoint ze ook worden opgevraagd. Verplichte testgevallen: "haal de inzendingen op van een beoordelingsmoment waarvan het quorum niet gehaald is" geeft per andere deelnemer alleen naam, status en tijdstip; "filter de lijst op strike" geeft die records niet prijs.
- Authenticatie is **per persoon**; er is geen gedeelde sleutel. Elke schrijfactie draagt de identiteit van de indiener.
- Extra routes: `GET /api/portefeuille` (blootstelling, inzet, reserve, bijdragende cycli) en `GET /api/handelsdag?van=&tot=`.

---

## 11a. Hoe dit systeem zichzelf bewaakt

`npm run proef` draait twaalf proeven. Twee daarvan zijn van een andere soort dan de rest: ze testen geen module maar een afspraak.

> Het waren er zestien. Met de taakkaartlaag (§13b) gingen tien proeven mee en kwamen er geen bij; wat ervan overeind bleef is in de resterende proeven opgenomen. De verwijderde proeven staan in de git-tak `voor-de-herbouw`.

Twee dingen bewaakt de suite sinds 5 oktober over zichzelf, omdat ze beide een keer stilgevallen zijn bij het slopen: een proef die in de lijst staat maar als bestand verdwenen is geeft nu **STUK** in plaats van niets, en een proefbestand dat niet in de lijst staat ook — zo kan een proef niet geruisloos uit de suite vallen.

**Wanneer je wat draait.** De hele suite is er voor code en migraties, niet voor elk tussendoortje:

| Wat je veranderde | Wat je draait |
|---|---|
| alleen opmaak (CSS, spacing, kleur) | `node scripts/proef/schermen.mjs` — de enige die de CSS leest |
| alleen een mockup in `docs/` | niets |
| worker, migratie of schermlogica | de hele suite, één keer, vlak voor het vastleggen |

Niet na elke edit. De suite vangt wat hij vangt op het moment dat het af is; hem twintig keer per uur draaien levert alleen ruis op.

### ~~De backtest — drie maanden, dag voor dag~~ (vervallen)

> **Vervallen op 5 oktober 2026.** `scripts/proef/backtest.mjs` draaide de hele keten negentig dagen achter elkaar en controleerde na elke dag dertien uitspraken die het systeem over zichzelf deed. Elf daarvan gingen over de kaartlaag. De drie eigenschappen die hem bruikbaar maakten — een vast zaad zodat een zeldzame fout te herhalen is, elke dag twee rondes zodat dubbel vuren niets verandert, en een instelbare ijver zodat het ook klopt als niemand kijkt — horen terug te komen zodra de nieuwe werkbank staat. De proef zelf staat in de tak `voor-de-herbouw`.

### De inrichtingsaudit — staat alles in beheer?

`scripts/proef/inrichting.mjs` kijkt niet of iets werkt maar of het op de goede plek staat. De afspraak dat dit systeem metadatagestuurd is verwatert vanzelf — iemand voegt een kolom toe en vergeet het veld, of zet een lijstje waarden in een worker omdat het even sneller is. Elf controles:

1. Elk veld wijst naar een kolom die bestaat, en elk titelveld ook.
2. **Elke kolom heeft een veld**, op huishouding na. Een kolom zonder veld wordt wél geschreven en gelezen, maar is nergens te zien of te zetten — staat hij ooit fout, dan is er geen scherm waarop je dat merkt. Uitzonderingen staan in `MET_OPZET_GEEN_VELD`, mét reden: een uitzondering zonder reden is een vergeten kolom met een vrijbrief.
3. Elke tabel is ergens te bereiken, of er staat vastgelegd dat hij niet meer meedoet.
4. Elk keuzeveld heeft keuzes.
5. Elke verwijzing wijst naar een bestaande tabel.
6. Elk veld staat in een sectie die bestaat.
7. Elke lijstweergave en elk menu-item wijst naar iets dat er is, en elke menugroep is er een die we kennen.
8. **De code implementeert, de database verklaart.**
9. Elke invoer tussen eigen modules wijst naar een bestand dat bestaat en een naam die het uitvoert. Bestaat het bestand niet, dan is dat een fout en geen reden om de controle over te slaan — die beleefdheid liet een invoer uit een verwijderde module groen blijven.
10. Wat de kaartlaag achterliet staat niet meer in beheer, en wat moest blijven staat er nog: de kaartvelden op de processtap, hun keuzelijsten, de twee menuregels, de tabel `motorronde` en de instellingen die niets meer aanstuurden zijn uit; `gebeurtenis.vraagt_antwoord`, `sleutel`, `beantwoord_op` en het venster blijven.
11. Elke tabel die actief in beheer staat, is ergens te bereiken. Dit gat liet `motorronde` staan: de menuregel was weg, de tabel niet, en `#/t/motorronde` werkte gewoon nog.

Dat laatste is de kern. Waarden als `hoog/medium/laag`, `open/wacht/dicht` of wat een knop doet bestaan op twee plekken: de code weet wat eraan te doen, de database zegt welke er mogen bestaan. Dat is geen dubbeling maar een werkverdeling — zolang de twee lijsten gelijk blijven. Lopen ze uiteen, dan richt je in beheer iets in dat de code niet kent (de knop doet niets) of kent de code iets dat je nergens kunt kiezen (dode code). De modules **exporteren** hun lijst, zodat de proef hem leest in plaats van uit de tekst te raden.

### Wat de audit vond

| Wat | Waar |
|---|---|
| Vier menu-items wezen naar een tabel die niet bestaat — erop klikken gaf een foutmelding | 0109 |
| Drie tabellen (`gebruiker`, `handelsdag`, `audit`) hadden een scherm maar geen enkel veld; de worker antwoordt dan "heeft nog geen velden" | 0109 |
| `positie.teruggekocht_pt` stond in een sectie die niet bestaat en kwam dus nergens op het formulier | 0110 |
| Losse kolommen zonder veld (`processtap.fase`, `afvinkregel`, `uitleg`, `gebeurtenis.sleutel`) | 0110 |
| `knop1_doel`, `knop2_doel` en `afvinkregel` waren vrije tekst terwijl de code maar een handvol waarden kent | 0111 |

**`gebruiker.wachtwoord_hash` krijgt met opzet geen veld.** Wat niet op een formulier staat, kan ook niet per ongeluk op een scherm komen.

### Wat met opzet in code blijft

Niet alles hoort in beheer. Drie dingen blijven in code, en dat is een keuze:

- **De bronnen van een gebeurtenis** (`worker/stroom.js`). Welke bronnen er zijn staat in beheer; wat er met elke bron gebeurt is code.
- **Het verloop van het venster** (`worker/barometer.js`). De volgorde van de zes standen is een eigenschap van het verloop, de labels staan in beheer want die gaan naar de leden.
- **Waar een scherm heen stuurt.** Dat zijn routes van deze app, en een rij in beheer hoort niet te weten hoe het adres van een scherm eruitziet.

In alle drie de gevallen geldt dezelfde regel: de code houdt de uitvoering, de database houdt de lijst, en de proef legt ze naast elkaar.

> De sleutelbouwers en de kalenderslagen stonden hier ook. Die hoorden bij `worker/motor.js` en zijn met §13b verdwenen.

## 11b. Wat een review vond, en wat eraan veranderd is

Twee onafhankelijke reviews van de hele keten (beveiliging en robuustheid; logische correctheid) leverden negen fouten op die alle negen **stil** waren: niets viel om, niemand kreeg een melding, de uitkomst was gewoon verkeerd. Bij zes ervan zouden de leden het als eerste gemerkt hebben.

> `scripts/proef/hersteld.mjs` legt er sinds 5 oktober zes vast. De drie die over de kaartlaag gingen — de sleutel per openstaande kaart, de go/no-go-sleutel en het uitstellen met een onzindatum — konden niet blijven staan toen die laag eruit ging (§13b). De tabel hieronder blijft volledig: deze fouten zijn gemaakt, en wat terugkomt moet ze opnieuw uitsluiten.

| Wat er misging | Gevolg | Reparatie |
|---|---|---|
| De unieke index op `gebeurtenis.sleutel` gold over alle rijen | Een sleutel was na één keer voorgoed bezet. Barometer 4 → 5 → terug naar 4 gaf geen kaart; een voorwaarde die rood → groen → rood ging ook niet; na één go/no-go-ronde kreeg niemand ooit nog een kaart | 0113: de index geldt alleen voor **openstaande** kaarten |
| De go/no-go-aanleiding gebruikte alleen het gebruikersnummer als sleutel | Met twee open momenten kreeg alleen het eerste kaarten | 0113: moment + deelnemer |
| `meldGepubliceerd()` pakte de nieuwste stand | Een bericht over stand 3 zette het stempel op stand 5. De leden lazen 3, het systeem beweerde 5, en omdat die daarmee "gelijk" stonden werd 5 nooit meer gemeld | de stand wordt gevonden via de kaart waar het bericht uit kwam |
| `zetConceptKlaar()` zette geen `gebeurtenis` op het concept | De achterstand zag het bericht nooit en bleef voor altijd zeggen dat de leden achterliepen; de kaart ging niet dicht; "Bericht opstellen" maakte een **tweede** bericht voor dezelfde positie | eerst loggen, dan het concept met die gebeurtenis erbij |
| `stuurTerug()` had geen autorisatie | De opsteller kon zijn eigen bericht terugsturen (stand → `concept`, nalezer eraf) en het daarna zelf versturen. Het vierogenprincipe was één klik waard | alleen de nalezer kan terugsturen |
| Versturen las de status en schreef zonder voorwaarde | Twee tabbladen tegelijk stuurden het bericht twee keer | de voorwaarde staat nu in de `UPDATE` |
| `feiten` werd afgekapt op 2000 tekens | Dat maakte van geldige json bijna altijd ongeldige json, die daarna blind geparseerd werd: één te rijk feitenobject legde de **hele tijdlijn van een cyclus** plat | te groot wordt vervangen door een markering; lezen is overal afgeschermd |
| `tot` bij uitstellen werd niet gecontroleerd | `"nooit"` is nooit kleiner dan een datum, dus zo'n kaart kwam nooit terug — niet beantwoord, nergens te openen, en hij telde wél mee in de achterstand | alleen een echt tijdstip, anders morgenvroeg |
| De ISO-weekberekening had twee tekens omgedraaid | In tien van dertien jaren was élke dag fout; 29 december 2025 werd "week 2026-00" | de donderdag van week 1 als ijkpunt |

Daarbij nog vijf kleinere: de maandslag liep op 30 dagen in plaats van op kalendermaanden (februari kreeg geen verslag, mei twee), de maandsleutel liet de cyclus weg (twee cycli deelden één kaart), de naleeskaart telde hetzelfde onvertelde bericht een tweede keer in de achterstand, een onbekende prioriteit viel naar grijs-onderaan in plaats van op te vallen, en een vaste nalezer die jijzelf was maakte van nalezen een formaliteit.

### Twee sloten strakker

- **Een `voorwaarde` moet `soort` noemen.** Zonder die eis was `1 = 1` geldig, en dan stempelde één ronde vijfhonderd willekeurige gebeurtenissen tot kaart — onomkeerbaar, want er wordt niets gewist.
- **Een `aanleiding` mag geen geheimen lezen, en geen `select *`.** De gebruikerstabel zelf blijft toegestaan: de go/no-go heeft de deelnemerslijst echt nodig. Verboden zijn de kolommen met wachtwoorden en brokersleutels, en de sterretjesvorm die ze alsnog meesleept zonder dat iemand ze opschreef.

### Eén plek voor tijd

`worker/tijd.js` is nieuw. Drie plekken lazen een tijdstip met `new Date(s.replace(" ", "T") + "Z")`, elk met hetzelfde randgeval erin: een moment dat zelf al ISO is krijgt een tweede `Z` en wordt `NaN`, waarna de leeftijd van een kaart stil `null` werd en hij nooit opschaalde. Nu één functie, die `null` teruggeeft als ze het niet zeker weet.

### Wat we bewust niet hebben gerepareerd

Twee bevindingen vallen buiten de wachtrij en vragen een beslissing, geen patch:

- **Er is geen rollenmodel.** Elke aangemelde gebruiker mag elke tabel met een scherm aanpassen, `gebruiker` en `processtap` inbegrepen. Iemand kan dus een collega op non-actief zetten of een kaartdefinitie herschrijven. Bij drie mede-oprichters is dat te verdedigen; vanaf de eerste medewerker niet meer.
- **Blinde inzendingen zijn af te leiden via de lijstfilters.** `blind.js` maskeert de kolommen ná de query, terwijl `lijst.js` in SQL filtert en sorteert op de echte kolommen. `?f.strike=6050` verraadt dus of iemands strike 6050 is, ook vóór het quorum. Dat raakt de kern van het go/no-go-protocol (§5.3) en hoort gerepareerd te worden vóór er iemand bijkomt die niet mede-oprichter is.

## 12. Techniek en uitrol

- Nieuwe applicatie naast de bestaande Cockpit, gevoed door dezelfde delta-proxy worker. De huidige tabs blijven draaien; de Market Timing-panelen blijven voorlopig in de oude Cockpit.
- Opslag: Cloudflare D1 naast de bestaande KV.
- Front-end: Vite. Vier componenten dragen het geheel — schil met navigatie en routing, lijst, formulier, veldrenderer. Alles daarbuiten is configuratie.
- Eén datalaagje tussen app en worker, één functie per endpoint.
- **Een tabel herbouwen in D1.** D1 draait met foreign keys aan. Een migratie die een tabel herbouwt — nieuwe tabel, rijen overzetten, oude droppen, hernoemen — faalt daarom zodra er kindrijen onder die tabel hangen: de DROP telt als het wissen van alle ouderrijen. Zo'n migratie begint met `pragma defer_foreign_keys = on;` en eindigt met `off`, zodat de controle pas aan het einde van de transactie gebeurt, als de tabel er weer staat met dezelfde id's. `scripts/proef/migraties.mjs` draait sinds 4 okt 2026 met foreign keys aan en elke migratie in een eigen transactie, met een positie en een exitregel in de zaai — anders gaat zoiets lokaal moeiteloos door en pas op staging stuk.
**Uitrollen, in deze volgorde.** Vier opdrachten, elk apart, en elke volgende pas als de vorige gelukt is. Plak er geen commentaar achter: `#` in een zsh-regel die via `npm run` doorloopt komt als argument bij wrangler terecht, en dan faalt de opdracht terwijl de rest van het plakwerk gewoon doorloopt — je staat dan met nieuwe code op een oude database.

```
npm run proef
npm run build
npm run db:migrate:staging
npm run deploy:staging
```

Naar productie: `npm run db:migrate` en daarna `npm run deploy`. **De migratie gaat altijd vóór de uitrol**, want de code rekent op de definitielaag die de migratie neerzet. Loopt er één stap stuk, dan stop je: een deploy op een niet-gemigreerde database geeft schermen die velden zoeken die er nog niet zijn.

- **Uitrol via de repository.** Worker, migraties en front-end in één repo, gekoppeld aan Cloudflare. Elke push is een uitrol. Staging naast productie, met eigen database en eigen sleutels. Geheimen als omgevingsvariabelen, niet in de code. De bestaande `delta-blueprint.html` gaat mee in dezelfde repo.

---

## 13. Bouwvolgorde

| # | Etappe | Aan het eind werkt |
| --- | --- | --- |
| 0 | Repository en omgevingen | Repo gekoppeld, staging en productie, eerste automatische uitrol |
| 1 | Fundament | D1 aangemaakt, definitietabellen gevuld, **configuratieversie en versiekolommen op de rekenlaag**, **`handelsdag` gevuld voor 2026–2027**, aanmelden met e-mailadres en wachtwoord, `/api/meta` levert definities, lege app met navigatie |
| 2 | Lijst lezen | Cycli en voorwaarden zichtbaar, sorteerbaar, gefilterd |
| 3 | Formulier lezen | Record opent met velden in secties en related lists |
| 4 | Schrijven | Opslaan, New-knop, validatie uit `db_rule`, audit trail |
| 5 | Inline bewerken | Cel bewerken in lijst en related list, botsingsdetectie |
| 6 | Live waarden | Hartslag, pollen, vier toestanden. **In de MVP zonder feeds**: waarden worden met de hand ingevuld (4.3a); het koppelen aan de feeds hoort bij etappe 11 |
| 7 | *Fase 2 — buiten de MVP.* Score en rekenmotor | Rekenmotor voert `db_calc` uit tegen de gepinde configuratieversie, drempels en gewichten, harde gates, `moment_voorwaarde` als momentopname, en de vraag of het vastklikmoment terugkomt |
| 8 | *Fase 2 — buiten de MVP.* Regelbeheer | Regels samenstellen uit bouwstenen, doorrekenen tegen de lopende cyclus |
| 9 | Eventskalender | Eventtabel, jaarscript, handmatig bijmaken, import, related list op periode |
| 10 ✓ | Blind versturen, quorum en onthullen | `inzending` als kindtabel van de cyclus, vergrendelen bij versturen, **serverzijdige afscherming van positie, strike, expiratie, inzet en reden**, quorum per processtap, openen zodra het gehaald is, het meetingscherm met de inzendingen open, en één vastgelegde uitkomst op het beoordelingsmoment |
| 11 ~ | Positie en publicatie | Het positierecord met zijn zes stappen en statussen (10.0f), brokerkoppeling, **vergelijking uitkomst ↔ uitvoering met afwijkingsregistratie**, exitplan als velden, tranches, uitkomst vastleggen, communiceren naar leden |
| 11a ✓ | Favorieten en geschiedenis | De navigator met drie tabbladen: het menu, je eigen favorieten (route met filter en sortering, naam, kleur, icoon, volgorde) en de laatste dertig plekken waar je was |
| 11b | Portefeuille | Portefeuille-instellingen, blootstelling en reserve over alle open tranches, sizing als voorwaarde, portefeuillestrook op het overzicht |
| 12 | Dashboard en post-analyse | Het operationele dashboard met zijn vijf toestanden inclusief het terugkijken op een afgesloten cyclus, procesbeheer en Mijn taken als gegroepeerde lijst, positielijst, exitdrempels met quote-toets, maandverslag met toetsing |
| 13 | Barometer en berichten | Afgeleide toestand, endpoint, berichtsjablonen per fase, de klantkolom op het dashboard met voorstel-en-publiceer voor de barometer, automatische controle vóór publicatie |
| 14 | Protocol van het gesprek | Vijf agendablokken, behandeling per event, exitplan als voorwaarde vóór uitvoering, stoploss-vergrendeling, schaduwevaluatie van een no-go |

Na etappe 4 is een echte cyclus volledig vast te leggen. Werken op desktop, iPad en iPhone is een voorwaarde bij elke etappe, geen eigen etappe.

**Overweging:** etappe 14 bevat regels die de besluitvorming bindend maken. Als jullie het protocol vanaf de eerste echte cyclus willen volgen, hoort een deel ervan naar voren — in het bijzonder de drie-go-regel en de verplichte reden bij een no-go, die bij etappe 10 horen in plaats van erna.

**MVP-knip: etappe 0 tot en met 10, zonder 7 en 8.** Dat is een werkende interne applicatie waarin een echte cyclus van openen tot vastgelegde uitkomst wordt vastgelegd, zonder brokerkoppeling en zonder ledencommunicatie. De positie wordt in die fase met de hand ingevoerd, en **de instapvoorwaarden zijn een werklijst die met de hand wordt ingevuld** (4.3a): geen drempels, geen gewichten, geen score, geen vastklikmoment. De rekenlaag erboven — etappes 7 en 8 — is fase 2. Etappe 6 beperkt zich daarmee tot de hartslag en het verversen van het scherm; het koppelen aan de feeds schuift mee naar etappe 11. Etappe 11 wacht op de brokerkoppeling (openstaand punt 6), etappe 13 op de bevestiging over marktdata richting leden (punt 7). Geen van beide vraagt herbouw van wat in 0–10 staat.

---

## 13a. Het venster — voorbereidingstijd voor een lid (migraties 0121, 0123, 0124)

Het venster had drie standen (open / wacht / dicht) en was gebouwd op de verkeerde vraag: *kunnen wij instappen*. Het gaat niet over ons. **Elke maand ligt het instapmoment anders, en wie pas hoort dat we erin zitten als we erin zitten, is mentaal te laat.** Het venster is dus voorbereidingstijd.

Zes standen, als verloop:

| Stand | Wat het zegt |
|---|---|
| Pre-analyse | we kijken, de chart is nog niet gelezen |
| Besluit loopt | we zijn aan het beslissen |
| Opent binnenkort | maak je klaar |
| Open | wij zitten erin, je kunt volgen |
| In positie | wij zitten erin, instappen kan niet meer |
| Afgerond | de cyclus is uit |

**Drie standen worden nooit door het systeem gezet, en ook nooit tegengesproken:** *Opent binnenkort* en *Open*. Dat is jullie oordeel over de markt, en juist die twee zijn voor een lid het meeste waard — een systeem dat ze zelf zet, zet ze een keer verkeerd. Staat het venster op een van die twee, dan zwijgt de kaart, ook al zegt het proces iets anders.

**Het systeem stelt voor, jij publiceert.** Het voorstel staat als stippellijn om de stand; je klikt hem aan en drukt op publiceren. Mis je het — niemand keek — dan is het verschil er morgen nog, want het wordt bij het lezen afgeleid en niet als taak weggeschreven.

**Een nieuwe cyclus begint op pre-analyse** (0124). Bij het aanmaken schrijft de cockpit meteen een barometerstand: stand 1, venster *pre-analyse*, reden "Cyclus geopend." Zonder die rij heeft de barometer geen stand, en dan moet elk scherm zelf gokken wat 'nog niets' betekent.

**'Venster gemist' is geen venstertoestand** (0123). Het venster zegt hetzelfde tegen alle leden tegelijk; 'gemist' zegt juist iets over één lid: dat hij niet heeft aangegeven de positie gevolgd te hebben toen de stand naar *In positie* ging. Dat hoort op de ledenkant, per lid. Die bestaat nog niet — dit is dus uitgesteld, niet verplaatst.

## 13b. De taakkaartlaag is eruit (migraties 0125–0127, 5 okt 2026)

De eerste werkbank was een **wachtrij van taken**: processtappen met een stuk SQL per definitie (`voorwaarde`, `aanleiding`) dat bepaalde wanneer een gebeurtenis zich tot kaart stempelde, een motor die dat elke tien seconden deed, en een scherm met *Van mij / Alles*. Die vorm is verlaten. Twee redenen:

- **Het werk stond op de verkeerde plek.** Een instapvoorwaarde meten, een analyse invullen, een besluit afronden — dat doe je op het cyclusrecord en in zijn related lists, waar het veld staat. Een kaart die ernaar verwijst is een omweg, en twee plekken die hetzelfde beweren lopen uit elkaar.
- **De definitielaag was te machtig.** Vrije SQL in beheer bepaalde welke rijen de motor te zien kreeg. Het slot erop was dicht, maar het blijft het gevaarlijkste wat er stond.

**Wat de werkbank nu is:** de positie monitoren, het venster en de barometer zetten, en de ledencommunicatie doen. Niets anders.

**Wat eruit ging** (code verwijderd, database op archief): `worker/motor.js`, `worker/wachtrij.js`, `worker/stappen.js`, `worker/achterstand.js`, `app/src/werkbank.js` met zijn 125 regels opmaak in `stijl.css`, de `scheduled`-handler, de routes `/api/wachtrij*`, `/api/achterstand` en `/api/cyclus/:id/tedoen`, tien proeven, de twaalf kaartdefinities onder proces 4 en de menuregel naar `/werkbank`.

**Wat het slopen zelf kapotmaakte, en hoe dat gevonden is.** Bij het wegknippen van de achterstandsroute gingen drie routes mee die niets met de kaartlaag te maken hadden: `/api/publicatie/:id/nalezen`, `/vrijgeven` en `/terug` — het hele vierogenprincipe op een bericht. **Geen enkele proef viel om**, want ze riepen de functies in `worker/bericht.js` rechtstreeks aan; alleen de weg ernaartoe was weg. Een review vond het. Daarom staat er nu in `scripts/proef/schermen.mjs` een controle in twee richtingen: elk pad dat `app/src/api.js` aanroept komt in `worker/index.js` ergens op uit, en elke route die de worker aanbiedt wordt ergens gebruikt — op een korte lijst na, met naam en reden. Die controle is omgekeerd geverifieerd: met de routes er weer uit faalt hij op precies die drie.

**Wat bleef:** de gebeurtenissenstroom (`gebeurtenis`), de publicaties met hun nalees- en vierogenstroom, de berichtsjablonen, de barometer met haar venster, de spiegel en de brug. Daarop wordt de nieuwe werkbank gebouwd.

**Ook uit beheer** (0126). De kaartdefinities waren weg, maar het processtapformulier vroeg nog om *Voorwaarde*, *Aanleiding*, *Sleutel*, *Prioriteit* en de knopvelden — eenentwintig velden die niets meer aanstuurden, met hun keuzelijsten eronder. Die staan nu op `actief = 0`, net als de menuregels *Werkbank* en *Motorrondes* en de instelling `motor_rondgang_seconden`. Op de gebeurtenis zijn `processtap` en `wachten_tot` uit beeld; `vraagt_antwoord`, `sleutel` en `beantwoord_op` blijven, want een kaart blijft bestaan — alleen gaat hij voortaan over een positie. `scripts/proef/inrichting.mjs` bewaakt dit: geen van die velden mag terugkomen zonder dat iemand het expliciet aanzet.

**En de rest** (0127). Een review vond nog vier sporen die 0126 miste. De tabel `motorronde` stond nog volledig actief in de definitielaag: niet in het menu, maar wél in `/api/meta`, in *Tabellen en velden*, en `#/t/motorronde` was een werkend scherm — een tabel met een keuzelijst *De klok* voor een klok die niet meer loopt. De weergave `kaarten` op processtap bestond nog uit zeven kolommen waarvan er zes uitgezet waren. De twee instellingen van de achterstandsmeter (`achterstand_amber_uur`, `achterstand_rood_uur`) stonden er nog met uitleg en al. En favorieten en bezoeken die naar `/werkbank` wezen bleven staan: wie de werkbank als ster had, hield een ster die op een leeg scherm uitkwam.

Die laatste zijn de ene plek waar wél verwijderd wordt, en dat is precies zoals afgesproken (uitgangspunt 2): een favoriet en je eigen geschiedenis zijn geen vastlegging maar een persoonlijke instelling — ze zeggen alleen waar jij graag heen gaat en waar je net was.

`inrichting.mjs` heeft er een controle bij die dit gat dicht: **elke tabel die actief in beheer staat, moet ergens te bereiken zijn.** Precies dat ontbrak, en daarom bleef `motorronde` staan.

**Niets is verwijderd uit de database.** De definities staan op `archief = 1` en hun kolommen op `processtap` blijven staan: een kolom laten vallen betekent de tabel herbouwen, en dat is een groter risico dan een ongebruikte kolom. De verwijderde code en de proeven die erbij hoorden staan in de git-tak **`voor-de-herbouw`**.

**Een kaart blijft bestaan, maar alleen voor een positie.** Open, gesloten, doorgerold — dat zijn de enige drie. De doorrol wordt herkend: sluit een positie en gaat er kort daarna een nieuwe open, dan verandert de kaart van de sluiting van vorm en laadt het doorrolsjabloon met beide contracten erin. De mapping staat in code, niet als ingerichte SQL.

## 13c. Ledencommunicatie — het scherm waarop je begint (migraties 0128–0134, 5 okt 2026)

Het scherm waarop je begint, herbouwd uit `docs/mockup-werkbank.html`. Vier vakken, in deze volgorde, en niets anders.

**Het heet Ledencommunicatie** (0134). 'Werkbank' zei wat het vroeger was: een bank met werk erop. Dat werk is weg (§13b) — wat er staat gaat over de leden: de stand die zij te zien krijgen, de posities waar die stand uit volgt, en wat er verstuurd is. De route blijft `/werkbank`: een adres is geen naam, en favorieten, bladwijzers en de geschiedenis van iedereen wijzen ernaar.

**Het instap venster is een balk die volloopt (5 okt 2026).** Zes even zware vakjes lieten juist niet zien wat het is: een verloop. Nu staat de stand groot in woorden, met daaronder zes segmenten en hun naam. Drie kleuren, één verhaal: **grijs** is nog niet geweest, **lichtblauw** is gepasseerd, **donkerblauw** is waar we staan — en dat is wat de leden weten. Groen blijft wat je net koos en nog niet gepubliceerd is; na publiceren wordt dat groen vanzelf donkerblauw.

**1. Stand naar de leden.** Het venster boven, de barometer eronder, en **één knop Publiceren voor allebei**. Kies je er twee, dan gaat er één bericht uit over allebei — een lid dat twee berichten krijgt over hetzelfde moment leest het tweede niet meer. De barometer **slaapt** tot het venster op *In positie* staat: daarvoor zitten wij er niet in en vragen we de leden niets, daarna is de cyclus uit. Hij is dan grijs en onklikbaar.

**2. De barometer leest de balk** (0132). De vijf standen zijn de vijf zones van de gezondheidsbalk uit §10.1, en de stand die het systeem voorstelt is de zone waarin de markering van de **zwakste tranche** staat. Er is dus geen apart rekenwerk: iedereen ziet op het scherm waarom.

De balk loopt **van verlies links naar winst rechts** — de ask daalt naar rechts, want een geschreven optie die goedkoper wordt is winst. Alle ijkpunten zijn **ask-niveaus**, want dat is de prijs waartegen je er werkelijk uit komt:

| Ijkpunt | Niveau | Waar vandaan |
|---|---|---|
| stop loss | ask 60,0 | standaardset, per tranche aan te scherpen |
| waarschuwing | ask 50,0 | standaardset |
| break-even | ask = de ontvangen premie | per tranche |
| helft binnen | ask = 50 % van de premie | per tranche |
| winstanker | ask = 30 % van de premie | winstanker 70 % binnen |

**De stoploss is géén veelvoud van de premie.** Dat stond hier eerder wel en was verzonnen; hij is een vast niveau uit de standaardset.

**De ijkpunten staan op vaste plekken op het scherm**, met break-even in het midden, en binnen elk vak wordt lineair geïnterpoleerd. Zo tonen twee tranches met verschillende premies dezelfde zonebreedtes en kun je ze naast elkaar lezen zonder eerst de schaal te ijken. Links staat een smal, dieprood stuk voor wat voorbij de stoploss staat: hoe ver eroverheen doet er niet toe, want daar hoort de tranche gesloten te zijn.

**De richting van de schaal** staat in §10.1 en liep in 0107 andersom. Beslist op 5 oktober 2026: **1 is onder druk, 5 is veilig** — de stand telt op naarmate de positie veiliger staat. De vijf heten: *Onder druk · Krap · Aandacht · Comfortabel · Veilig* (0132, 0133). De woorden gaan naar de leden en staan dus in beheer, niet in de code. 0132 draait de labels én de al vastgelegde standen om, met een notitie in de reden zodat niemand zich later afvraagt waarom het getal niet bij de tekst past.

**De zwakste open positie bepaalt de stand** — niet het gemiddelde: één tranche die tegen haar stoploss aanligt vraagt iets van een lid, ook als de twee andere vrijwel afgerond zijn.

**Het systeem stelt voor, een mens publiceert.** Het voorstel staat als stippellijn om de stand; je klikt hem aan en drukt op publiceren.

**Meten kan ook niet lukken, en dan zegt het dat.** Geen prijs van de broker, een prijs ouder dan `koers_vers_minuten`, een prijstijdstip dat onleesbaar is of in de toekomst ligt, geen ontvangen premie, of een stoploss ónder break-even — dat laatste is geen stoploss maar een winstdoel, en deze balk kan dat niet tonen. In al die gevallen stelt het systeem **niets** voor en staat op het scherm waarom.

**De spot speelt geen rol.** Niet de afstand tot de strike, maar de ask. Dat scheelt het Eurex-indexabonnement en een tweede ding dat stil kan uitvallen; de tabel `marktstand` uit 0128 is daarmee buiten gebruik (0131).

**3. De posities.** Per positie dezelfde balk, met een merkteken op de ask en het resultaat erboven. De vakjes hebben de breedte van hun eigen bereik — even brede vakjes zouden het merkteken in een ander vakje zetten dan het label ernaast. Uitklappen geeft zes cijfers: premie, ask (de laatprijs; ontbreekt die, dan de marktprijs, en dat staat erbij), open resultaat, break-even, stoploss met wat er nog te gaan is, en de dagen met hoe oud de prijs is. Plus een balkje met hoeveel van de premie binnen is.

**4. Publicaties.** Twee kolommen in één kader: links de kaarten, rechts wat verstuurd is.

**Een kaart komt alleen uit een positie** — open, gesloten, doorgerold — **en wordt afgeleid, niet weggeschreven.** Er is geen vlag en geen motor: een kaart staat open zolang er geen bericht over verstuurd is en niemand gezegd heeft dat het niet gemeld wordt. Daardoor kán hij niet blijven staan nadat het werk gedaan is; hij verdwijnt doordat het bericht weg is. Dat was de fout die de vorige werkbank maakte.

**De doorrol wordt herkend.** Sluit een positie en gaat er binnen `doorrol_minuten` een nieuwe open in dezelfde cyclus, dan is dat één handeling: de kaart van de sluiting verandert van vorm, laadt het doorrolsjabloon en draagt beide contracten met het nettoresultaat. Er komt geen kaart bij.

**Niet melden is een besluit, geen wegklikken.** Het vraagt een reden, en die komt op de gebeurtenis te staan met wie het besloot.

**De maat van het scherm is een iPad in landscape.** 1024 px breed, min het menu en de marges: ongeveer 740 px voor de werkbank. Daar past alles in zonder horizontaal te scrollen en zonder dat de balken omvallen — juist het naast elkaar lezen van drie tranches is waar dit scherm voor is. Onder de 760 px (telefoon) valt het wel om, want dan wordt alles onleesbaar smal.

**De kaders staan in hetzelfde ritme als de rest van de app**: 10 px ertussen, 14 px erbinnen — zoals op het gespreksscherm. Alles in een paneel komt op dezelfde linkerlijn uit: de kop, de body, een positieregel, een kaart, de knopbalk.

**De namen zijn wat er staat, en verder staat er niets.** Het eerste vak heet *Instap venster* en *Positie Barometer* — twee namen die zeggen wat ze zijn. De begeleidende zinnetjes eronder en achter de kopjes zijn weg (5 okt 2026): 'voorbereidingstijd voor de leden', 'wat wij van een lid vragen', de slaapregel, de uitleg van de posities-schaal en die van de publicaties. Ze legden iets uit dat het scherm zelf al laat zien, en op een scherm dat je elke dag opent is dat ruis. De barometer die slaapt is nog steeds grijs en onklikbaar — dat is de uitleg. De lijst standen naast de meter toont alleen de **namen** van de vijf standen; de ask-grenzen stonden er ook en staan al onder de posities, waardoor die lijst een tabel werd in plaats van een keuzelijst.

**Twee kaders, twee betekenissen.** Blauw is de stand zoals hij vastligt en die de leden kennen; groen is wat je net koos en nog niet weg is. Na publiceren wordt het groene kader dus blauw. Het systeemvoorstel blijft een amberen stippellijn en is geen van beide.

**Routes:** `GET /api/werkbank` (alles in één vraag — het scherm toont één samenhangend beeld, en drie losse vragen zouden drie momenten opleveren die niet bij elkaar horen), `POST /api/werkbank/publiceer`, `POST /api/kaart/:id/niet-melden`, `POST /api/kaart/:id/concept`.

**Wat de brug levert:** de bied- en laatprijs per contract, die hij al stuurde. Er is geen extra marktdata voor nodig — wel moet *marktdata* in de brokerinstellingen aan staan, anders komt er geen prijs door en meet de barometer niets (en zegt hij dat).

## 14. Openstaande punten

*Opgelost in versie 1.0: versiebeheer van de rekenlaag (3.4), blootstelling en sizing op portefeuilleniveau (6.1), de handelskalender als tabel (3.2), het splitsen van voorgenomen en uitgevoerde posities (3.3), registratie van afwijking tussen besluit en uitvoering (6), plus de vier standen met "niet gemeten" (4.4), de chartanalyse volgens de metadata-lijn (4.3b) en aanmelden per persoon (1, 11).*

1. ~~**Premie-referentie na een rol**~~ — **beslist (2 okt 2026): per tranche, de keten in de post-analyse.** De stoploss en het winstanker van een tranche rekenen tegen de premie van díé tranche; of het doorrollen als geheel iets opleverde, wordt over de hele keten beoordeeld in de post-analyse. Een exitregel moet te lezen zijn zonder de geschiedenis van twee maanden erbij.
1a. ~~**Mag de stoploss verruimd worden?**~~ — **beslist (2 okt 2026): nooit.** Aanscherpen mag altijd; een hogere ask wordt geweigerd en in de audit trail genoteerd. Er komt geen uitzondering, ook niet met een toelichting: een stoploss die je kunt oprekken is geen stoploss. Gebeurt het in een uitzonderlijke situatie tóch buiten de applicatie om, dan komt het binnen als een afwijking bij het vastleggen van de uitkomst — met de verplichte toelichting die daarbij hoort (6).
2. **Inzet van de tweede tranche** — vast te leggen regel of oordeel per situatie? Blokkeert niets, maar bepaalt of het een voorwaarde wordt.
3. **Staartrisico-tegel** — wel of niet opnemen, en bij welke percentages.
4. **Standaardzwaarte per eventsoort** — beginlijst wordt bij het bouwen ingevuld en daarna bijgesteld.
5. **Maatstaf voor blootstelling** — notioneel (standaard) of de margin die Lynx vasthoudt. Zie 6.1. Te bevestigen met Jacqueline; het is een instelling, geen herbouw.
6. **Brokerkoppeling met Lynx** — besluit plus betaald realtime Eurex-abonnement. Professionele classificatie betekent Eurex Core L2 (€ 67,50) plus STOXX Index Real-Time (€ 19) per maand. Blokkeert etappe 11.
7. **Marktdata richting leden** — bevestiging van LYNX en IBKR vóór etappe 13.
8. **Market Timing-panelen** — blijven voorlopig in de oude Cockpit; verhuizing later te bepalen.
9. **'Venster gemist' per lid** — een melding aan één lid dat hij de positie niet gevolgd heeft toen de stand naar *In positie* ging. Vraagt dat de ledenkant bijhoudt óf iemand gevolgd heeft; die bestaat nog niet. Zie 13a.
10. **Een positiemelding intrekken** — voor leden die hem nog niet gevolgd hebben, als het venster sluit omdat het niet meer opportuun is. Zelfde afhankelijkheid als 9.
