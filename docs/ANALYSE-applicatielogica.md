# Analyse van de applicatielogica

**Delta Blueprint · operationeel dashboard · 29 september 2026**
Beoordeeld tegen BOUWSPEC 0.8 en de zeven mockupschermen.

> **Status 29 september 2026 — verwerkt.** Alle vijf structurele punten en de kleinere correcties zijn opgelost in **BOUWSPEC 1.0**. Per punt staat hieronder waar de oplossing terechtkwam. Eén nieuwe beslissing kwam eruit voort: meten we blootstelling notioneel of op margin (openstaand punt 5).

---

## Oordeel in het kort

De opzet is **robuust in de dingen die er het meest toe doen** en **schaalbaar genoeg voor het doel**. De harde keuzes — geen vrije expressietaal, niets verwijderen, systeem handelt nooit zelf, blind indienen aan de serverkant — zijn precies de keuzes die een systeem als dit overeind houden als het druk wordt.

Er zitten **vijf structurele gaten** in, waarvan drie nu goedkoop te dichten zijn en later duur. Het belangrijkste is niet techniek maar boekhouding: **de configuratie is veranderlijk, maar de historie doet alsof ze vaststaat.**

Wat *niet* het probleem is: volume. Twaalf cycli per jaar, drie gebruikers, een paar duizend metingen per cyclus — D1 draait daar jaren op zonder na te denken.

---

## Wat goed zit

- **Vijf bouwstenen, geen expressietaal.** Een bewuste plafond op complexiteit. Dit is de reden dat het systeem over twee jaar nog te begrijpen is.
- **Een cyclus als boog, niet als kalendermaand.** Het model volgt de werkelijkheid in plaats van de agenda. Wachten als toestand, grens bij de analyse, doorrollen dat de boog verlengt — dat is goed doordacht. *(Bijgesteld na deze analyse: cycli overlappen niet; er staat er hoogstens één open — BOUWSPEC 2.)*
- **`meting` los van `voorwaarde`.** Meetgeschiedenis overleeft een regelwijziging. Veel systemen breken hier.
- **`event` buiten de cyclus, gekoppeld via `cyclus_event`.** Correct genormaliseerd, en het maakt "dezelfde ECB, andere behandeling per cyclus" mogelijk.
- **Blind indienen afgedwongen in de API, niet in het scherm.** De enige juiste plek.
- **Eén formulier met related lists in tabbladen.** Geen schermenexplosie; nieuwe gerelateerde tabellen kosten configuratie, geen bouwwerk.

---

## Structureel beter — op volgorde van belang

### 1. Configuratie is veranderlijk, historie doet alsof ze vaststaat  ·  *opgelost — BOUWSPEC 3.4*

**Wat er misgaat.** `voorwaarde` is per cyclus (goed — dat is al een momentopname). Maar `db_calc`, `db_field`, `db_rule`, de standaardset en de checklistvelden zijn *veranderlijke singletons*. Verander je in maart een gewicht in de standaardset, dan is de score van januari nog steeds 71 — berekend met een regel die niet meer bestaat en die je niet kunt reconstrueren. De audit trail zegt *dát* er iets veranderde, niet *hoe de oude berekening liep*.

**Waarom dat pijn doet.** Precies de vraag waar het systeem voor gebouwd wordt — "werkten onze voorwaarden?" — is dan niet betrouwbaar te beantwoorden. En scores tussen cycli worden onvergelijkbaar zonder dat iemand dat ziet.

**Voorstel.** Geef de definitielaag versies: elke `db_calc`- en standaardsetregel krijgt *geldig vanaf*, en een cyclus pint bij openen een configuratieversie. Dat past bij "niets wordt verwijderd" — een wijziging wordt een nieuwe rij, niet een overschrijving. Bewaar de vastgeklikte voorwaardentabel bovendien als **rijen**, niet als JSON-blob, zodat je erover kunt rapporteren.

### 2. Blootstelling en sizing staan op de cyclus, maar zijn portefeuille-eigenschappen  ·  *opgelost — BOUWSPEC 6.1*

**Wat er misgaat.** `cyclus` draagt *totale blootstelling*, *beschikbare buffer* en *gewenste maximale inzet*. Toen deze analyse geschreven werd mochten cycli elkaar overlappen, en dan denken twee cycli allebei dat er buffer is.

