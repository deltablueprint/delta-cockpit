-- 0067 — 'Inzendingen bespreken' zegt wat er gebeurt
--
-- 'Inzendingen open' beschrijft een toestand van het systeem; bespreken is wat
-- jullie doen. Een fase hoort te heten naar de handeling, niet naar de
-- zichtbaarheid.

update db_choice set label = 'Inzendingen bespreken'
 where tabel = 'beoordelingsmoment' and kolom = 'status' and waarde = 'inzendingen open';

update processtap set fase = 'inzendingen open', stand = 'inzendingen open'
 where proces = 3 and fase = 'inzendingen open';

insert into schema_versie (versie, omschrijving) values (67, 'inzendingen bespreken');
