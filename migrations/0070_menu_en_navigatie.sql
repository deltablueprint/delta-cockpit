-- Elke lijst ook rechtstreeks bereikbaar.
--
-- De terugknop is weg: de breadcrumb is de navigatie. Dan moet elke tabel die
-- als gerelateerde lijst bestaat ook in het menu staan, anders kun je er alleen
-- via een ouderrecord komen. De standaardfilters blijven leeg: wie het hele
-- bestand opvraagt, wil het hele bestand zien.
update db_module set actief = 1 where doeltabel = 'beoordelingsmoment';

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Voorwaarden',           'GEGEVENS',    'voorwaarde',   null, null, 35),
  ('Events in de looptijd', 'GEGEVENS',    'cyclus_event', null, null, 65),
  ('Exitplannen',           'GEGEVENS',    'exitregel',    null, null, 45),
  ('Inzendingen',           'VASTLEGGING', 'inzending',    null, null, 85),
  ('Processtappen',         'BEHEER',      'processtap',   null, null, 115),
  ('Handelsdagen',          'BEHEER',      'handelsdag',   null, null, 155);
