-- 0054 — De twee handelingen die alleen een mens kan bevestigen
--
-- Dat de order bij Lynx staat en dat het bericht naar de leden uit is, kan het
-- systeem niet zien. Die twee vinkt een mens aan; alles eromheen volgt daaruit.

alter table positie add column order_geplaatst integer not null default 0;
alter table positie add column order_op text;
alter table positie add column gepubliceerd integer not null default 0;
alter table positie add column gepubliceerd_op text;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier, kolom_rechts) values
  ('positie','order_geplaatst','Order staat bij Lynx','ja_nee',90,'tranche',0,0,null,1,'150px',1,1),
  ('positie','order_op','Order geplaatst op','tijdstip',91,'tranche',0,1,null,1,'150px',0,1),
  ('positie','gepubliceerd','Bericht naar de leden verstuurd','ja_nee',360,'uitvoering',0,0,null,1,'180px',1,1),
  ('positie','gepubliceerd_op','Gepubliceerd op','tijdstip',361,'uitvoering',0,1,null,1,'150px',0,1);

insert into schema_versie (versie, omschrijving) values (54, 'order en publicatie als handeling');
