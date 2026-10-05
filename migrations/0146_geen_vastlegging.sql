-- 0146 · Inzendingen stond er twee keer
--
-- 0070 zette 'Inzendingen' onder VASTLEGGING. 0143 hernoemde GEGEVENS naar
-- STRATEGIE en voegde daar een eigen ingang toe — zonder te zien dat die al
-- bestond, onder een groep die de hernoeming niet raakte. Resultaat: twee keer
-- dezelfde tabel in het menu, en een groep VASTLEGGING die alleen nog die
-- dubbele droeg.
--
-- De oudste rij blijft, want daar hangen favorieten en geschiedenis aan; de
-- dubbele die 0143 maakte gaat eruit. Met die ene regel verdwijnt de groep
-- VASTLEGGING vanzelf: een groep is niets meer dan wat eronder staat.
delete from db_module
 where doeltabel = 'inzending'
   and id > (select min(id) from db_module where doeltabel = 'inzending');

update db_module set groep = 'STRATEGIE', volgorde = 85 where doeltabel = 'inzending';

-- En de instellingen krijgen geen toevoegregel. De code leest vijf vaste
-- sleutels; een zesde erbij typen levert een rij op die niemand uitleest.
update db_table set inline_nieuw = 0 where naam = 'instelling';

insert into schema_versie (versie, omschrijving) values (146, 'inzendingen stond er twee keer');
