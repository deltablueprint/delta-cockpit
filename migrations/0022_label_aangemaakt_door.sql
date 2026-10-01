-- 0022 · één label voor wie iets heeft vastgelegd
-- "Door", "Gemeten door" en "Aangemaakt door" stonden door elkaar. Het is
-- overal hetzelfde gegeven: de persoon die deze regel heeft vastgelegd.

update db_field set label = 'Aangemaakt door'
 where type = 'verwijzing' and verwijst_naar = 'gebruiker'
   and kolom in ('door', 'gemeten_door', 'aangemaakt_door');

update db_field set label = 'Aangemaakt op'
 where kolom in ('aangemaakt_op', 'gemeten_op', 'wanneer') and type = 'tijdstip';

insert into schema_versie (versie, omschrijving) values (22, 'label aangemaakt door');
