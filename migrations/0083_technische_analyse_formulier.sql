-- 0083 · het formulier van een technische analyse
--
-- Het stond in twee kolommen met de schermafdruk rechts in een smal vak, en
-- met 'Vaste regel' en 'Volgorde' ertussen — twee velden waar niemand iets mee
-- doet. Wat je hier doet is één ding: kijken naar een chart en opschrijven wat
-- je ziet. Dus één kolom, de afbeelding over de volle breedte, en de lezing
-- eronder.

update db_table set formulier_kolommen = 1 where naam = 'chartlezing';

-- Vaste regel en volgorde zijn boekhouding van het systeem, geen invulwerk.
update db_field set toon_op_formulier = 0
 where tabel = 'chartlezing' and kolom in ('vast', 'volgorde');

update db_field set label = 'Chart',      volgorde = 20 where tabel = 'chartlezing' and kolom = 'onderwerp';
update db_field set label = 'Schermafdruk', volgorde = 30 where tabel = 'chartlezing' and kolom = 'afbeelding';
update db_field set label = 'Wat je erin leest', volgorde = 40 where tabel = 'chartlezing' and kolom = 'commentaar';

-- De vaste regel werd door het systeem aangemaakt en droeg daardoor niemand.
-- Wie de cyclus opende, is degene die deze analyse begon.
update chartlezing
   set aangemaakt_door = (select c.aangemaakt_door from cyclus c where c.id = chartlezing.cyclus)
 where aangemaakt_door is null and cyclus is not null;

insert into schema_versie (versie, omschrijving) values (83, 'formulier van de technische analyse');
