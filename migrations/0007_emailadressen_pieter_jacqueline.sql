-- 0007 · e-mailadressen van Pieter en Jacqueline

update gebruiker set email = 'pieter@deltablueprint.nl'     where id = 'pieter';
update gebruiker set email = 'jacqueline@deltablueprint.nl' where id = 'jacqueline';

insert into schema_versie (versie, omschrijving) values (7, 'e-mailadressen Pieter en Jacqueline');
