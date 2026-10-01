-- 0042 — Het exitplan als vier regels onder de positie
--
-- Tijdens de looptijd is het exitplan geen blok velden maar vier afspraken
-- die ieder een eigen stand hebben: geraakt of niet (BOUWSPEC 10.0f, bewaken).
-- Daarom staat het nu als gerelateerde lijst onder de positie, met vier regels
-- die het systeem bij het aanmaken klaarzet.
--
-- Wat niet verandert: het exitplan ligt er vóór de order, en de stoploss wordt
-- tijdens de looptijd niet verruimd (6).

create table exitregel (
  id            integer primary key autoincrement,
  positie       integer not null references positie(id),
  volgorde      integer not null default 10,
  soort         text not null,              -- stoploss | winstanker | break-even | eventregel
  omschrijving  text not null,
  niveau        real,                       -- ask-prijs of indexpunten, waar van toepassing
  eenheid       text,
  stand         text not null default 'niet geraakt',
  geraakt_op    text,
  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create index exitregel_positie on exitregel (positie, volgorde);

insert into db_table (naam, label, label_mv, titel_veld, volgorde, related_weergave, nieuw_vanuit_lijst)
 values ('exitregel', 'Exitregel', 'Exitplan', 'omschrijving', 25, 'tabbladen', 0);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('exitregel','regel','De afspraak',10),
  ('exitregel','stand','Stand',20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('exitregel','positie',     'Positie',      'verwijzing', 5,'regel',1,1,'positie',1,'160px',0),
  ('exitregel','volgorde',    'Volgorde',     'getal',     10,'regel',1,1,null,0,'90px',0),
  ('exitregel','soort',       'Soort',        'keuze',     20,'regel',1,1,null,1,'130px',1),
  ('exitregel','omschrijving','Afspraak',     'tekst',     30,'regel',1,0,null,1,'300px',1),
  ('exitregel','niveau',      'Niveau',       'getal',     40,'regel',0,0,null,1,'110px',1),
  ('exitregel','eenheid',     'Eenheid',      'tekst',     50,'regel',0,1,null,0,'110px',1),
  ('exitregel','stand',       'Stand',        'keuze',     60,'stand',1,0,null,1,'170px',1),
  ('exitregel','geraakt_op',  'Geraakt op',   'tijdstip',  70,'stand',0,0,null,1,'150px',1),
  ('exitregel','toelichting', 'Toelichting',  'lang',      80,'stand',0,0,null,1,'280px',1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('exitregel','soort','stoploss',   'Stoploss',   10,'rood'),
  ('exitregel','soort','winstanker', 'Winstanker', 20,'groen'),
  ('exitregel','soort','break-even', 'Break-even', 30,'grijs'),
  ('exitregel','soort','eventregel', 'Eventregel', 40,'blauw'),
  ('exitregel','stand','niet geraakt',    'Niet geraakt',    10,'grijs'),
  ('exitregel','stand','waarschuwingszone','Waarschuwingszone',20,'oranje'),
  ('exitregel','stand','geraakt',         'Geraakt',         30,'rood'),
  ('exitregel','stand','uitgevoerd',      'Uitgevoerd',      40,'rood'),
  ('exitregel','stand','vervallen',       'Vervallen',       50,'grijs');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('exitregel','standaard','["soort","omschrijving","niveau","eenheid","stand","geraakt_op"]','volgorde asc');

insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('exitregel','omschrijving','omschrijving nietleeg','Een exitregel zegt wat er afgesproken is.',1,1),
  ('exitregel','toelichting','toelichting nietleeg_als stand = uitgevoerd','Leg vast waarom deze regel is uitgevoerd.',1,1);

-- Het exitplan staat niet meer als velden op het positieformulier.
update db_field set actief = 0
 where tabel = 'positie' and kolom in ('stoploss_ask', 'winstanker_pct', 'break_even', 'eventregel');

update db_rule set versie_tot = 1
 where tabel = 'positie' and kolom in ('stoploss_ask', 'eventregel', 'wie_volgt');

insert into schema_versie (versie, omschrijving) values (42, 'exitplan als vier regels');
