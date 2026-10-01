-- 0004 · gebruikers en persoonsgebonden sleutels
-- Authenticatie is per persoon; er is geen gedeelde sleutel (BOUWSPEC 11).
-- De sleutel zelf staat nergens: alleen de SHA-256 hash ervan.
-- Alle co-founders hebben gelijke rechten (uitgangspunt 4); de audit trail
-- draagt daardoor het volledige gewicht.

create table gebruiker (
  id            text primary key,
  naam          text not null,
  korte_naam    text not null,
  email         text,
  sleutel_hash  text,                      -- sha-256, hex, kleine letters
  actief        integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

insert into gebruiker (id, naam, korte_naam, email) values
  ('simon',      'Simon De Jonghe', 'Simon',      'dejonghe.simon@gmail.com'),
  ('jacqueline', 'Jacqueline',      'Jacqueline', null),
  ('pieter',     'Pieter',          'Pieter',     null);

insert into schema_versie (versie, omschrijving) values (4, 'gebruikers en sleutels');
