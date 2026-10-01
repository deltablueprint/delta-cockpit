-- 0031 — Procesbeheer: proces en processtap
--
-- Alleen het stuk dat etappe 10 nodig heeft: de stappen van het proces
-- Go / no-go, met per stap het label van de actieknop, het scherm waar hij
-- heen gaat, en het quorum. Het quorum is daarmee een instelling en geen
-- aanname in de code (BOUWSPEC 5.3, 10.0e punt 3, 10.4).
--
-- De andere zeven processen uit 10.4 komen later; de tabellen staan er nu,
-- de inhoud groeit mee.

create table proces (
  id            integer primary key autoincrement,
  naam          text not null,
  omschrijving  text,
  toepassing    text,                                  -- op welke tabel het proces loopt
  versie_vanaf  integer not null default 1 references configuratieversie(nummer),
  versie_tot    integer references configuratieversie(nummer),
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create table processtap (
  id            integer primary key autoincrement,
  proces        integer not null references proces(id),
  volgorde      integer not null default 100,
  naam          text not null,
  stand         text,                                  -- bij welke status van het record deze stap hoort
  eigenaar      text not null default 'elke deelnemer',
  verplicht     integer not null default 1,
  afdwingt      text,                                  -- wat de stap afdwingt, in woorden
  actieknop     text,                                  -- label van de knop rechtsboven
  doelscherm    text,                                  -- waar die knop heen gaat
  quorum        integer,                               -- hoeveel deelnemers de stap moeten afronden
  quorum_van    integer,                               -- van hoeveel
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create index processtap_proces on processtap (proces, volgorde);

-- ---------------------------------------------------------------- definitie
update db_table set titel_veld = 'naam', nieuw_vanuit_lijst = 1 where naam = 'proces';
update db_table set titel_veld = 'naam', related_weergave = 'los' where naam = 'processtap';

insert into db_sectie (tabel, naam, label, volgorde) values
  ('proces','algemeen','Proces',10),
  ('proces','geldigheid','Geldigheid',20),
  ('processtap','stap','Stap',10),
  ('processtap','knop','Wat de stap doet',20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('proces','naam',          'Proces',       'tekst',      10,'algemeen',  1,0,null,1,'240px',1),
  ('proces','omschrijving',  'Omschrijving', 'tekst',      20,'algemeen',  0,0,null,1,'340px',1),
  ('proces','toepassing',    'Loopt op',     'tekst',      30,'algemeen',  0,0,null,1,'140px',1),
  ('proces','versie_vanaf',  'Geldig vanaf versie','getal',40,'geldigheid',0,1,null,1,'150px',1),
  ('proces','versie_tot',    'Geldig tot versie',  'getal',50,'geldigheid',0,1,null,1,'150px',1),
  ('proces','aangemaakt_op', 'Aangemaakt op','tijdstip',   90,'geldigheid',0,1,null,0,'150px',1),
  ('proces','aangemaakt_door','Aangemaakt door','verwijzing',91,'geldigheid',0,1,'gebruiker',0,'160px',1),

  ('processtap','proces',    'Proces',       'verwijzing', 10,'stap',      1,1,'proces',1,'200px',0),
  ('processtap','volgorde',  'Volgorde',     'getal',      20,'stap',      1,0,null,1,'100px',1),
  ('processtap','naam',      'Stap',         'tekst',      30,'stap',      1,0,null,1,'260px',1),
  ('processtap','stand',     'Hoort bij status','tekst',   40,'stap',      0,0,null,1,'160px',1),
  ('processtap','eigenaar',  'Eigenaar',     'keuze',      50,'stap',      1,0,null,1,'150px',1),
  ('processtap','verplicht', 'Verplicht',    'ja_nee',     60,'stap',      0,0,null,1,'100px',1),
  ('processtap','afdwingt',  'Wat de stap afdwingt','tekst',70,'stap',     0,0,null,1,'300px',1),
  ('processtap','actieknop', 'Actieknop',    'tekst',      80,'knop',      0,0,null,1,'200px',1),
  ('processtap','doelscherm','Doelscherm',   'tekst',      90,'knop',      0,0,null,1,'160px',1),
  ('processtap','quorum',    'Quorum',       'getal',     100,'knop',      0,0,null,1,'100px',1),
  ('processtap','quorum_van','Van',          'getal',     110,'knop',      0,0,null,1,'90px',1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','eigenaar','elke deelnemer','Elke deelnemer',10,'grijs'),
  ('processtap','eigenaar','simon',         'Simon',        20,'blauw'),
  ('processtap','eigenaar','pieter',        'Pieter',       30,'groen'),
  ('processtap','eigenaar','jacqueline',    'Jacqueline',   40,'paars');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('proces','standaard','["naam","omschrijving","toepassing","versie_vanaf"]','naam asc'),
  ('processtap','standaard','["volgorde","naam","stand","eigenaar","actieknop","quorum"]','volgorde asc');

insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('proces','naam','naam nietleeg','Een proces heeft een naam nodig.',1,1),
  ('processtap','naam','naam nietleeg','Een stap heeft een naam nodig.',1,1);

-- ------------------------------------------------------- het proces zelf
insert into proces (id, naam, omschrijving, toepassing) values
  (1, 'Go / no-go', 'Van blind indienen tot één uitkomst van het gesprek.', 'cyclus');

insert into processtap (proces, volgorde, naam, stand, eigenaar, verplicht, afdwingt, actieknop, doelscherm, quorum, quorum_van) values
  (1, 10, 'Instapvoorwaarden invullen', 'pre-analyse', 'elke deelnemer', 1,
      'In fase 1 met de hand: elke voorwaarde een gemeten waarde en een status. Er wordt niets vastgeklikt.',
      null, null, null, null),
  (1, 20, 'Positie blind versturen', 'go-nogo', 'elke deelnemer', 1,
      'Ieder stuurt zijn eigen oordeel in. Wat erin staat blijft dicht tot het quorum gehaald is.',
      'Positie blind versturen', 'gonogo', 3, 3),
  (1, 30, 'Go / no-go meeting', 'go-nogo', 'jacqueline', 1,
      'Eén uitkomst voor de groep, met wat het gesprek veranderde en wie aanwezig waren.',
      'Go / no-go meeting', 'gonogo', null, null),
  (1, 40, 'Uitvoering ophalen', 'uitvoering ophalen', 'simon', 1,
      'De koppeling leest de uitvoering bij Lynx. Het systeem plaatst nooit zelf een order.',
      null, null, null, null);

insert into schema_versie (versie, omschrijving) values (31, 'procesbeheer: proces en processtap');
