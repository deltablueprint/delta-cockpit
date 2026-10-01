-- 0006 · e-mailadressen van de co-founders
-- Een toegepaste migratie wordt nooit achteraf gewijzigd; een correctie is
-- een nieuwe migratie. Daarom staat dit los van 0004.
-- Het e-mailadres is voor attributie en berichten, niet voor inloggen:
-- inloggen gaat met een persoonsgebonden sleutel, zonder gebruikersnaam.

update gebruiker set email = 'simon@deltablueprint.nl' where id = 'simon';

insert into schema_versie (versie, omschrijving) values (6, 'e-mailadressen');
