-- 0081 · de eventskalender en de events in de looptijd tonen hetzelfde
--
-- Tot nu toe droeg een event in een cyclus een eigen weging en een eigen
-- behandeling. Dat betekende dat dezelfde dag in de kalender en in de cyclus
-- verschillende dingen kon zeggen, en dat je elk event twee keer moest wegen.
-- Vanaf nu is de kalender de bron: de zwaarte staat daar, en een cyclus neemt
-- hem over zoals hij is. De weging per cyclus en de behandeling verdwijnen.
--
-- Wat erbij komt is 'notities' op het event — wat je over die dag wilt
-- onthouden — en dat reist mee naar de looptijd, zodat beide lijsten dezelfde
-- kolommen en dezelfde inhoud tonen.
--
-- De kolommen zelf blijven bestaan: wat er is vastgelegd, wordt niet gewist
-- (hard uitgangspunt 3). Ze worden alleen niet meer getoond en niet meer
-- gevraagd.

alter table event add column notities text;
alter table cyclus_event add column notities text;
alter table cyclus_event add column soort text;

update cyclus_event
   set soort    = (select e.soort    from event e where e.id = cyclus_event.event),
       notities = (select e.notities from event e where e.id = cyclus_event.event),
       zwaarte  = (select e.zwaarte  from event e where e.id = cyclus_event.event);

-- ---------- de kalender ----------
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst) values
  ('event','notities','Notities','lang',55,'event',0,0,null,1,0);

update db_view set kolommen = '["datum","tijdstip","naam","soort","zwaarte","notities"]'
 where tabel = 'event' and naam = 'standaard';

-- ---------- de looptijd ----------
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst) values
  ('cyclus_event','soort',   'Soort',    'tekst',7,'algemeen',0,1,null,0,0),
  ('cyclus_event','notities','Notities', 'lang', 8,'algemeen',0,1,null,0,0);

-- De zwaarte komt uit de kalender en is hier niet meer te wijzigen.
update db_field set alleen_lezen = 1, label = 'Zwaarte'
 where tabel = 'cyclus_event' and kolom = 'zwaarte';

-- Behandeling, motivering en de reden van een eigen weging worden niet meer
-- gevraagd. Ze blijven in de database staan voor wat er al is vastgelegd.
update db_field set actief = 0
 where tabel = 'cyclus_event' and kolom in ('behandeling','motivering','zwaarte_reden');

update db_view set kolommen = '["datum","event","soort","zwaarte","notities"]', sortering = 'datum asc'
 where tabel = 'cyclus_event' and naam = 'standaard';

-- De processtap die vroeg om elk event te behandelen, vervalt met de
-- behandeling zelf.
update processtap set archief = 1 where afvinkregel = 'events_behandeld';

-- De regel die een motivering eiste bij een afwijkende behandeling, vervalt mee.
update db_rule set versie_tot = (select max(nummer) from configuratieversie)
 where tabel = 'cyclus_event' and voorwaarde like 'motivering nietleeg_als behandeling%'
   and versie_tot is null;

insert into schema_versie (versie, omschrijving) values (81, 'eventskalender en looptijd gelijkgetrokken');
