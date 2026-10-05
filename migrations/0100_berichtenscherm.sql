-- 0100 · het scherm 'Klaar voor de leden'
--
-- Het staat onder WERKEN, naast de posities zonder cyclus: het is geen tabel om
-- in te kijken maar iets wat op je ligt te wachten. De tabel Publicaties blijft
-- onder VASTLEGGING staan voor wat al verstuurd is.

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Klaar voor de leden', 'WERKEN', null, '/berichten', null, 25);

insert into schema_versie (versie, omschrijving) values (100, 'scherm klaar voor de leden');
