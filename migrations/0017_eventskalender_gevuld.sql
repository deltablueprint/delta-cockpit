-- 0017 · eventskalender gevuld, oktober 2026 tot en met december 2027
--
-- Bronnen, zodat elke datum na te lezen is:
--   ECB-rentebesluiten   ecb.europa.eu — dag 2 van de monetairbeleidsvergadering
--   Fed-rentebesluiten   federalreserve.gov — dag 2 van de FOMC-vergadering
--   Expiraties           derde vrijdag van de maand (Eurex-regel), berekend
--
-- Inflatiecijfers en PMI's staan er NIET in: hun publicatiedata liggen pas
-- enkele maanden vooruit vast. Die importeer je met scripts/events-naar-sql.mjs
-- zodra je ze hebt, of je voegt ze met de hand toe.
--
-- De zwaarte is een beginwaarde. Wie hem aanpast, zet zwaarte_overschreven
-- op ja, zodat zichtbaar blijft dat het een menselijk oordeel is.

insert into event (datum, tijdstip, naam, soort, zwaarte, bron, toelichting) values
  ('2026-10-16', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2026-10-28', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2026-10-29', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2026-11-20', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2026-12-09', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2026-12-17', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2026-12-18', '12:00', 'Maandexpiratie OESX · kwartaal', 'expiratie', 'zwaar', 'import', 'derde vrijdag; kwartaalexpiratie'),
  ('2027-01-15', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-01-27', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-02-04', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-02-19', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-03-17', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-03-18', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-03-19', '12:00', 'Maandexpiratie OESX · kwartaal', 'expiratie', 'zwaar', 'import', 'derde vrijdag; kwartaalexpiratie'),
  ('2027-04-16', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-04-28', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-04-29', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-05-21', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-06-09', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-06-10', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-06-18', '12:00', 'Maandexpiratie OESX · kwartaal', 'expiratie', 'zwaar', 'import', 'derde vrijdag; kwartaalexpiratie'),
  ('2027-07-16', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-07-22', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-07-28', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-08-20', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-09-09', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-09-15', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-09-17', '12:00', 'Maandexpiratie OESX · kwartaal', 'expiratie', 'zwaar', 'import', 'derde vrijdag; kwartaalexpiratie'),
  ('2027-10-15', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-10-27', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-10-28', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-11-19', '12:00', 'Maandexpiratie OESX', 'expiratie', 'middel', 'import', 'derde vrijdag'),
  ('2027-12-08', '20:00', 'Fed-rentebesluit (FOMC)', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de vergadering · bron: federalreserve.gov'),
  ('2027-12-16', '14:15', 'ECB-rentebesluit', 'centrale_bank', 'zwaar', 'import', 'dag 2 van de monetairbeleidsvergadering · bron: ecb.europa.eu'),
  ('2027-12-17', '12:00', 'Maandexpiratie OESX · kwartaal', 'expiratie', 'zwaar', 'import', 'derde vrijdag; kwartaalexpiratie');

insert into schema_versie (versie, omschrijving) values (17, 'eventskalender gevuld tot eind 2027');
