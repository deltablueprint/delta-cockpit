-- 0084 · het menu-item wijst naar de echte tabel
--
-- Onder GEGEVENS stond 'Chartanalyses', een overblijfsel uit de oude cockpit:
-- een menu-item en een tabeldefinitie voor een tabel die nooit is gebouwd.
-- Klikken gaf een lege of brekende lijst. Nu de technische analyse er wél is,
-- wijst het item daarheen — een overzicht over alle cycli heen, zodat je kunt
-- terugkijken hoe de charts gelezen werden vóór een cyclus die slecht afliep.

update db_module
   set label = 'Technische analyse', doeltabel = 'chartlezing'
 where doeltabel = 'chartanalyse';

-- De tabeldefinitie zonder tabel verdwijnt uit beeld. De rij blijft staan:
-- wissen doen we niet, ook niet in de definitielaag.
update db_table set actief = 0 where naam = 'chartanalyse';

insert into schema_versie (versie, omschrijving) values (84, 'menu wijst naar de technische analyse');
