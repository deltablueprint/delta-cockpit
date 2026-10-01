-- 0030 — De configuratieversie hoort niet op het formulier
--
-- Welke versie van de instellingen gold toen deze cyclus liep, is iets wat
-- het systeem vastlegt, niet iets wat iemand invult. Het veld blijft dus
-- bestaan (de audit en de post-analyse hebben het nodig), maar het staat niet
-- langer tussen de velden die je zelf invult.

update db_field set toon_op_formulier = 0, verplicht = 0
 where tabel = 'cyclus' and kolom = 'configuratieversie';

insert into schema_versie (versie, omschrijving) values (30, 'configuratieversie niet op het formulier');