**Nagekomen — de premisse is veranderd, de conclusie niet.** Cycli overlappen inmiddels niet meer (BOUWSPEC 2). Dat haalt één manier weg waarop het misgaat, maar niet de reden om het op de portefeuille te zetten. Binnen één cyclus stapelen tranches op elkaar en verlengt een rol de looptijd, dus “hoeveel staat er nu uit” blijft een som over open tranches en niet één veld op de cyclus. De grens die telt is bovendien de reserve op het totale kapitaal. De oplossing in 6.1 blijft dus staan; alleen het voorbeeld met 2026-09 naast 2026-10 kan niet meer voorkomen.

**Voorstel.** Blootstelling, buffer en sizing berekenen op portefeuilleniveau over álle open tranches, en op de cyclus alleen het *aandeel* tonen. De sizing-regel toetst dan tegen de portefeuille, niet tegen de cyclus. Dit is de gevaarlijkste van de vijf, omdat het fout gaat met echt geld en niemand het merkt tot het te laat is.

### 3. De handelskalender bestaat nergens in het model  ·  *opgelost — `handelsdag` in BOUWSPEC 3.2*

**Wat er misgaat.** Drie voorwaarden rekenen in handelsdagen (snelheid van de daling, resterende looptijd, herstel na een zwaar event) en de betrouwbaarheidstoets kijkt naar handelsuren. Er is geen tabel voor. Dan wordt het code — en daarmee een uitzondering op uitgangspunt 3.

**Voorstel.** `handelsdag` als gewone tabel (datum, open, half day, beurs), gevuld per jaar, aanpasbaar in de interface. Kost een halve dag nu.

### 4. `positie` heeft twee ouders  ·  *opgelost — `voorgenomen_positie` gesplitst, BOUWSPEC 3.2 / 3.3 / 11*

**Wat er misgaat.** Eén tabel die zowel een voorgenomen positie onder een `voorstel` als een uitgevoerde tranche onder een `cyclus` is. Dat betekent nullable vreemde sleutels, en — belangrijker — de **blindering moet ook voor die voorgenomen posities gelden**. Eén endpoint dat posities teruggeeft zonder dat onderscheid, en het blind indienen lekt langs de achterdeur.

**Voorstel.** Twee tabellen, of minimaal een verplicht `soort` met een constraint, en een expliciete testcase: "haal de posities op van een niet-gepubliceerd voorstel van iemand anders" moet leeg teruggeven.

### 5. Geen registratie van afwijking tussen besluit en uitvoering  ·  *opgelost — BOUWSPEC 6*

**Wat er misgaat.** Het besluit legt de goedgekeurde positieparameters vast. De positie komt daarna van de broker en is "daarna de waarheid". Maar niets legt vast dat de uitvoering *afweek* van wat is goedgekeurd — een andere strike, minder contracten, een lagere premie door een slechte fill.

**Voorstel.** Bij het koppelen van de brokerpositie aan het besluit: vergelijk strike, aantal en premie, en bij een materieel verschil een verplicht veld *afwijking en reden*. Zonder dat toetst de post-analyse het besluit tegen een uitvoering die er misschien niet op leek.

### Kleiner, maar nu goedkoop  ·  *alle vijf verwerkt in BOUWSPEC 1.0, behalve de bewaarregel voor `meting` en `audit` en de configuratiediff staging/productie — die horen bij hun eigen etappe*

- **Inconsistentie in de chartanalyse.** De spec zegt tegelijk "vaste kolommen (trend, steun, weerstand, RSI, volume)" én "parameters configureerbaar zonder code". Dat kan niet allebei. Kies de metadata-lijn die overal geldt: `analyseveld` als sjabloon, `chartanalyse_waarde` als waarde per veld, en de lijst rendert zijn kolommen uit het sjabloon.
- **"Niet gemeten" moet algemeen gelden.** Nu staat alleen bij de beoordeling dat ontbrekend of verlopen telt als *niet gemeten, niet als groen*. Maak dat een regel voor élke voorwaarde: zakt een meting door de betrouwbaarheidstoets, dan is de status *niet gemeten*. Anders kan een bevroren feed stilletjes groen blijven.
- **`meting` en `audit` groeien onbegrensd.** Nu een bewaarregel afspreken (ruwe metingen N maanden, daarna dagaggregaten) is een instelling; later is het een migratie.
- **Staging en productie hebben verschillende configuratie.** Bij een metadata-gedreven applicatie is de regel die je test níet de regel die draait. Neem export en import van de definitielaag mee in de uitrol, of minimaal een schermpje dat het verschil tussen staging en productie toont.
- **Eén rol, maar wel aparte identiteiten.** "Iedereen mag alles" is prima bij drie vennoten, maar blind indienen en de audit trail zijn waardeloos als jullie één gedeeld token gebruiken. Per persoon een eigen sleutel, altijd.

