-- 0032 — Etappe 10: beoordelingsmoment en inzending
--
-- Eén go/no-go op een cyclus is een `beoordelingsmoment`. Wat ieder vooraf
-- blind instuurt is een `inzending`. Twee tabellen en niet één, omdat het
-- oordeel van een persoon iets anders is dan de uitkomst van de groep — en
-- omdat de blindering anders langs de achterdeur kan lekken (BOUWSPEC 3.3).
--
-- De blindering zelf zit niet hier maar in de worker: zolang het quorum niet
-- gehaald is, geeft de API de inhoud van andermans inzending niet terug. Een
-- schermregel die alleen verbergt, is geen afscherming (5.4).

create table beoordelingsmoment (
  id            integer primary key autoincrement,
  cyclus        integer not null references cyclus(id),
  datum         text not null default (date('now')),
  aanleiding    text,
  status        text not null default 'blind versturen',   -- blind versturen | inzendingen open | uitkomst vastgelegd
  quorum_gehaald_op text,
  aanwezigen    text,
  uitkomst      text,                                       -- go | no-go
  strike        real,
  expiratiedatum text,
  aantal_contracten integer,
  wat_veranderde text,
  volgend_moment text,                                      -- bij no-go: wanneer opnieuw
  vastgelegd_door text references gebruiker(id),
  vastgelegd_op text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create table inzending (
  id            integer primary key autoincrement,
  cyclus        integer not null references cyclus(id),
  beoordelingsmoment integer not null references beoordelingsmoment(id),
  deelnemer     text not null references gebruiker(id),
  status        text not null default 'concept',            -- concept | verstuurd
  positie       text,                                        -- go | no-go
  strike        real,
  expiratiedatum text,
  inzet_pct     real,
  reden         text,
  motivering    text,
  intuitie      text,
  wat_ik_zag    text,
  verstuurd_op  text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create unique index inzending_eenmaal on inzending (beoordelingsmoment, deelnemer);
create index inzending_cyclus on inzending (cyclus);
create index beoordelingsmoment_cyclus on beoordelingsmoment (cyclus);

-- ---------------------------------------------------------------- definitie
update db_table set titel_veld = 'datum', related_weergave = 'tabblad' where naam = 'beoordelingsmoment';
update db_table set titel_veld = 'deelnemer', related_weergave = 'tabblad' where naam = 'inzending';
update db_table set proces_veld = 'status' where naam = 'beoordelingsmoment';

-- De go/no-go staat niet als eigen lijst in het menu: je werkt op de cyclus
-- en komt er via de actieknop (10.0e).
update db_module set actief = 0 where doeltabel = 'beoordelingsmoment';

insert into db_sectie (tabel, naam, label, volgorde) values
  ('beoordelingsmoment','moment','Het moment',10),
  ('beoordelingsmoment','uitkomst','Uitkomst van het gesprek',20),
  ('beoordelingsmoment','systeem','Systeem',90),
  ('inzending','oordeel','Mijn oordeel',10),
  ('inzending','positie','Als go: de positie',20),
  ('inzending','toelichting','Toelichting',30),
  ('inzending','systeem','Systeem',90);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('beoordelingsmoment','cyclus',       'Cyclus',        'verwijzing',  5,'moment',  1,1,'cyclus',1,'200px',0),
  ('beoordelingsmoment','datum',        'Datum',         'datum',      10,'moment',  1,0,null,1,'120px',1),
  ('beoordelingsmoment','aanleiding',   'Aanleiding',    'tekst',      20,'moment',  0,0,null,1,'240px',1),
  ('beoordelingsmoment','status',       'Status',        'keuze',      30,'moment',  1,1,null,1,'170px',1),
  ('beoordelingsmoment','quorum_gehaald_op','Quorum gehaald op','tijdstip',40,'moment',0,1,null,1,'150px',1),
  ('beoordelingsmoment','uitkomst',     'Uitkomst',      'keuze',      50,'uitkomst',0,1,null,1,'110px',1),
  ('beoordelingsmoment','strike',       'Strike',        'getal',      60,'uitkomst',0,1,null,1,'100px',1),
  ('beoordelingsmoment','expiratiedatum','Expiratiedatum','datum',     70,'uitkomst',0,1,null,1,'130px',1),
  ('beoordelingsmoment','aantal_contracten','Aantal contracten','getal',80,'uitkomst',0,1,null,1,'140px',1),
  ('beoordelingsmoment','wat_veranderde','Wat het gesprek veranderde','lang',90,'uitkomst',0,1,null,1,'300px',1),
  ('beoordelingsmoment','aanwezigen',   'Aanwezigen',    'tekst',     100,'uitkomst',0,1,null,1,'200px',1),
  ('beoordelingsmoment','volgend_moment','Volgend moment bij no-go','datum',110,'uitkomst',0,1,null,1,'150px',1),
  ('beoordelingsmoment','vastgelegd_door','Vastgelegd door','verwijzing',120,'systeem',0,1,'gebruiker',1,'160px',1),
  ('beoordelingsmoment','vastgelegd_op','Vastgelegd op', 'tijdstip',  130,'systeem',0,1,null,1,'150px',1),
  ('beoordelingsmoment','aangemaakt_op','Aangemaakt op', 'tijdstip',  140,'systeem',0,1,null,0,'150px',1),

  ('inzending','cyclus',        'Cyclus',         'verwijzing',  5,'oordeel',    1,1,'cyclus',1,'200px',0),
  ('inzending','beoordelingsmoment','Beoordelingsmoment','verwijzing',6,'oordeel',1,1,'beoordelingsmoment',1,'150px',0),
  ('inzending','deelnemer',     'Deelnemer',      'verwijzing', 10,'oordeel',    1,1,'gebruiker',1,'170px',1),
  ('inzending','status',        'Status',         'keuze',      20,'oordeel',    1,1,null,1,'120px',1),
  ('inzending','positie',       'Positie',        'keuze',      30,'oordeel',    0,0,null,1,'110px',1),
  ('inzending','strike',        'Strike',         'getal',      40,'positie',    0,0,null,1,'100px',1),
  ('inzending','expiratiedatum','Expiratiedatum', 'datum',      50,'positie',    0,0,null,1,'130px',1),
  ('inzending','inzet_pct',     'Inzet in % van het kapitaal','getal',60,'positie',0,0,null,1,'140px',1),
  ('inzending','reden',         'Reden bij no-go','tekst',      70,'toelichting',0,0,null,1,'240px',1),
  ('inzending','motivering',    'Motivering',     'lang',       80,'toelichting',0,0,null,1,'300px',1),
  ('inzending','intuitie',      'Intuïtieve waarneming','lang', 90,'toelichting',0,0,null,1,'240px',1),
  ('inzending','wat_ik_zag',    'Wat ik zag in de markt','lang',100,'toelichting',0,0,null,1,'240px',1),
  ('inzending','verstuurd_op',  'Verstuurd op',   'tijdstip',  110,'systeem',    0,1,null,1,'150px',1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('beoordelingsmoment','status','blind versturen',   'Blind versturen',    10,'blauw'),
  ('beoordelingsmoment','status','inzendingen open',  'Inzendingen open',   20,'oranje'),
  ('beoordelingsmoment','status','uitkomst vastgelegd','Uitkomst vastgelegd',30,'groen'),
  ('beoordelingsmoment','uitkomst','go',    'Go',    10,'groen'),
  ('beoordelingsmoment','uitkomst','no-go', 'No-go', 20,'rood'),
  ('inzending','status','concept',  'Concept',  10,'grijs'),
  ('inzending','status','verstuurd','Verstuurd',20,'blauw'),
  ('inzending','positie','go',    'Go',    10,'groen'),
  ('inzending','positie','no-go', 'No-go', 20,'rood');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('beoordelingsmoment','standaard','["datum","status","uitkomst","strike","expiratiedatum","aantal_contracten","vastgelegd_door"]','datum desc'),
  ('inzending','standaard','["deelnemer","status","positie","strike","expiratiedatum","inzet_pct","reden","verstuurd_op"]','deelnemer asc');

insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('inzending','positie','positie nietleeg','Kies go of no-go voor je verstuurt.',1,1),
  ('inzending','reden','reden nietleeg_als positie = no-go','Een no-go heeft een reden nodig.',1,1),
  ('inzending','strike','strike nietleeg_als positie = go','Bij een go hoort een strike.',1,1),
  ('inzending','expiratiedatum','expiratiedatum nietleeg_als positie = go','Bij een go hoort een expiratiedatum.',1,1),
  ('beoordelingsmoment','uitkomst','uitkomst nietleeg','Leg vast of het een go of een no-go werd.',1,1);

insert into schema_versie (versie, omschrijving) values (32, 'etappe 10: beoordelingsmoment en inzending');
