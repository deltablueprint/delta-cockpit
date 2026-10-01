-- 0014 · wat het recordscherm en het schrijven nodig hebben

-- 1. Hoe een record zijn gerelateerde lijsten toont.
--    tabbladen  → zoals het cyclusrecord (BOUWSPEC 10.0)
--    onder_elkaar → zoals het beoordelingsmoment, waar de voortgang zichtbaar
--    moet blijven (10.0e). Een instelling, geen herbouw.
alter table db_table add column related_weergave text not null default 'tabbladen';

-- 2. Secties op het formulier krijgen een label en een volgorde.
create table db_sectie (
  id       integer primary key autoincrement,
  tabel    text not null references db_table(naam),
  naam     text not null,
  label    text not null,
  volgorde integer not null default 100,
  unique (tabel, naam)
);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('cyclus','cyclus',  'Cyclus',   10),
  ('cyclus','looptijd','Looptijd en expiraties', 20),
  ('cyclus','uitkomst','Uitkomst', 30),
  ('cyclus','systeem', 'Systeem',  90),
  ('voorwaarde','algemeen','Voorwaarde', 10),
  ('voorwaarde','meting',  'Meting',     20);

-- 3. Botsingsdetectie: elk record draagt een revisie (BOUWSPEC 11).
--    Wie opslaat met een verouderde revisie krijgt het record terug in plaats
--    van andermans werk te overschrijven.
alter table cyclus     add column revisie integer not null default 1;
alter table voorwaarde add column revisie integer not null default 1;

-- 4. Validatieregels. De voorwaarde is bewust klein gehouden:
--    "<veld> <operator> <veld of waarde>", met leeg / nietleeg als losse vorm.
insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('cyclus','label',        'label nietleeg',                 'Een cyclus heeft een label nodig.', 1, 1),
  ('cyclus','doelexpiratie','doelexpiratie > geopend_op',     'De doelexpiratie ligt vóór de dag waarop de cyclus geopend is.', 1, 1),
  ('cyclus','volgend_analysemoment','volgend_analysemoment >= geopend_op', 'Het analysemoment ligt vóór de opening van de cyclus.', 1, 1),
  ('voorwaarde','naam',     'naam nietleeg',                  'Een voorwaarde heeft een naam nodig.', 1, 1),
  ('voorwaarde','gemeten_waarde','gemeten_waarde nietleeg_als status!=niet gemeten',
     'Zet de gemeten waarde erbij, of laat de status op "niet gemeten" staan.', 0, 1);

insert into schema_versie (versie, omschrijving) values (14, 'recordscherm, secties, revisie en validatieregels');
