-- 0137 · de status staat naast de voorwaarde
--
-- De status stond onder het kopje 'Meting', terwijl er niets meer gemeten wordt
-- (0135). Je las dus eerst de voorwaarde, dan een kopje dat nergens meer over
-- ging, en dáár stond het enige dat je moest zetten. Hij hoort rechts naast de
-- voorwaarde: twee dingen, één regel.
update db_field set sectie = 'algemeen', volgorde = 25, kolom_rechts = 1
 where tabel = 'voorwaarde' and kolom = 'status';

-- Wat overblijft onder het tweede kopje is waar je gekeken hebt en wat je
-- ervan vond. Dat is geen meting; dat is een notitie.
update db_sectie set label = 'Notitie'
 where tabel = 'voorwaarde' and naam = 'meting';

insert into schema_versie (versie, omschrijving) values (137, 'de status staat naast de voorwaarde');
