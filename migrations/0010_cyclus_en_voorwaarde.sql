-- 0010 · de eerste twee inhoudelijke tabellen
-- Fase 1: voorwaarden zijn een werklijst met de hand ingevuld (BOUWSPEC 4.3a).
-- Geen drempels, geen gewichten, geen gates, geen score.

create table cyclus (
  id            integer primary key autoincrement,
  label         text not null,
  status        text not null default 'pre-analyse',
  fase          integer not null default 1,
  geopend_op    text not null default (date('now')),
  doelexpiratie text,
  volgend_analysemoment text,
  eerste_instap text,
  afgesloten_op text,
  resultaat_pt  real,
  deelnemers    text,
  configuratieversie integer not null default 1 references configuratieversie(nummer),
  toelichting   text,
  archief       integer not null default 0,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create index idx_cyclus_status on cyclus (status, geopend_op desc);

create table voorwaarde (
  id            integer primary key autoincrement,
  cyclus        integer not null references cyclus(id),
  naam          text not null,
  soort         text not null default 'instap',       -- instap | uitstap
  bron          text,                                  -- waar je gekeken hebt
  gemeten_waarde text,                                 -- als tekst: "2,4 %", "18,4", "0,8x"
  status        text not null default 'niet gemeten',  -- groen | oranje | rood | niet gemeten
  gemeten_door  text references gebruiker(id),
  gemeten_op    text,
  volgorde      integer not null default 100,
  toelichting   text,
  archief       integer not null default 0,
  aangemaakt_op text not null default (datetime('now'))
);

create index idx_voorwaarde_cyclus on voorwaarde (cyclus, soort, volgorde);

-- ---------- keuzelijsten ----------
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('cyclus','status','pre-analyse',        'Pre-analyse',        10, 'blauw'),
  ('cyclus','status','go-nogo',            'Go / no-go',         20, 'blauw'),
  ('cyclus','status','uitvoering ophalen', 'Uitvoering ophalen', 30, 'oranje'),
  ('cyclus','status','in positie',         'In positie',         40, 'groen'),
  ('cyclus','status','post-analyse',       'Post-analyse',       50, 'blauw'),
  ('cyclus','status','afgesloten',         'Afgesloten',         60, 'grijs'),

  ('voorwaarde','soort','instap',  'Instap',  10, 'blauw'),
  ('voorwaarde','soort','uitstap', 'Uitstap', 20, 'grijs'),

  ('voorwaarde','status','groen',       'Groen',        10, 'groen'),
  ('voorwaarde','status','oranje',      'Oranje',       20, 'oranje'),
  ('voorwaarde','status','rood',        'Rood',         30, 'rood'),
  ('voorwaarde','status','niet gemeten','Niet gemeten', 40, 'grijs');

-- ---------- velddefinities ----------
-- audit = 1 betekent: wijzigingen aan dit veld komen in de audit trail (10.0d).
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit) values
  ('cyclus','label',                'Label',                 'tekst',      10,'cyclus',   1,0,null,1),
  ('cyclus','status',               'Status',                'keuze',      20,'cyclus',   1,0,null,1),
  ('cyclus','fase',                 'Fase naar de leden',    'getal',      30,'cyclus',   0,0,null,1),
  ('cyclus','geopend_op',           'Geopend op',            'datum',      40,'cyclus',   1,0,null,1),
  ('cyclus','doelexpiratie',        'Doelexpiratie',         'datum',      50,'looptijd', 0,0,null,1),
  ('cyclus','volgend_analysemoment','Volgend analysemoment', 'datum',      60,'looptijd', 0,0,null,1),
  ('cyclus','eerste_instap',        'Eerste instap',         'datum',      70,'looptijd', 0,1,null,1),
  ('cyclus','afgesloten_op',        'Afgesloten op',         'datum',      80,'looptijd', 0,1,null,1),
  ('cyclus','resultaat_pt',         'Resultaat in punten',   'getal',      90,'uitkomst', 0,1,null,1),
  ('cyclus','deelnemers',           'Deelnemers',            'tekst',     100,'cyclus',   0,0,null,0),
  ('cyclus','configuratieversie',   'Configuratieversie',    'getal',     110,'cyclus',   1,1,null,1),
  ('cyclus','toelichting',          'Toelichting',           'lang',      120,'cyclus',   0,0,null,0),
  ('cyclus','aangemaakt_op',        'Aangemaakt op',         'tijdstip',  130,'systeem',  0,1,null,0),
  ('cyclus','aangemaakt_door',      'Aangemaakt door',       'verwijzing',140,'systeem',  0,1,'gebruiker',0),

  ('voorwaarde','cyclus',         'Cyclus',          'verwijzing', 10,'algemeen',1,1,'cyclus',1),
  ('voorwaarde','naam',           'Voorwaarde',      'tekst',      20,'algemeen',1,0,null,1),
  ('voorwaarde','soort',          'Soort',           'keuze',      30,'algemeen',1,0,null,1),
  ('voorwaarde','bron',           'Waar gekeken',    'tekst',      40,'meting',  0,0,null,1),
  ('voorwaarde','gemeten_waarde', 'Gemeten waarde',  'tekst',      50,'meting',  0,0,null,1),
  ('voorwaarde','status',         'Status',          'keuze',      60,'meting',  1,0,null,1),
  ('voorwaarde','gemeten_door',   'Door',            'verwijzing', 70,'meting',  0,1,'gebruiker',1),
  ('voorwaarde','gemeten_op',     'Wanneer',         'tijdstip',   80,'meting',  0,1,null,1),
  ('voorwaarde','volgorde',       'Volgorde',        'getal',      90,'algemeen',0,0,null,0),
  ('voorwaarde','toelichting',    'Toelichting',     'lang',      100,'meting',  0,0,null,0);

-- ---------- lijstweergaven ----------
insert into db_view (tabel, naam, kolommen, sortering) values
  ('cyclus','standaard',
   '["label","status","geopend_op","doelexpiratie","volgend_analysemoment","resultaat_pt","deelnemers"]',
   'geopend_op desc'),
  ('voorwaarde','standaard',
   '["naam","soort","bron","gemeten_waarde","status","gemeten_door","gemeten_op"]',
   'volgorde asc');

insert into schema_versie (versie, omschrijving) values (10, 'cyclus en voorwaarde');
