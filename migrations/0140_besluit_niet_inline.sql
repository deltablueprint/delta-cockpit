-- 0140 · een besluit maak je niet in het voorbijgaan
--
-- De toevoegregel is er voor regels die je er even bij typt: een voorwaarde,
-- een event, een chartlezing. Een besluit is dat niet. Het draagt een datum, een
-- uitkomst, een strike, een expiratie en een inzet, en het opent een
-- beoordelingsronde — dat vul je op het formulier in, waar je ziet wat er
-- gevraagd wordt en wat verplicht is. Een halve regel in een lijst zou een half
-- besluit zijn.
alter table db_table add column inline_nieuw integer not null default 1;

update db_table set inline_nieuw = 0 where naam = 'beoordelingsmoment';

insert into schema_versie (versie, omschrijving) values (140, 'een besluit maak je niet in het voorbijgaan');
