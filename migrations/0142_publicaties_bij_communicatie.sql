-- 0142 · publicaties horen bij de communicatie
--
-- Ze stonden onder VASTLEGGING, bij de besluiten en de maandverslagen. Maar een
-- publicatie is geen vastlegging van wat wij besloten: het is wat de leden te
-- lezen kregen. Dat is dezelfde familie als Dispatch, de barometer en de stroom.
update db_module set groep = 'COMMUNICATIE', volgorde = 35 where doeltabel = 'publicatie';

insert into schema_versie (versie, omschrijving) values (142, 'publicaties horen bij de communicatie');
