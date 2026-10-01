-- 0051 — De uitkomst hoort pas bij het eind van een gesprek
--
-- De regel 'leg vast of het een go of een no-go werd' gold altijd, dus ook op
-- een beoordelingsmoment dat nog moet beginnen. Daarmee kon je er geen één
-- meer aanmaken. Hij geldt nu alleen in de stand waarin hij hoort.

update db_rule
   set voorwaarde = 'uitkomst nietleeg_als status = uitkomst vastgelegd'
 where tabel = 'beoordelingsmoment' and kolom = 'uitkomst';

insert into schema_versie (versie, omschrijving) values (51, 'uitkomst pas bij het vastleggen');
