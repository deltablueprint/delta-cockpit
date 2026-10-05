-- 0129 · de sjablonen vullen weer in
--
-- Drie plaatshouders wezen naar kolommen die niet bestaan. Wat niet ingevuld
-- kan worden valt weg — met opzet, want accolades in een bericht lezen als een
-- storing — maar daardoor ging er een bericht naar de leden met "Premie:
-- punten" erin, en merkte niemand dat.
--
--   {{positie.premie}}        → ontvangen_premie_pt
--   {{positie.onderliggend}}  → bestaat niet op positie; de cyclus draagt de naam
--   {{volgende.naam}}         → er is geen tweede positie in de gegevens
--
-- Het doorrolsjabloon noemt voortaan de twee contracten uit de feiten van de
-- kaart; die zet de werkbank erin.
update berichtsjabloon
   set tekst = replace(tekst, '{{positie.premie}}', '{{positie.ontvangen_premie_pt}}')
 where tekst like '%{{positie.premie}}%';

update berichtsjabloon
   set titel = replace(titel, '{{positie.onderliggend}}', '{{cyclus.naam}}'),
       tekst = replace(tekst, '{{positie.onderliggend}}', '{{cyclus.naam}}')
 where naam = 'doorrol';

update berichtsjabloon
   set tekst = replace(tekst, '{{volgende.naam}}', '{{feiten.naar}}')
 where naam = 'doorrol';

insert into schema_versie (versie, omschrijving) values (129, 'de sjablonen vullen weer in');
