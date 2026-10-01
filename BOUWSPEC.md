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

### 3.3 Relaties met betekenis

- `event` staat **buiten** de cycli. Een cyclus bezit geen events; hij heeft een periode. De koppeling met een beoordeling loopt via `cyclus_event`.
- **De zwaarte wordt twee keer beoordeeld, en dat is geen doublure.** Op het `event` staat de algemene zwaarte: hoe zwaar een ECB-vergadering doorgaans weegt. Op `cyclus_event` staat de zwaarte *in deze cyclus*: dezelfde vergadering is zwaar vlak voor de expiratie en licht als ze aan het begin van de looptijd valt. De algemene zwaarte is de beginwaarde van de cyclusspecifieke; wijkt iemand ervan af, dan hoort daar een reden bij (een waarschuwing, geen blokkade). Een zwaarte op het event aanpassen mag nooit het oordeel in een lopende cyclus veranderen — dat was de reden om dit te splitsen.
- **De koppeling vult zichzelf, het oordeel niet.** Bij het aanmaken van een cyclus, bij het verschuiven van haar doelexpiratie, en bij elk event dat erbij komt (met de hand of uit een document), zet het systeem de ontbrekende `cyclus_event`-regels klaar voor alles wat binnen de looptijd valt. Behandeling blijft `nog te wegen` tot een mens hem zet. Wat door een datumwijziging buiten de periode valt, blijft staan: daar is over nagedacht.
- **Voornemen en uitvoering zijn twee tabellen.** Een `inzending` is wat iemand vóór het gesprek voorstelt; een `positie` is wat er daarna werkelijk in de markt staat. De positie verwijst naar het `beoordelingsmoment` waar ze uit voortkomt, niet naar een inzending — de uitkomst is van de groep, niet van één persoon. Eén tabel voor beide zou betekenen dat de blindering van inzendingen langs de achterdeur van een positielijst kan lekken.
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
| Gemeten waarde | Wat je afleest bij Lynx of in de chart, als tekst — "2,4 %", "18,4", "0,8×" |
| Status | Groen, oranje, rood of *niet gemeten*, met de hand gezet |
| Wie en wanneer | Automatisch |

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

**OPEN** — na een rol: rekent de stoploss en het winstanker tegen de premie van de nieuwe tranche, tegen de cumulatieve netto premie van de keten, of gesplitst (exitregels per tranche, rolbesluit tegen de keten)? Voorstel is de gesplitste variant. Moet vastliggen vóór etappe 12.

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
- Onderaan **de uitkomst van het gesprek**: go of no-go, bij go strike, expiratie en aantal contracten, met wat het gesprek veranderde en wie aanwezig waren. Vastleggen zet de cyclus op *uitvoering ophalen*.
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

**Een kindtabel heeft geen eigen menu-ingang en geen eigen lijstscherm.** Ze verschijnt als **gerelateerde lijst** op het record van haar ouder; dat tabblad *is* de lijst. Alleen tabellen die zelfstandig betekenis hebben — cycli, posities, publicaties, besluiten, processen — krijgen een eigen lijst in het menu. Stappen horen bij een proces, aanleidingen bij het proces Publicatie, voorwaarden bij een cyclus: die staan nergens los.

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

`positie` heeft **één recordscherm** met het proces **POSITIE** (besluit goedgekeurd → exitplan vastgelegd → order bij Lynx → uitvoering geïmporteerd → bewaken → uitkomst vastgelegd) en één statusveld dat zegt waar de tranche staat. De lijst *Posities* opent dat record; wat eerder losse actieschermen waren, zijn statussen ervan.

Bovenaan staat altijd hetzelfde formulier: tranche, cyclus, status, expiratie, contracten, ontvangen premie, besluit, exitplan en aandeel van de portefeuille. Daaronder wisselt het beeld met de status:

