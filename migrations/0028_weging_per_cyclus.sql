-- 0028 · twee wegingen, elk op zijn eigen plek
--
-- De zwaarte op het event is de algemene startwaarde: een rentebesluit is
-- zwaar, ongeacht welke cyclus loopt. Dat is wat de kalender toont en waarop
-- je filtert.
--
-- De weging binnen een cyclus is iets anders. Dezelfde ECB weegt zwaarder als
-- je expiratie er twee dagen na ligt dan wanneer hij midden in de looptijd
-- valt. Dat oordeel hoort bij de cyclus, niet bij het event — anders verandert
-- het de kalender voor alle cycli, ook die van vorig jaar.
--
-- Daarom: zwaarte_overschreven verdwijnt van het event, en de eventbehandeling
-- krijgt een eigen zwaarte met een reden bij afwijking.

alter table cyclus_event add column zwaarte text;
alter table cyclus_event add column zwaarte_reden text;

-- De weging in een cyclus begint op de algemene zwaarte van het event.
update cyclus_event
   set zwaarte = (select e.zwaarte from event e where e.id = cyclus_event.event)
 where zwaarte is null;

update db_field set actief = 0 where tabel = 'event' and kolom = 'zwaarte_overschreven';
update db_field set label = 'Zwaarte (algemeen)' where tabel = 'event' and kolom = 'zwaarte';

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('cyclus_event','zwaarte','niet gewogen','Niet gewogen',  5, 'grijs'),
  ('cyclus_event','zwaarte','licht',       'Licht',        10, 'grijs'),
  ('cyclus_event','zwaarte','middel',      'Middel',       20, 'oranje'),
  ('cyclus_event','zwaarte','zwaar',       'Zwaar',        30, 'rood');

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, audit, breedte) values
  ('cyclus_event','zwaarte',      'Zwaarte in deze cyclus', 'keuze', 25,'behandeling',1,0,1,'150px'),
  ('cyclus_event','zwaarte_reden','Waarom afwijkend',       'tekst', 26,'behandeling',0,0,1,'240px');

-- Wijkt de weging af van de algemene zwaarte van het event, dan hoort daar een
-- reden bij. Dat kan de regeltaal niet zelf nakijken (hij vergelijkt binnen één
-- record), dus het is een waarschuwing en geen blokkade.
insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('cyclus_event','zwaarte_reden','zwaarte_reden nietleeg_als zwaarte notin niet gewogen',
   'Zet erbij waarom dit event in deze cyclus zo weegt.', 0, 1);

update db_view set kolommen='["event","zwaarte","behandeling","motivering","door","wanneer"]'
 where tabel='cyclus_event' and naam='standaard';

insert into schema_versie (versie, omschrijving) values (28, 'weging per cyclus');
