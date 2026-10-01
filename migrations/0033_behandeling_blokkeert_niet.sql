-- 0033 — Een regel over een tweede veld mag een cel niet op slot zetten
--
-- In de lijst bewerk je één cel tegelijk. Een blokkerende regel die een
-- ánder veld verplicht stelt, maakt bewerken daarmee onmogelijk: je kiest
-- een behandeling, en het systeem weigert omdat de motivering nog leeg is —
-- die je in diezelfde handeling niet kunt invullen.
--
-- Dat past ook niet bij fase 1: de behandeling is een werklijst en er gaat
-- niets op slot (4.3a). De regel blijft dus staan, maar als herinnering.

update db_rule set blokkeert = 0,
       melding = 'Zet er nog bij waarom je deze behandeling kiest.'
 where tabel = 'cyclus_event' and kolom = 'motivering';

insert into schema_versie (versie, omschrijving) values (33, 'behandeling blokkeert niet');

-- En: naar welk event een regel verwijst, ligt vast zodra de regel bestaat.
-- Dat veld hoort dus niet als invulveld op het formulier te staan — zeker
-- niet als nummer.
update db_field set alleen_lezen = 1 where tabel = 'cyclus_event' and kolom = 'event';
