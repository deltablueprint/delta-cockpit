-- 0147 · Strategie op volgorde van het werk
--
-- De volgorde was historisch gegroeid: elke nieuwe ingang kreeg het eerstvolgende
-- nummer. Nu staat hij in de volgorde waarin je er in een cyclus langsloopt —
-- eerst waar het over gaat, dan waarmee je oordeelt, dan wat je besluit, en als
-- laatste het exitplan dat per tranche hangt.
update db_module set volgorde = 10 where doeltabel = 'cyclus';
update db_module set volgorde = 20 where doeltabel = 'positie';
update db_module set volgorde = 30 where doeltabel = 'event';
update db_module set volgorde = 40 where doeltabel = 'voorwaarde';
update db_module set volgorde = 50 where doeltabel = 'chartlezing';
update db_module set volgorde = 60 where doeltabel = 'beoordelingsmoment';
update db_module set volgorde = 70 where doeltabel = 'inzending';
update db_module set volgorde = 80 where doeltabel = 'exitregel';

insert into schema_versie (versie, omschrijving) values (147, 'strategie op volgorde van het werk');
