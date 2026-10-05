-- 0107 · de barometer
--
-- De barometer beantwoordt één vraag: hoeveel aandacht vraagt deze cyclus van
-- een lid. Niet hoe de markt staat — de meeste maanden expireert de optie
-- waardeloos en hoeft er niets te gebeuren, hoe bewogen de markt ook was.
--
-- Het venster staat daarnaast en apart: stappen we in. Dat kan dicht staan
-- terwijl er niets aan de hand is, bijvoorbeeld omdat het kapitaal nog vastzit.
-- Eén meter voor allebei zou moeten liegen zodra die twee uit elkaar lopen.
--
-- Een stand is een rij, geen veld op de cyclus. Twee redenen:
--   - de geschiedenis is het interessante deel. 'Van 5 naar 4 op 12 september,
--     omdat de volatiliteit zakte' is wat je een lid vertelt, niet '4'.
--   - wat wij weten en wat de leden weten lopen uiteen. Een stand is pas bij
--     de leden als het bericht erover verstuurd is, en dat is een eigen moment.
--
-- De stand wordt voorgesteld door het systeem en vastgesteld door een mens. Een
-- getal dat zegt hoeveel aandacht iemand moet geven hoort niet vanzelf te
-- verschijnen zonder dat iemand ernaar gekeken heeft.
create table barometerstand (
  id              integer primary key autoincrement,
  cyclus          integer not null references cyclus(id),
  stand           integer not null,                  -- 1 t/m 5, 1 is rustig
  venster         text not null default 'dicht',     -- open | wacht | dicht
  reden           text,
  -- Waar hij vandaan komt: een voorstel van het systeem dat is overgenomen, of
  -- met de hand gezet. Allebei door een mens bevestigd; dit zegt alleen wie
  -- begon.
  herkomst        text not null default 'mens',      -- voorstel | mens
  gebeurtenis     integer references gebeurtenis(id),
  publicatie      integer references publicatie(id),
  -- Pas als het bericht weg is, weten de leden het. Tot dan is dit leeg en
  -- loopt de achterstand.
  gepubliceerd_op text,
  vastgesteld_op  text not null default (datetime('now')),
  vastgesteld_door text references gebruiker(id),
  archief         integer not null default 0,
  revisie         integer not null default 1,
  aangemaakt_op   text not null default (datetime('now'))
);

create index barometerstand_cyclus on barometerstand (cyclus, vastgesteld_op desc);

-- ---------------------------------------------------------- definitielaag
insert into db_table (naam, label, label_mv, titel_veld, volgorde, formulier_kolommen, nieuw_vanuit_lijst)
 values ('barometerstand', 'Barometerstand', 'Barometer', 'reden', 72, 1, 0);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('barometerstand','stand','De stand',10),
  ('barometerstand','herkomst','Waar hij vandaan komt',20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst, verwijst_naar, alleen_lezen) values
  ('barometerstand','cyclus','Cyclus','verwijzing',10,'stand',1,0,'cyclus',0),
  ('barometerstand','stand','Wat wij vragen','keuze',20,'stand',1,1,null,0),
  ('barometerstand','venster','Het venster','keuze',30,'stand',1,1,null,0),
  ('barometerstand','reden','Waarom','lang',40,'stand',1,0,null,0),
  ('barometerstand','herkomst','Herkomst','keuze',50,'herkomst',0,1,null,1),
  ('barometerstand','gebeurtenis','Uit de kaart','verwijzing',60,'herkomst',0,0,'gebeurtenis',1),
  ('barometerstand','publicatie','Gemeld met','verwijzing',70,'herkomst',0,0,'publicatie',1),
  ('barometerstand','gepubliceerd_op','Bij de leden sinds','tijdstip',80,'herkomst',0,0,null,1),
  ('barometerstand','vastgesteld_op','Vastgesteld op','tijdstip',90,'herkomst',0,0,null,1),
  ('barometerstand','vastgesteld_door','Vastgesteld door','verwijzing',100,'herkomst',0,0,'gebruiker',1);

-- De namen van de standen staan in beheer. Ze gaan naar 412 leden, dus ze gaan
-- nog veranderen, en dat hoort geen deploy te zijn.
--
-- 1 is rustig. Groen op 1 mag hier wel: dit is geen kaart die openstaat maar
-- een toestand, en 'er hoeft niets' is werkelijk in orde.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('barometerstand','stand','1','Niets',10,'groen'),
  ('barometerstand','stand','2','Meekijken',20,'groen'),
  ('barometerstand','stand','3','Volgen',30,'oranje'),
  ('barometerstand','stand','4','Dichtbij blijven',40,'oranje'),
  ('barometerstand','stand','5','Paraat',50,'rood');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('barometerstand','venster','open','Open',10,'groen'),
  ('barometerstand','venster','wacht','Wacht',20,'oranje'),
  ('barometerstand','venster','dicht','Dicht',30,'grijs');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('barometerstand','herkomst','voorstel','Voorstel overgenomen',10,'blauw'),
  ('barometerstand','herkomst','mens','Met de hand gezet',20,'grijs');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('barometerstand','verloop',
   '["cyclus","stand","venster","reden","gepubliceerd_op","vastgesteld_op"]',
   'vastgesteld_op desc');

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Barometer', 'GEGEVENS', 'barometerstand', null, null, 52);

insert into schema_versie (versie, omschrijving) values (107, 'de barometer: wat wij van een lid vragen, los van het venster');
