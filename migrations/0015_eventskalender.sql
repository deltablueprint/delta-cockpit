-- 0015 · eventskalender
-- Events staan BUITEN de cycli (BOUWSPEC 3.3). Een cyclus bezit geen events;
-- hij heeft een periode. De behandeling van een event binnen een cyclus staat
-- in cyclus_event, en dat is wat als gerelateerde lijst op de cyclus verschijnt.

create table event (
  id            integer primary key autoincrement,
  datum         text not null,
  tijdstip      text,
  naam          text not null,
  soort         text not null default 'macro',
  zwaarte       text not null default 'middel',
  zwaarte_overschreven integer not null default 0,
  bron          text not null default 'handmatig',
  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create index idx_event_datum on event (datum);

create table cyclus_event (
  id            integer primary key autoincrement,
  cyclus        integer not null references cyclus(id),
  event         integer not null references event(id),
  behandeling   text not null default 'accepteren',
  motivering    text,
  door          text references gebruiker(id),
  wanneer       text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  unique (cyclus, event)
);

insert into db_table (naam, label, label_mv, titel_veld, volgorde) values
  ('cyclus_event', 'Eventbehandeling', 'Events in de looptijd', 'event', 65);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('event','event',       'Event',       10),
  ('event','weging',      'Weging',      20),
  ('event','systeem',     'Systeem',     90),
  ('cyclus_event','algemeen',   'Event',        10),
  ('cyclus_event','behandeling','Behandeling',  20);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('event','soort','macro',      'Macro-economisch', 10, 'grijs'),
  ('event','soort','centrale_bank','Centrale bank',  20, 'blauw'),
  ('event','soort','expiratie',  'Expiratie',        30, 'blauw'),
  ('event','soort','bedrijf',    'Bedrijfscijfers',  40, 'grijs'),
  ('event','soort','politiek',   'Politiek',         50, 'grijs'),
  ('event','soort','anders',     'Anders',           60, 'grijs'),

  ('event','zwaarte','licht',  'Licht',  10, 'grijs'),
  ('event','zwaarte','middel', 'Middel', 20, 'oranje'),
  ('event','zwaarte','zwaar',  'Zwaar',  30, 'rood'),

  ('event','bron','handmatig','Handmatig', 10, 'grijs'),
  ('event','bron','import',   'Import',    20, 'grijs'),

  ('cyclus_event','behandeling','accepteren',       'Accepteren',             10, 'grijs'),
  ('cyclus_event','behandeling','voor_instappen',   'Vóór het event instappen', 20, 'oranje'),
  ('cyclus_event','behandeling','na_instappen',     'Ná het event instappen',        30, 'oranje'),
  ('cyclus_event','behandeling','extra_buffer',     'Extra buffer aanhouden', 40, 'oranje'),
  ('cyclus_event','behandeling','strike_aanpassen', 'Strike of omvang aanpassen', 50, 'oranje'),
  ('cyclus_event','behandeling','uitstellen',       'Uitstellen',             60, 'rood');

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte) values
  ('event','datum',      'Datum',       'datum',  10,'event', 1,0,null,1,'120px'),
  ('event','tijdstip',   'Tijdstip',    'tekst',  20,'event', 0,0,null,1,'90px'),
  ('event','naam',       'Event',       'tekst',  30,'event', 1,0,null,1,'280px'),
  ('event','soort',      'Soort',       'keuze',  40,'event', 1,0,null,1,'160px'),
  ('event','zwaarte',    'Zwaarte',     'keuze',  50,'weging',1,0,null,1,'110px'),
  ('event','zwaarte_overschreven','Zwaarte met de hand gezet','ja_nee',60,'weging',0,0,null,1,'90px'),
  ('event','bron',       'Bron',        'keuze',  70,'weging',0,0,null,0,'110px'),
  ('event','toelichting','Toelichting', 'lang',   80,'event', 0,0,null,0,null),
  ('event','aangemaakt_op','Aangemaakt op','tijdstip',90,'systeem',0,1,null,0,'150px'),
  ('event','aangemaakt_door','Aangemaakt door','verwijzing',100,'systeem',0,1,'gebruiker',0,'120px'),

  ('cyclus_event','cyclus',     'Cyclus',      'verwijzing',10,'algemeen',   1,1,'cyclus',1,'140px'),
  ('cyclus_event','event',      'Event',       'verwijzing',20,'algemeen',   1,0,'event', 1,'260px'),
  ('cyclus_event','behandeling','Behandeling', 'keuze',     30,'behandeling',1,0,null,    1,'230px'),
  ('cyclus_event','motivering', 'Motivering',  'lang',      40,'behandeling',0,0,null,    1,null),
  ('cyclus_event','door',       'Door',        'verwijzing',50,'behandeling',0,1,'gebruiker',1,'110px'),
  ('cyclus_event','wanneer',    'Wanneer',     'tijdstip',  60,'behandeling',0,1,null,    1,'150px');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('event','standaard','["datum","tijdstip","naam","soort","zwaarte","bron"]','datum asc'),
  ('cyclus_event','standaard','["event","behandeling","motivering","door","wanneer"]','id asc');

insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('event','naam','naam nietleeg','Een event heeft een naam nodig.',1,1),
  ('event','datum','datum nietleeg','Een event heeft een datum nodig.',1,1),
  ('cyclus_event','motivering','motivering nietleeg_als behandeling!=accepteren',
     'Leg vast waarom je deze behandeling kiest.',1,1);

insert into schema_versie (versie, omschrijving) values (15, 'eventskalender');
