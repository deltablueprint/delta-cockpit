-- 0092 · de kolom heet 'Beweging'
--
-- 'Veranderd bij Lynx' zei wat er gebeurd was maar las als een zin. De waarde
-- eronder is 'rustig' of '2 ×', en daar hoort één woord bij dat de
-- tegenstelling draagt zonder uitleg: beweging tegenover rust.

update db_field set label = 'Beweging'
 where tabel = 'cyclus' and kolom = 'duiding_open';

insert into schema_versie (versie, omschrijving) values (92, 'de kolom heet Beweging');
