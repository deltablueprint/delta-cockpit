-- 0091 · de vlag staat vooraan
--
-- Een signaal hoort het eerste te zijn wat je ziet, niet de derde kolom. Je
-- opent de cyclilijst om te weten of er iets op je ligt te wachten; dat
-- antwoord staat nu links, vóór de naam.

update db_view set kolommen = '["duiding_open","label","status","geopend_op","doelexpiratie","volgend_analysemoment","resultaat_pt","aangemaakt_door"]'
 where tabel = 'cyclus' and naam = 'standaard';

update db_field set volgorde = 1, label = 'Veranderd bij Lynx'
 where tabel = 'cyclus' and kolom = 'duiding_open';

insert into schema_versie (versie, omschrijving) values (91, 'de vlag vooraan in de cyclilijst');
