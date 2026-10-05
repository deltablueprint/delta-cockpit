-- 0106 · instellingen die in beheer staan
--
-- De achterstand (§3.2f) kleurt om na zoveel uur. Die grens is een keuze van
-- ons, geen natuurwet, en we gaan hem bijstellen zodra we hem een paar cycli
-- gezien hebben. Zoiets hoort niet in de code: dan is bijstellen een deploy.
--
-- Eén tabel voor dat soort getallen. Geen scherm vol knoppen — alleen waarden
-- die we echt gaan draaien, elk met de uitleg erbij waarom hij bestaat. Wie de
-- uitleg niet kan schrijven, heeft de instelling niet nodig.
create table instelling (
  id            integer primary key autoincrement,
  sleutel       text not null,
  label         text not null,
  waarde        text not null,
  eenheid       text,
  uitleg        text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create unique index instelling_sleutel on instelling (sleutel) where archief = 0;

insert into instelling (sleutel, label, waarde, eenheid, uitleg) values
  ('achterstand_amber_uur', 'Achterstand wordt amber na', '24', 'uur',
   'Zolang er minder dan een dag tussen zit is er niets aan de hand: niet elk feit hoort binnen het uur bij de leden te liggen.'),
  ('achterstand_rood_uur', 'Achterstand wordt rood na', '72', 'uur',
   'Drie dagen. Daarna weten de leden iets niet dat wij al drie dagen weten, en dat is geen achterstand meer maar stilte.');

-- ---------------------------------------------------------- definitielaag
insert into db_table (naam, label, label_mv, titel_veld, volgorde, formulier_kolommen, nieuw_vanuit_lijst)
 values ('instelling', 'Instelling', 'Instellingen', 'label', 95, 1, 1);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('instelling','waarde','De instelling',10);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht) values
  ('instelling','sleutel','Sleutel','tekst',10,'waarde',1),
  ('instelling','label','Naam','tekst',20,'waarde',1),
  ('instelling','waarde','Waarde','tekst',30,'waarde',1),
  ('instelling','eenheid','Eenheid','tekst',40,'waarde',0),
  ('instelling','uitleg','Waarom deze bestaat','lang',50,'waarde',1);

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Instellingen', 'INRICHTING', 'instelling', null, null, 95);

insert into schema_versie (versie, omschrijving) values (106, 'instellingen die in beheer staan, niet in de code');
