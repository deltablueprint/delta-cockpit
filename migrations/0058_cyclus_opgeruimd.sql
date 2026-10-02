-- 0058 — De cyclus zonder systeemsectie
--
-- Wanneer een record is aangemaakt, staat in de audit trail. Wie het aanmaakte
-- hoort wél bij de cyclus zelf — dat is een gewoon feit over deze cyclus — en
-- verhuist dus naar boven, onder 'geopend op'.

update db_field
   set sectie = 'cyclus', volgorde = 45, kolom_rechts = 1, toon_op_formulier = 1
 where tabel = 'cyclus' and kolom = 'aangemaakt_door';

update db_field set toon_op_formulier = 0
 where tabel = 'cyclus' and kolom = 'aangemaakt_op';

-- 'Geopend op' staat rechts, met 'aangemaakt door' eronder.
update db_field set kolom_rechts = 1 where tabel = 'cyclus' and kolom = 'geopend_op';
update db_field set kolom_rechts = 0 where tabel = 'cyclus' and kolom in ('label', 'status', 'toelichting');

insert into schema_versie (versie, omschrijving) values (58, 'cyclusformulier opgeruimd');
