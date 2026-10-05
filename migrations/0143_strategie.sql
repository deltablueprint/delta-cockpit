-- 0143 · Gegevens heet Strategie
--
-- 'Gegevens' zei wat het technisch was, niet waar het over gaat. Wat eronder
-- staat — de cycli, de posities, de charts, de events, de besluiten en wat
-- iedereen blind inzond — is samen hoe wij tot een positie komen. Dat is de
-- strategie.
update db_module set groep = 'STRATEGIE' where groep = 'GEGEVENS';

-- Een besluit en de inzendingen eronder horen bij diezelfde gang, niet bij de
-- vastlegging: ze gaan over het bepalen, niet over het bewaren.
update db_module set groep = 'STRATEGIE', volgorde = 80 where doeltabel = 'beoordelingsmoment';

-- De inzendingen hadden nog geen eigen ingang; je kwam er alleen via een
-- besluit. Voor terugkijken over cycli heen is dat te smal.
insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde)
 values ('Inzendingen', 'STRATEGIE', 'inzending', null, null, 85);

insert into schema_versie (versie, omschrijving) values (143, 'gegevens heet strategie');