- **order geplaatst → uitvoering importeren** — het goedgekeurde besluit, het exitplan, de vergelijking met wat Lynx teruggeeft (strike, expiratie, aantal, premie) en de sizing op de portefeuille. Buiten de tolerantie zijn soort en toelichting van de afwijking verplicht.
- **bewaken** — het exitplan als vier regels met hun stand (stop loss ask 60,0 · winstanker · break-even · eventregel), en de gerelateerde lijst **Metingen**: laatprijs, biedprijs, onderliggende, buffer, resultaat en de barometerstand die eruit volgt.
- **uitkomst vastleggen** — wat de koppeling zag, de vier uitkomsten met het voorstel van het systeem, de velden om vast te leggen en wat het vastleggen in gang zet.

Gerelateerde lijsten op de positie: **Metingen · Uitvoeringen · Publicaties · Historie**. Het exitplan staat als velden op het record, niet als aparte tabel: het hoort bij deze ene tranche en wordt vóór de order vastgelegd.

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

**1b · De knop ademt met de stap.** Rechtsboven op het cyclusrecord staat altijd precies één primaire actie: die van de stap waar de cyclus nu in staat. Bij *go / no-go* is dat *Positie blind versturen*, en zodra het quorum gehaald is *Go / no-go meeting*. In fase 1 heeft de stap *instapvoorwaarden* geen eigen actieknop — er valt niets vast te klikken (4.3a). Welke knop er staat komt uit `processtap`, niet uit het scherm.

**1c · De status opent het moment.** Een cyclus op *go / no-go* zetten **ís** het openen van een beoordelingsmoment: het systeem maakt het aan op het moment dat de status verandert, met de datum van vandaag. Er is geen tweede knop die hetzelfde nog eens zegt, en er bestaat geen tussentoestand waarin de cyclus in de stap staat maar er niets onder hangt. Komt er na een no-go een nieuwe ronde, dan geldt hetzelfde: de status terugzetten op *go / no-go* opent een volgend moment.

**2 · De inzendingen staan op de cyclus.** Een inzending is een kindrecord van de cyclus en verschijnt in het tabblad **Inzendingen** op het cyclusrecord — het tabblad dat eerder *Besluiten* heette. Eén regel per deelnemer per beoordelingsmoment, met moment, positie, strike, expiratie, reden en tijdstip. Zolang niet iedereen verstuurd heeft zie je **dát** er verstuurd is, niet **wát**: naam, status en tijdstip zijn open, positie, strike, expiratie en reden zijn dicht. Dat is een **leesregel op de kindtabel**, niet een schermtruc — hij geldt dus ook in de lijst, in een export en in het auditlog.

**3 · Quorum is een instelling, geen aanname.** Hoeveel inzendingen nodig zijn om door te mogen, staat als veld op de **processtap** in Procesbeheer (bijvoorbeeld *2 van 3* als iemand er niet bij kan zijn). Het staat zichtbaar in de kop van de gerelateerde lijst, zodat je ziet waaraan je toe bent. Wordt het quorum gehaald, dan gaan de inzendingen open en verandert de actieknop.

**4 · Go / no-go meeting.** De knop *Go / no-go meeting* opent hetzelfde scherm als bij het versturen — dezelfde tijdlijn, dezelfde voorwaarden, dezelfde technische analyse — maar nu met de gerelateerde lijst *Inzendingen* **open** eronder: ieders positie, strike, expiratie en reden naast elkaar.

