-- 0018 · importeren uit een document
-- Welke tabellen een importknop krijgen, staat in de definitielaag. Zo is het
-- later aanzetten voor een andere tabel een regel hier en geen codewijziging.

alter table db_table add column import_toegestaan integer not null default 0;
update db_table set import_toegestaan = 1 where naam = 'event';

insert into schema_versie (versie, omschrijving) values (18, 'importeren uit een document');
