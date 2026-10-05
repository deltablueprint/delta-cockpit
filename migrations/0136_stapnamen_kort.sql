-- 0136 · een stap heet waar hij over gaat
--
-- 'Technische analyse gelezen' — het werkwoord zei wat de afvinkregel telt, niet
-- waar de stap over gaat. De balk leest als een lijst onderwerpen; dan hoort er
-- een onderwerp te staan. Wat eraan vast zit staat in de uitleg.
update processtap set naam = 'Technische analyse'
 where afvinkregel = 'chartlezing_gedaan';
update db_choice set label = 'Technische analyse'
 where tabel = 'processtap' and kolom = 'afvinkregel' and waarde = 'chartlezing_gedaan';

insert into schema_versie (versie, omschrijving) values (136, 'een stap heet waar hij over gaat');
