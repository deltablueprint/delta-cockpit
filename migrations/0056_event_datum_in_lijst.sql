-- 0056 — De datum hoort vooraan bij de events in de looptijd
--
-- Een lijst van events zonder datum is een lijst zonder volgorde: je wilt
-- zien wat er eerst komt. De datum staat op het event; hier komt hij mee als
-- kolom op de behandeling, zodat de lijst erop kan sorteren en zoeken.

alter table cyclus_event add column datum text;

update cyclus_event
   set datum = (select e.datum from event e where e.id = cyclus_event.event)
 where datum is null;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('cyclus_event','datum','Datum','datum',5,'algemeen',0,1,null,0,'120px',1);

update db_view set kolommen = '["datum","event","zwaarte","behandeling","motivering"]', sortering = 'datum asc'
 where tabel = 'cyclus_event' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (56, 'datum bij de events in de looptijd');
