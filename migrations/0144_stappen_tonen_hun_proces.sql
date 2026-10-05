-- 0144 · een stap zegt bij welk proces hij hoort
--
-- De lijst Stappen toont er zeventien door elkaar: de cyclus, het besluit, de
-- positie en de publicatie hebben elk hun eigen gang, maar in de lijst staan ze
-- op volgorde van hun nummer. Twee stappen met volgorde 50 uit twee processen
-- staan dan onder elkaar zonder dat je ziet dat ze niets met elkaar te maken
-- hebben. Het proces hoort vooraan, en de sortering volgt hem.
update db_view
   set kolommen = '["proces","volgorde","naam","stand","eigenaar","actieknop","quorum"]',
       sortering = 'proces asc, volgorde asc'
 where tabel = 'processtap' and naam = 'standaard';

-- Bouwstenen was een scherm uit de tijd dat de rekenlaag nog in fase 1 zou
-- komen. Die laag is fase 2; tot dan staat er een ingang naar niets.
update db_module set actief = 0 where route = '/bouwstenen';

insert into schema_versie (versie, omschrijving) values (144, 'een stap zegt bij welk proces hij hoort');
