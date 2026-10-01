-- 0008 · aanmelden met e-mailadres plus wachtwoord
-- Vervangt het schema waarin één sleutel tegelijk identiteit én wachtwoord was.
-- Het e-mailadres is nu de gebruikersnaam; het wachtwoord staat er los van en
-- kan gewijzigd worden zonder dat de identiteit verandert.

create unique index idx_gebruiker_email on gebruiker (email) where email is not null;

-- Veldnaam volgt de nieuwe betekenis: dit is de hash van een wachtwoord,
-- niet van een sleutel die ook als identiteit dient.
alter table gebruiker rename column sleutel_hash to wachtwoord_hash;

alter table gebruiker add column wachtwoord_gezet_op text;

insert into schema_versie (versie, omschrijving) values (8, 'aanmelden met e-mailadres en wachtwoord');
