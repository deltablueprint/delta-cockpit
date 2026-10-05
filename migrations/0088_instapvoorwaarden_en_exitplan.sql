-- 0088 · voorwaarden zijn instapvoorwaarden; het exitplan hoort bij de tranche
--
-- Een voorwaarde en een exitregel lijken op elkaar maar doen iets anders. Een
-- voorwaarde is een waarneming: je kijkt, je schrijft op wat je zag, je zet er
-- een kleur bij, en daarna gebeurt er niets meer mee. Een exitregel is een
-- afspraak met een drempel die blijft lopen — ze kan geraakt worden, ze mag
-- nooit verruimd worden, ze wordt herberekend als de ontvangen premie wijzigt,
-- en de herkenning aan het einde van een tranche leest haar om een terugkoop te
-- duiden. Ze hangen ook aan iets anders: een voorwaarde aan de cyclus, een
-- exitregel aan de tranche — rol je door, dan krijgt tranche 2 een eigen
-- stoploss tegen een eigen premie.
--
-- Wat wél dubbel was: `voorwaarde.soort = 'uitstap'`, een overblijfsel van
-- vóór het exitplan bestond. Geen worker en geen scherm deed er iets mee, maar
-- je kon een uitstapafspraak op twee plekken vastleggen zonder dat iemand wist
-- welke telde. Die keuze gaat eruit.
--
-- Niets wordt gewist: bestaande uitstaprijen blijven staan en blijven leesbaar.

update db_choice set actief = 0
 where tabel = 'voorwaarde' and kolom = 'soort' and waarde = 'uitstap';

-- Met één soort valt er niets meer te kiezen: het veld verdwijnt van het
-- formulier en uit de lijst.
update db_field set toon_op_formulier = 0, verplicht = 0
 where tabel = 'voorwaarde' and kolom = 'soort';

update db_view set kolommen = '["naam","bron","gemeten_waarde","status","gemeten_door","gemeten_op"]'
 where tabel = 'voorwaarde' and naam = 'standaard';

update db_table set label = 'Instapvoorwaarde', label_mv = 'Instapvoorwaarden'
 where naam = 'voorwaarde';

update db_module set label = 'Instapvoorwaarden' where doeltabel = 'voorwaarde';

-- Het exitplan krijgt zijn ingang in het menu terug. In 0073 ging die eruit,
-- met een goed argument: een exitregel buiten zijn tranche zegt niets — je
-- leest 'niet geraakt' zonder te zien waarvan. Dat argument vervalt nu de
-- kolom 'Tranche' erbij staat. En het overzicht dat je dan krijgt is precies
-- wat je wilt op een dag dat de markt beweegt: welke stoplossen lopen er, en
-- welke zijn geraakt.
update db_module set actief = 1 where doeltabel = 'exitregel';

-- In dat overzicht hoort erbij te staan om welke tranche het gaat; op de
-- tranche zelf is dat overbodig en staat de kolom er dus niet.
update db_view set kolommen = '["positie","soort","omschrijving","niveau","eenheid","stand","geraakt_op"]'
 where tabel = 'exitregel' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (88, 'instapvoorwaarden en exitplan uit elkaar');
