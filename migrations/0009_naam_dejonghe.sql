-- 0009 · schrijfwijze van de naam
-- DeJonghe is één woord.

update gebruiker set naam = 'Simon DeJonghe' where id = 'simon';

insert into schema_versie (versie, omschrijving) values (9, 'schrijfwijze naam Simon DeJonghe');
