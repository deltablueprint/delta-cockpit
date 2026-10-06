-- 0154 · het heet een bericht
--
-- 'Publicatie' is wat je ermee doet, niet wat het is. Overal waar het woord in
-- het werk terugkomt staat al 'bericht': de knop heet *Bericht opstellen*, het
-- scherm /bericht/:id, de sjablonen staan in berichtsjabloon, de voettekst heet
-- bericht_voettekst, en in de app van de leden heet het tabblad Berichten. Eén
-- woord per begrip; dat woord is bericht. De tabel blijft publicatie heten —
-- een tabelnaam is een adres, geen naam, en favorieten en geschiedenis wijzen
-- ernaar.
update db_table set label = 'Bericht', label_mv = 'Berichten' where naam = 'publicatie';
update db_module set label = 'Berichten' where doeltabel = 'publicatie';

-- De lijst was niet aan te klikken: de titelkolom was 'contract', en een
-- barometerbericht heeft geen contract. Dan staat er een streepje waar de link
-- hoort te zitten. De titel is wat een bericht is; die hoort vooraan en draagt
-- de link.
update db_view
   set kolommen = '["titel","soort","status","positie","verstuurd_op","nalezer"]',
       sortering = 'aangemaakt_op desc'
 where tabel = 'publicatie' and naam = 'standaard';

-- Twee labels die niet zeiden wat ze zijn. 'Stand' botst met de stand van de
-- barometer, en 'Waarover' stond boven de soort terwijl waaróver het gaat in de
-- kolom Positie staat.
update db_field set label = 'Status' where tabel = 'publicatie' and kolom = 'status';
update db_field set label = 'Soort'  where tabel = 'publicatie' and kolom = 'soort';
update db_field set label = 'Titel', breedte = '320px' where tabel = 'publicatie' and kolom = 'titel';

-- En de groep leest nu in de volgorde van het werk in plaats van de volgorde
-- waarin de schermen ontstonden: waar je werkt, wat eruit ging, naar wie, en
-- daarna de twee logboeken.
update db_module set volgorde = 1 where route = '/werkbank';          -- Dispatch
update db_module set volgorde = 2 where doeltabel = 'publicatie';      -- Berichten
update db_module set volgorde = 3 where doeltabel = 'lid';             -- Leden
update db_module set volgorde = 4 where doeltabel = 'barometerstand';  -- Barometer
update db_module set volgorde = 5 where doeltabel = 'gebeurtenis';     -- Stroom
update db_module set volgorde = 6 where route = '/dashboard';

insert into schema_versie (versie, omschrijving) values (154, 'het heet een bericht');
