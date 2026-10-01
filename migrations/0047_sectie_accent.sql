-- 0047 — Een sectie kan nadruk krijgen
--
-- Op het positieformulier is het besluit niet zomaar de eerste sectie: het is
-- waar de hele tranche uit voortkomt. Dat hoor je te zien zonder te lezen.
-- Welke sectie die nadruk krijgt is definitie, geen opmaak in de code.

alter table db_sectie add column accent integer not null default 0;

update db_sectie set accent = 1 where tabel = 'positie' and naam = 'besluit';

insert into schema_versie (versie, omschrijving) values (47, 'sectie met nadruk');

-- En een standaardwaarde waar de database er al een had, zodat het formulier
-- hetzelfde toont als wat er bij het opslaan gebeurt.
update db_field set standaard = 'handmatig'
 where tabel = 'positie' and kolom = 'herkomst';
