-- 0062 — Een inzending is van jou
--
-- Je vult je eigen oordeel in; de deelnemer hoeft dus niet gekozen te worden
-- en hoort ook niet gekozen te kunnen worden. 'ik' is daarmee een
-- standaardwaarde in de definitielaag, naast 'vandaag' en 'nu'.

update db_field set standaard = 'ik', alleen_lezen = 1
 where tabel = 'inzending' and kolom = 'deelnemer';

insert into schema_versie (versie, omschrijving) values (62, 'deelnemer ben jij');
