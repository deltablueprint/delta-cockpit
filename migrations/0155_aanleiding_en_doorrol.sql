-- 0155 · altijd naar de leden, en een doorrol noemt beide posities
--
-- Drie dingen die op het scherm niet klopten.
--
-- 1. Een bericht had een kanaal: leden of intern. Intern bestaat niet meer als
--    bestemming — alles wat wij opstellen gaat naar de leden — en een keuze met
--    maar één goed antwoord is een valstrik. De kolom blijft staan (oude rijen
--    blijven leesbaar en de brug filtert er nog op), maar hij staat niet meer op
--    het formulier.
update db_field set actief = 0
 where tabel = 'publicatie' and kolom = 'kanaal';

-- 2. 'Uit de kaart' was onze eigen taal. Wat er staat is waar dit bericht
--    vandaan komt: de aanleiding.
update db_field set label = 'Aanleiding'
 where tabel = 'publicatie' and kolom = 'gebeurtenis';
update db_field set label = 'Aanleiding'
 where tabel = 'barometerstand' and kolom = 'gebeurtenis';

-- 3. Twee velden op het bericht die een doorrol leesbaar maken. Een doorrol
--    hangt aan de sluiting, dus stonden het contract en de strike van de óude
--    positie er — en nergens stond welke positie er dan geopend was. Nu dragen
--    beide kanten hun eigen regel, vastgelegd zoals ze waren toen het bericht
--    werd klaargezet.
alter table publicatie add column gesloten_positie text;
alter table publicatie add column geopende_positie text;

insert into db_field
  (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar)
values
  ('publicatie','gesloten_positie','Gesloten positie','tekst',8,'bericht',0,1,null),
  ('publicatie','geopende_positie','Geopende positie','tekst',9,'bericht',0,1,null);

-- 4. Het doorrolsjabloon noemt de twee posities bij naam, in de titel en in de
--    tekst. 'Van' en 'Naar' lazen als een verhuizing; het is een positie die
--    sluit en een positie die opent.
update berichtsjabloon
   set titel = 'Doorrol: {{feiten.van_contract}} naar {{feiten.naar_contract}}',
       tekst = 'We hebben de positie op {{cyclus.naam}} doorgerold.

Gesloten: {{feiten.van}}
Geopend: {{feiten.naar}}

Waarom: [in één alinea].'
 where naam = 'doorrol';

insert into schema_versie (versie, omschrijving) values (155, 'altijd naar de leden, en een doorrol noemt beide posities');
