-- 0024 · "zwaarte met de hand gezet" verdwijnt van het formulier
-- Het is een gevolg van wat je doet, geen vraag die je zelf beantwoordt: pas
-- je de zwaarte van een geïmporteerd event aan, dan is hij met de hand gezet.
-- De kolom blijft bestaan en wordt door het systeem gevuld; de audit trail
-- laat bovendien zien wie hem wanneer veranderde.

update db_field set toon_op_formulier = 0, alleen_lezen = 1
 where tabel = 'event' and kolom = 'zwaarte_overschreven';

insert into schema_versie (versie, omschrijving) values (24, 'zwaarte met de hand gezet van het formulier');
