-- 0152 · één bericht over wat er veranderde, met een vaste voet eronder
--
-- Het sjabloon voor de barometer ging alleen over de barometer. Maar een
-- publicatie gaat over één moment: soms verschuift het venster, soms de stand,
-- soms allebei. Eén bericht over dat moment — een lid dat twee berichten krijgt
-- over hetzelfde moment leest het tweede niet meer.
update berichtsjabloon
   set label = 'Stand naar de leden',
       titel = 'Delta Blueprint — {{feiten.wat}}',
       tekst = 'Vanaf vandaag gaat {{feiten.wat}}.

Instap venster: {{feiten.venster_naar}}
Barometer: {{feiten.naar}}

Waarom: {{feiten.reden}}'
 where naam = 'barometer';

-- De voet staat onder elk bericht dat naar de leden gaat, en staat in beheer:
-- de woorden waarmee wij onze leden aanspreken horen niet in de code.
insert into instelling (sleutel, label, waarde, eenheid, uitleg) values
  ('bericht_voettekst', 'Voettekst onder elk bericht',
   'Delta Blueprint deelt kennis en de eigen posities van de oprichters. Dit is geen individueel beleggingsadvies.',
   null,
   'Komt onder elk bericht aan de leden te staan, op het moment dat het concept wordt opgesteld. Verandert de tekst later, dan verandert een al verstuurd bericht niet mee.');

insert into schema_versie (versie, omschrijving) values (152, 'een bericht over de stand, met een vaste voet');
