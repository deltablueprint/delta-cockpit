-- 0021 · tijdzones bij events
--
-- Een event heeft een tijdstip in zíjn eigen tijdzone: de Fed kondigt aan om
-- 14:00 in Washington, de ECB om 14:15 in Frankfurt. In de lijst tonen we
-- altijd de tijd in Brussel (CET/CEST), omdat dat de tijd is waarop wij handelen.
--
-- Het omrekenen gebeurt bij het tonen, niet bij het opslaan. De Verenigde
-- Staten verzetten de klok op andere data dan Europa, dus in maart en november
-- zijn er weken waarin 14:00 in Washington gelijkstaat aan 19:00 in Brussel in
-- plaats van 20:00. Wie de omgerekende tijd zou opslaan, zou die weken missen.

alter table event add column tijdzone text not null default 'Europe/Brussels';

-- Het tijdstip is geen gewone tekst meer maar een tijd met zone.
update db_field set type = 'tijd', label = 'Tijdstip (lokaal)' where tabel='event' and kolom='tijdstip';

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, audit, breedte)
values ('event','tijdzone','Tijdzone','keuze',25,'event',1,0,1,'190px');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('event','tijdzone','Europe/Brussels',  'Brussel / Frankfurt (CET)', 10, 'grijs'),
  ('event','tijdzone','America/New_York', 'New York / Washington',     20, 'grijs'),
  ('event','tijdzone','Europe/London',    'Londen',                    30, 'grijs'),
  ('event','tijdzone','Asia/Tokyo',       'Tokio',                     40, 'grijs'),
  ('event','tijdzone','UTC',              'UTC',                       50, 'grijs');

update db_view set kolommen='["datum","tijdstip","naam","soort","zwaarte","bron"]'
 where tabel='event' and naam='standaard';

-- De Fed-besluiten stonden opgeslagen als 20:00 alsof dat Brusselse tijd was.
-- Dat is 14:00 in Washington; zo hoort het te staan, met zijn eigen zone.
update event set tijdstip = '14:00', tijdzone = 'America/New_York'
 where naam like 'Fed-rentebesluit%';

insert into schema_versie (versie, omschrijving) values (21, 'tijdzones bij events');
