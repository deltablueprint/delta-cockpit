-- 0150 · Communicatie staat bovenaan
--
-- De groepen in de navigator staan in de volgorde van hun eerste module. Cycli
-- stond op 10 en Dispatch ook, en bij gelijke nummers beslist de database —
-- dus wisselde de volgorde van de twee groepen zonder reden. Communicatie krijgt
-- zijn eigen reeks onder de tien: daar begint de dag.
update db_module set volgorde = 1 where route = '/werkbank';
update db_module set volgorde = 2 where doeltabel = 'barometerstand';
update db_module set volgorde = 3 where doeltabel = 'gebeurtenis';
update db_module set volgorde = 4 where doeltabel = 'publicatie';
update db_module set volgorde = 5 where route = '/dashboard';

insert into schema_versie (versie, omschrijving) values (150, 'communicatie staat bovenaan');
