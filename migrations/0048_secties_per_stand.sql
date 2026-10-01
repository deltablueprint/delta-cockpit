-- 0048 — Een sectie hoort bij een stand, niet bij elk scherm
--
-- Op een tranche die net uit een besluit komt, staan *De uitvoering* en
-- *Uitkomst* leeg te wachten op iets wat nog niet gebeurd is. Dat is geen
-- informatie maar ruis. Een sectie zegt nu zelf bij welke standen ze hoort;
-- staat er niets, dan hoort ze overal.
--
-- Ook weg: de sectie *Systeem* op de positie. Wanneer en door wie een record
-- is aangemaakt staat in de audit trail; op het formulier van een lopende
-- tranche voegt het niets toe.

alter table db_sectie add column standen text;

update db_sectie set standen = 'order bij lynx,uitvoering vastgelegd,publiceren naar leden,bewaken,gesloten'
 where tabel = 'positie' and naam = 'uitvoering';

update db_sectie set standen = 'bewaken,gesloten'
 where tabel = 'positie' and naam = 'einde';

-- De toelichting hoort bij de tranche zelf; de rest van 'Systeem' verdwijnt.
update db_field set sectie = 'tranche', volgorde = 80, kolom_rechts = 1
 where tabel = 'positie' and kolom = 'toelichting';

update db_field set toon_op_formulier = 0
 where tabel = 'positie' and kolom in ('aangemaakt_op', 'aangemaakt_door');

insert into schema_versie (versie, omschrijving) values (48, 'secties per stand');