**5 · Eén uitkomst, geen tweede ronde.** De tweede inzendronde is vervallen: het gesprek beslist. Onderaan het meetingscherm staat één blok *Uitkomst van het gesprek* — **go** of **no-go**, en bij go de **strike**, de **expiratiedatum** en het aantal contracten, met wat het gesprek veranderde en wie aanwezig waren.

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
- **De breadcrumb draagt zijn filter mee.** Kom je via een cyclus bij een voorwaarde, dan toont *Voorwaarden* in de breadcrumb de voorwaarden van díé cyclus, niet die van alle cycli: de kruimel linkt naar `?fid.<ouderkolom>=<id>` en de lijst opent met dat filter als chip (*Cyclus = 2026-10*). Dat filter is weg te klikken — dan sta je in de volledige lijst — behalve in een gerelateerde lijst, want daar ís het ouderfilter de lijst.
- **Twee soorten filter, en het verschil is bewust.** `f.<kolom>` is wat iemand intypt: vergevingsgezind, *bevat*. `fid.<kolom>` is een vast filter op één verwezen record: precies dat nummer. Een gerelateerde lijst en de breadcrumb gebruiken de tweede soort, zodat 'cyclus 3' nooit per ongeluk cyclus 13 meeneemt.
- **Een regel die een tweede veld eist, blokkeert geen cel.** In de lijst bewerk je één cel tegelijk; een blokkerende regel die een ánder veld verplicht stelt, maakt bewerken dan onmogelijk. Zulke regels zijn **waarschuwingen**: ze verschijnen als melding in het scherm — nooit in een venster van de browser — en de wijziging wordt bewaard. Wat echt niet mag (een verstuurde inzending wijzigen, opslaan op een verouderde revisie) blokkeert wél.
- **Een verwijzing toont een naam, nooit een nummer.** De lijst haalt de titels van de verwezen records in één vraag per kolom op. Stond er een nummer, dan is dat een fout en geen bedoeling.
- **Rijen**: de cellen, zonder selectievakje of info-icoon — die leidden nergens heen. De eerste kolom is een link naar het record; een rij die aandacht vraagt krijgt een zachte gele achtergrond. Dubbelklikken op een cel bewerkt haar ter plekke.
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
- **Paneelkop**: de naam van de lijst één keer — niet nog eens klein herhaald onder het tabblad dat hem al toont — met daarnaast de knop voor de actie van die lijst (*Nieuw*, met de ouder al ingevuld). Staat er maar één gerelateerde lijst en dus geen tabbalk, dan staat de teller wél in de kop.
- **Lege lijst**: *Nog geen voorwaarden* zolang er niet gezocht wordt. Het ouderfilter van een gerelateerde lijst is geen zoekopdracht van de gebruiker en levert dus niet de melding *geen regels die hieraan voldoen*.
- **Tabel** zonder selectievakjes en zonder filterrij — dit is een deellijst binnen één record, geen zelfstandige tabel.

Beide componenten staan als functie in de gedeelde laag. Een nieuw scherm roept die aan en geeft alleen kolommen en rijen mee.

- Drie zones: navigatiekolom links, breadcrumb bovenaan, inhoud daaronder. De navigatie leest `db_module`.
- **De navigatiekolom is een navigator, geen lijstje links.** Bovenaan een **filterveld**: typen zoekt in de naam van de module én van haar groep, laat alleen wat past staan en klapt alles open zolang je typt; Escape maakt het veld leeg. Daaronder per groep een **kop die je open- en dichtklapt** met de modules eronder. Wat iemand dichtlaat staan wordt per persoon onthouden in `gebruiker_voorkeur` (`menu.dicht`). Welke groepen en modules er zijn, blijft `db_module` — dit gaat alleen over hoe ze getoond worden.
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

## 12. Techniek en uitrol

