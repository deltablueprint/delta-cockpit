-- 0052 — Eén procesmodel over drie records
--
-- De go/no-go verhuist van de cyclus naar het besluit: per tranche een eigen
-- besluit, en de cyclus wordt wat hij werkelijk is — de boog waarin dat
-- meermaals gebeurt. Actieknoppen sturen het proces niet meer aan; de stand
-- volgt uit wat er gebeurd is.
--
--   cyclus    pre-analyse → besluitvorming → in positie → post-analyse → afgesloten
--   besluit   aanwezigen bepalen → blind inzenden → inzendingen open → uitkomst vastgelegd
--   positie   exitplan en order → uitvoering ophalen → publiceren naar leden → bewaken → gesloten

-- ---------------------------------------------------------------- cyclus
update cyclus set status = 'besluitvorming' where status = 'go-nogo';
update cyclus set status = 'in positie' where status = 'uitvoering ophalen';

update db_choice set actief = 0
 where tabel = 'cyclus' and kolom = 'status' and waarde in ('go-nogo', 'uitvoering ophalen');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('cyclus','status','besluitvorming','Besluitvorming',20,'blauw');

update db_choice set volgorde = 30 where tabel='cyclus' and kolom='status' and waarde='in positie';
update db_choice set volgorde = 40 where tabel='cyclus' and kolom='status' and waarde='post-analyse';
update db_choice set volgorde = 50 where tabel='cyclus' and kolom='status' and waarde='afgesloten';

-- ------------------------------------------------------------- besluit
alter table beoordelingsmoment add column soort text not null default 'instap';
alter table beoordelingsmoment add column aanwezigen_ids text;
alter table beoordelingsmoment add column alleen_reden text;
alter table beoordelingsmoment add column inzet_pct_besluit real;

update beoordelingsmoment set status = 'aanwezigen bepalen' where status = 'blind versturen';

update db_choice set actief = 0
 where tabel = 'beoordelingsmoment' and kolom = 'status' and waarde = 'blind versturen';

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('beoordelingsmoment','status','aanwezigen bepalen','Aanwezigen bepalen',5,'grijs'),
  ('beoordelingsmoment','status','blind inzenden','Blind inzenden',10,'blauw'),
  ('beoordelingsmoment','soort','instap','Instap',10,'blauw'),
  ('beoordelingsmoment','soort','rol','Rol',20,'grijs'),
  ('beoordelingsmoment','soort','vervroegd sluiten','Vervroegd sluiten',30,'grijs'),
  ('beoordelingsmoment','soort','afwijken','Afwijken van het exitplan',40,'oranje');

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier, kolom_rechts) values
  ('beoordelingsmoment','soort','Soort besluit','keuze',8,'moment',1,1,null,1,'150px',1,1),
  ('beoordelingsmoment','alleen_reden','Waarom alleen besloten','lang',45,'moment',0,0,null,1,'280px',1,0);

update db_field set label = 'Aanwezigen bij dit besluit' where tabel='beoordelingsmoment' and kolom='aanwezigen';

-- ------------------------------------------------------------- positie
update positie set status = 'exitplan en order' where status in ('besluit goedgekeurd', 'order bij lynx');
update positie set status = 'uitvoering ophalen' where status = 'uitvoering vastgelegd';

update db_choice set actief = 0
 where tabel = 'positie' and kolom = 'status'
   and waarde in ('besluit goedgekeurd', 'order bij lynx', 'uitvoering vastgelegd');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('positie','status','exitplan en order','Exitplan en order',10,'grijs'),
  ('positie','status','uitvoering ophalen','Uitvoering ophalen',20,'blauw');

insert into schema_versie (versie, omschrijving) values (52, 'procesmodel over drie records');
