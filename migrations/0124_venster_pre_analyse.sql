-- 0124 · de eerste vensterstand heet pre-analyse
--
-- 'Gesloten' was het woord van de oude schaal, waar het venster een schakelaar
-- was. In een verloop klopt het niet: de eerste stand is geen deur die dicht zit
-- maar de fase waarin we aan het kijken zijn. En het is precies het woord dat de
-- cyclus zelf al gebruikt, dus een lid dat beide ziet leest hetzelfde.
--
-- De waarde gaat mee, niet alleen het label. Een sleutel die 'gesloten' heet en
-- 'Pre-analyse' toont, is een val voor wie er over een jaar naar kijkt.
update db_choice set waarde = 'pre_analyse', label = 'Pre-analyse'
 where tabel = 'barometerstand' and kolom = 'venster' and waarde = 'gesloten';

update barometerstand set venster = 'pre_analyse' where venster = 'gesloten';

update processtap
   set aanleiding = replace(aanleiding, 'else ''gesloten''', 'else ''pre_analyse''')
 where kaartsoort = 'venster';

insert into schema_versie (versie, omschrijving) values (124, 'de eerste vensterstand heet pre-analyse');