- Nieuwe applicatie naast de bestaande Cockpit, gevoed door dezelfde delta-proxy worker. De huidige tabs blijven draaien; de Market Timing-panelen blijven voorlopig in de oude Cockpit.
- Opslag: Cloudflare D1 naast de bestaande KV.
- Front-end: Vite. Vier componenten dragen het geheel — schil met navigatie en routing, lijst, formulier, veldrenderer. Alles daarbuiten is configuratie.
- Eén datalaagje tussen app en worker, één functie per endpoint.
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
| 11 | Positie en publicatie | Het positierecord met zijn zes stappen en statussen (10.0f), brokerkoppeling, **vergelijking uitkomst ↔ uitvoering met afwijkingsregistratie**, exitplan als velden, tranches, uitkomst vastleggen, communiceren naar leden |
| 11b | Portefeuille | Portefeuille-instellingen, blootstelling en reserve over alle open tranches, sizing als voorwaarde, portefeuillestrook op het overzicht |
| 12 | Dashboard en post-analyse | Het operationele dashboard met zijn vijf toestanden inclusief het terugkijken op een afgesloten cyclus, procesbeheer en Mijn taken als gegroepeerde lijst, positielijst, exitdrempels met quote-toets, maandverslag met toetsing |
| 13 | Barometer en berichten | Afgeleide toestand, endpoint, berichtsjablonen per fase, de klantkolom op het dashboard met voorstel-en-publiceer voor de barometer, automatische controle vóór publicatie |
| 14 | Protocol van het gesprek | Vijf agendablokken, behandeling per event, exitplan als voorwaarde vóór uitvoering, stoploss-vergrendeling, schaduwevaluatie van een no-go |

Na etappe 4 is een echte cyclus volledig vast te leggen. Werken op desktop, iPad en iPhone is een voorwaarde bij elke etappe, geen eigen etappe.

**Overweging:** etappe 14 bevat regels die de besluitvorming bindend maken. Als jullie het protocol vanaf de eerste echte cyclus willen volgen, hoort een deel ervan naar voren — in het bijzonder de drie-go-regel en de verplichte reden bij een no-go, die bij etappe 10 horen in plaats van erna.

**MVP-knip: etappe 0 tot en met 10, zonder 7 en 8.** Dat is een werkende interne applicatie waarin een echte cyclus van openen tot vastgelegde uitkomst wordt vastgelegd, zonder brokerkoppeling en zonder ledencommunicatie. De positie wordt in die fase met de hand ingevoerd, en **de instapvoorwaarden zijn een werklijst die met de hand wordt ingevuld** (4.3a): geen drempels, geen gewichten, geen score, geen vastklikmoment. De rekenlaag erboven — etappes 7 en 8 — is fase 2. Etappe 6 beperkt zich daarmee tot de hartslag en het verversen van het scherm; het koppelen aan de feeds schuift mee naar etappe 11. Etappe 11 wacht op de brokerkoppeling (openstaand punt 6), etappe 13 op de bevestiging over marktdata richting leden (punt 7). Geen van beide vraagt herbouw van wat in 0–10 staat.

---

## 14. Openstaande punten

*Opgelost in versie 1.0: versiebeheer van de rekenlaag (3.4), blootstelling en sizing op portefeuilleniveau (6.1), de handelskalender als tabel (3.2), het splitsen van voorgenomen en uitgevoerde posities (3.3), registratie van afwijking tussen besluit en uitvoering (6), plus de vier standen met "niet gemeten" (4.4), de chartanalyse volgens de metadata-lijn (4.3b) en aanmelden per persoon (1, 11).*

1. **Premie-referentie na een rol** — per tranche, cumulatief, of gesplitst. Voorstel: gesplitst. Blokkeert etappe 12.
2. **Inzet van de tweede tranche** — vast te leggen regel of oordeel per situatie? Blokkeert niets, maar bepaalt of het een voorwaarde wordt.
3. **Staartrisico-tegel** — wel of niet opnemen, en bij welke percentages.
4. **Standaardzwaarte per eventsoort** — beginlijst wordt bij het bouwen ingevuld en daarna bijgesteld.
5. **Maatstaf voor blootstelling** — notioneel (standaard) of de margin die Lynx vasthoudt. Zie 6.1. Te bevestigen met Jacqueline; het is een instelling, geen herbouw.
6. **Brokerkoppeling met Lynx** — besluit plus betaald realtime Eurex-abonnement. Professionele classificatie betekent Eurex Core L2 (€ 67,50) plus STOXX Index Real-Time (€ 19) per maand. Blokkeert etappe 11.
7. **Marktdata richting leden** — bevestiging van LYNX en IBKR vóór etappe 13.
8. **Market Timing-panelen** — blijven voorlopig in de oude Cockpit; verhuizing later te bepalen.
