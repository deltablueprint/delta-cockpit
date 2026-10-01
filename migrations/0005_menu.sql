-- 0005 · tabeldefinities en menu
-- Het menu komt uit db_module, niet uit code. Een tabel toevoegen aan het menu
-- is een regel hier, geen uitrol.

insert into db_table (naam, label, label_mv, titel_veld, volgorde) values
  ('cyclus',                'Cyclus',            'Cycli',              'label',      10),
  ('positie',               'Positie',           'Posities',           'contract',   20),
  ('voorwaarde',            'Voorwaarde',        'Voorwaarden',        'naam',       30),
  ('standaardvoorwaarde',   'Standaardvoorwaarde','Standaardset',      'naam',       40),
  ('chartanalyse',          'Chartanalyse',      'Chartanalyses',      'titel',      50),
  ('event',                 'Event',             'Eventskalender',     'naam',       60),
  ('meting',                'Meting',            'Metingen',           'bron',       70),
  ('beoordelingsmoment',    'Beoordelingsmoment','Besluiten',          'datum',      80),
  ('inzending',             'Inzending',         'Inzendingen',        'deelnemer',  90),
  ('publicatie',            'Publicatie',        'Publicaties',        'titel',     100),
  ('maandverslag',          'Maandverslag',      'Maandverslagen',     'titel',     110),
  ('proces',                'Proces',            'Processen',          'naam',      120),
  ('processtap',            'Processtap',        'Stappen',            'naam',      130),
  ('portefeuille_instelling','Portefeuille-instelling','Portefeuille', 'geldig_vanaf',140),
  ('publicatiesjabloon',    'Publicatiesjabloon','Publicatiesjablonen','naam',      150),
  ('audit',                 'Auditregel',        'Auditlog',           'wanneer',   160),
  ('gebruiker',             'Gebruiker',         'Rollen en toegang',  'naam',      170),
  ('handelsdag',            'Handelsdag',        'Handelsdagen',       'datum',     180);

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Operationeel dashboard', 'WERKEN',      null,                     '/dashboard', null,            10),
  ('Mijn taken',             'WERKEN',      null,                     '/taken',     null,            20),

  ('Cycli',                  'GEGEVENS',    'cyclus',                 null,         'jaar = 2026',   30),
  ('Posities',               'GEGEVENS',    'positie',                null,         'open',          40),
  ('Chartanalyses',          'GEGEVENS',    'chartanalyse',           null,         null,            50),
  ('Eventskalender',         'GEGEVENS',    'event',                  null,         'komend',        60),
  ('Metingen',               'GEGEVENS',    'meting',                 null,         null,            70),

  ('Besluiten',              'VASTLEGGING', 'beoordelingsmoment',     null,         'jaar = 2026',   80),
  ('Publicaties',            'VASTLEGGING', 'publicatie',             null,         null,            90),
  ('Maandverslagen',         'VASTLEGGING', 'maandverslag',           null,         null,           100),

  ('Procesbeheer',           'BEHEER',      'proces',                 null,         'actief',       110),
  ('Standaardset',           'BEHEER',      'standaardvoorwaarde',    null,         'actief',       120),
  ('Bouwstenen',             'BEHEER',      null,                     '/bouwstenen',null,           130),
  ('Portefeuille',           'BEHEER',      'portefeuille_instelling',null,         null,           140),
  ('Publicatiesjablonen',    'BEHEER',      'publicatiesjabloon',     null,         null,           150),
  ('Auditlog',               'BEHEER',      'audit',                  null,         null,           160),
  ('Tabellen en velden',     'BEHEER',      null,                     '/metadata',  null,           170),
  ('Rollen en toegang',      'BEHEER',      'gebruiker',              null,         null,           180);

insert into schema_versie (versie, omschrijving) values (5, 'tabeldefinities en menu');
