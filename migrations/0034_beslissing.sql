-- 0034 — 'Positie' heet op de inzending 'Beslissing'
--
-- Een positie is in deze applicatie een uitgevoerde tranche in de markt. Dat
-- woord gebruiken voor het oordeel go of no-go levert twee betekenissen voor
-- hetzelfde woord — en dan weet niemand meer welke bedoeld wordt.

update db_field set label = 'Beslissing' where tabel = 'inzending' and kolom = 'positie';

insert into schema_versie (versie, omschrijving) values (34, 'positie heet beslissing op de inzending');
