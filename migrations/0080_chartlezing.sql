-- 0080 · de chartlezing bij een gesprek
--
-- Op het meetingscherm staat de technische analyse over de volle breedte: één
-- regel per chart, met een schermafdruk en wat je erin leest. De eerste regel
-- ligt vast — Moving Average 8, 20, 50 — zodat elk gesprek met dezelfde blik
-- begint en twee cycli naast elkaar te leggen zijn. Daaronder mag je zelf
-- regels toevoegen voor wat je verder wilt laten zien.
--
-- De afbeelding staat als data-URL in de kolom, net als een avatar: de browser
-- verkleint hem eerst. Dat is geen eindstation — zodra er een R2-bucket is,
-- verhuizen de afbeeldingen daarheen en blijft hier alleen de verwijzing over.

create table chartlezing (
  id            integer primary key autoincrement,
  beoordelingsmoment integer not null references beoordelingsmoment(id),
  onderwerp     text not null,
  vast          integer not null default 0,   -- 1 = hoort er altijd te staan
  afbeelding    text,                          -- data:image/jpeg;base64,…
  commentaar    text,
  volgorde      integer not null default 100,
  archief       integer not null default 0,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create index idx_chartlezing_moment on chartlezing (beoordelingsmoment, volgorde, id);

insert into db_table (naam, label, label_mv, titel_veld, volgorde) values
  ('chartlezing', 'Chartlezing', 'Chartlezingen', 'onderwerp', 67);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('chartlezing','algemeen','Lezing',  10),
  ('chartlezing','systeem', 'Systeem', 90);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst) values
  ('chartlezing','beoordelingsmoment','Gesprek',    'verwijzing', 10,'algemeen',1,1,'beoordelingsmoment',1,1),
  ('chartlezing','onderwerp',         'Onderwerp',  'tekst',      20,'algemeen',1,0,null,1,0),
  ('chartlezing','afbeelding',        'Schermafdruk','bestand',   30,'algemeen',0,0,null,0,0),
  ('chartlezing','commentaar',        'Wat je leest','lang',      40,'algemeen',0,0,null,1,0),
  ('chartlezing','vast',              'Vaste regel','ja_nee',     50,'algemeen',0,1,null,0,0),
  ('chartlezing','volgorde',          'Volgorde',   'getal',      60,'algemeen',0,0,null,0,0),
  ('chartlezing','aangemaakt_op',     'Aangemaakt op',  'tijdstip',  80,'systeem',0,1,null,0,0),
  ('chartlezing','aangemaakt_door',   'Aangemaakt door','verwijzing',90,'systeem',0,1,'gebruiker',0,1);

insert into db_view (tabel, naam, kolommen, sortering) values
  ('chartlezing','standaard','["onderwerp","commentaar","aangemaakt_door","aangemaakt_op"]','volgorde asc');

insert into schema_versie (versie, omschrijving) values (80, 'chartlezing bij het gesprek');