---

## Gebruiksvriendelijkheid

### De score is een anker

De score bepaalt niets — drie go's beslissen. Maar hij staat groot bovenaan het go/no-go-scherm, en een getal dat er staat vóórdat iemand zijn voorlopige oordeel geeft, stuurt dat oordeel. Dat is precies wat jullie met blind indienen wilden voorkomen.

**Voorstel:** toon de score pas ná het onthullen, net als de voorstellen zelf. Tot dat moment de voorwaardentabel wel (feiten), de gewogen uitkomst niet (oordeel). Dat kost niets en versterkt het protocol.

### Het meetingscherm wordt vol

Agenda, tijdslijn, zeven voorwaarden, drie oordeelskaarten, uitkomst en vastleggen — dat past op een breed scherm en wordt een lange rol op een telefoon, terwijl het protocol zegt dat de meeting op een telefoon te doen moet zijn.

**Voorstel:** tijdslijn en voorwaardentabel samen als blok *Feiten*, op telefoon ingeklapt met alleen de statusregel zichtbaar. Eén tik om open te klappen. En de voorwaardentabel wordt op smal scherm een kaart per voorwaarde met de status vooraan, niet een tabel die horizontaal schuift.

### "Vastklikken" betekent nu drie dingen

De voorwaardenset vastklikken, de technische analyse vastklikken, een voorstel indienen — drie keer hetzelfde idee met verschillende woorden en verschillende opmaak.

**Voorstel:** één werkwoord, één visueel patroon: een slotje met *vastgeklikt om 17:40 door Pieter*, en overal dezelfde route om het terug te draaien (met reden). Consistentie is hier belangrijker dan de woordkeuze.

### Bij het kiezen van een bron zie je niet wat je kiest

Op het formulier voor een nieuwe voorwaarde is *bron* het veld waar je de fout maakt, en het is een kale keuzelijst.

**Voorstel:** onder de keuzelijst de laatste meting van die bron met tijdstip en versheid. Je ziet meteen of je de goede feed te pakken hebt — en of hij überhaupt loopt.

### Tabbladen verbergen ook

Eén lijst tegelijk is rustig, maar je ziet niet meer in één oogopslag dat een cyclus nog geen exitregels heeft.

**Voorstel:** tellers op alle tabbladen, ook als ze nul zijn (dat is juist de informatie), en lege tabbladen met een eerlijke lege staat plus de knop die hem vult. Een tabblad met duizenden metingen krijgt gewoon het filter en de paginering van de lijstcomponent.

### Eerste keer opstarten

De eerste cyclus start zonder standaardset, zonder events, zonder metingen. Dat is het moment waarop een leeg scherm het meest ontmoedigt.

**Voorstel:** per lege lijst één zin die zegt wat er hoort te staan en één knop die het aanmaakt. Dat is goedkoper dan een handleiding.

---

## Wat ik vóór etappe 1 zou vastleggen — stand van zaken

| # | Punt | Verwerkt in |
| --- | --- | --- |
| 1 | Versiebeheer op de rekenlaag | BOUWSPEC 3.4, `configuratieversie`, etappe 1 |
| 2 | Blootstelling en sizing naar portefeuilleniveau | BOUWSPEC 6.1, `portefeuille_instelling`, etappe 11b |
| 3 | `handelsdag` als tabel | BOUWSPEC 3.2 en 4.5, etappe 1 |
| 4 | `positie` splitsen | BOUWSPEC 3.2 / 3.3, blindering in 11, etappe 10 |
| 5 | Aparte identiteiten per persoon | BOUWSPEC uitgangspunt 8, etappe 1 |

De gebruikspunten hieronder (score als anker, meetingscherm op telefoon, één woord voor vastklikken, bron met laatste meting, tabbladen en lege staten) zijn nog niet verwerkt; die horen bij het bouwen van de betreffende schermen.

---

*Deze analyse beoordeelt de opzet, niet de handelsstrategie. Voor de optiestrategie zelf ligt het oordeel bij Jacqueline. Ik ben geen financieel adviseur en geen jurist; de punten over marktdata en classificatie blijven te bevestigen door LYNX en IBKR.*
