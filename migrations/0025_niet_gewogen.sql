-- 0025 · een event zonder zwaarte is niet gewogen, niet "middel"
--
-- De import vulde 'middel' in als het document geen zwaarte meegaf. Daarmee
-- verzon het systeem een oordeel dat niemand gegeven had, en zag je achteraf
-- niet welke events nog gewogen moesten worden. Een ontbrekende zwaarte heet
-- nu wat het is.

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('event','zwaarte','niet gewogen','Niet gewogen', 5, 'grijs'),
  ('event','soort','onbekend','Nog in te delen', 5, 'grijs');

insert into schema_versie (versie, omschrijving) values (25, 'niet gewogen in plaats van middel');
