-- 0089 · het voornemen: eerst zeggen wat je gaat doen, dan doen
--
-- Rollen gaat snel. Je sluit bij Lynx en opent meteen opnieuw, en daarna moet
-- de cockpit de nieuwe positie dragen voordat je naar de leden publiceert. In
-- die volgorde staat de mens midden in de keten, precies op het drukste moment:
-- handelen, wachten tot het systeem het ziet, duiden, en dan pas publiceren.
--
-- Draai de volgorde om. Je kondigt vooraf aan wat je gaat doen — tien seconden,
-- ook op je telefoon. Daarna hoeft het systeem niet te raden wát er gebeurde:
-- het vergelijkt wat binnenkomt met wat je zei. Dat is een vergelijking en geen
-- interpretatie, en dus betrouwbaar genoeg om vanzelf af te ronden. Past het
-- niet — andere strike, deelvulling, of een sluiting zonder aankondiging — dan
-- valt het terug op duiding achteraf. Dat blijft het vangnet, niet de hoofdweg.
--
-- Een voornemen is een aantekening van jou, geen opdracht aan het systeem. De
-- cockpit plaatst nooit een order en stelt nooit voor om te rollen (hard
-- uitgangspunt 1).

create table voornemen (
  id              integer primary key autoincrement,
  positie         integer not null references positie(id),
  soort           text not null,                 -- rol | terugkopen
  status          text not null default 'aangekondigd',
  nieuwe_strike   real,
  nieuwe_expiratiedatum text,
  aantal          integer,
  reden           text,
  aangekondigd_op text not null default (datetime('now')),
  aangekondigd_door text references gebruiker(id),
  gezien_op       text,                          -- wanneer de sluiting binnenkwam
  uitgevoerd_op   text,                          -- wanneer het rond was
  opvolger        integer references positie(id),
  afwijking       text,                          -- waarom het niet paste
  toelichting     text,
  archief         integer not null default 0,
  revisie         integer not null default 1,
  aangemaakt_op   text not null default (datetime('now'))
);

create index idx_voornemen_positie on voornemen (positie, status);
create index idx_voornemen_open on voornemen (status) where status = 'aangekondigd';

insert into db_table (naam, label, label_mv, titel_veld, volgorde, related_weergave, nieuw_vanuit_lijst)
 values ('voornemen', 'Voornemen', 'Voornemens', 'soort', 27, 'tabbladen', 0);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('voornemen','plan',   'Wat je gaat doen', 10),
  ('voornemen','afloop', 'Hoe het liep',     20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('voornemen','positie',              'Tranche',           'verwijzing', 5,'plan',  1,1,'positie',  1,0,0),
  ('voornemen','soort',                'Wat',               'keuze',     10,'plan',  1,0,null,       1,0,1),
  ('voornemen','nieuwe_strike',        'Nieuwe strike',     'getal',     20,'plan',  0,0,null,       1,0,1),
  ('voornemen','nieuwe_expiratiedatum','Nieuwe expiratie',  'datum',     30,'plan',  0,0,null,       1,0,1),
  ('voornemen','aantal',               'Aantal',            'getal',     40,'plan',  0,0,null,       1,0,1),
  ('voornemen','reden',                'Waarom',            'tekst',     50,'plan',  0,0,null,       1,0,1),
  ('voornemen','status',               'Stand',             'keuze',     60,'afloop',1,1,null,       1,0,1),
  ('voornemen','gezien_op',            'Sluiting gezien',   'tijdstip',  70,'afloop',0,1,null,       0,0,1),
  ('voornemen','uitgevoerd_op',        'Rond op',           'tijdstip',  80,'afloop',0,1,null,       0,0,1),
  ('voornemen','opvolger',             'Nieuwe tranche',    'verwijzing',90,'afloop',0,1,'positie',  1,1,1),
  ('voornemen','afwijking',            'Wat niet paste',    'lang',     100,'afloop',0,1,null,       1,0,1),
  ('voornemen','aangekondigd_op',      'Aangekondigd op',   'tijdstip', 110,'afloop',0,1,null,       0,0,0),
  ('voornemen','aangekondigd_door',    'Aangekondigd door', 'verwijzing',120,'afloop',0,1,'gebruiker',0,1,0),
  ('voornemen','toelichting',          'Toelichting',       'lang',     130,'afloop',0,0,null,       0,0,1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('voornemen','soort','rol',         'Doorrollen',          10,'blauw'),
  ('voornemen','soort','terugkopen',  'Vervroegd terugkopen',20,'blauw'),

  ('voornemen','status','aangekondigd','Aangekondigd', 10,'oranje'),
  ('voornemen','status','uitgevoerd',  'Uitgevoerd',   20,'groen'),
  ('voornemen','status','wijkt af',    'Wijkt af',     30,'rood'),
  ('voornemen','status','ingetrokken', 'Ingetrokken',  40,'grijs');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('voornemen','standaard',
   '["positie","soort","nieuwe_strike","nieuwe_expiratiedatum","aantal","status","uitgevoerd_op"]',
   'aangekondigd_op desc');

update db_table set formulier_kolommen = 1 where naam = 'voornemen';

insert into schema_versie (versie, omschrijving) values (89, 'het voornemen');
