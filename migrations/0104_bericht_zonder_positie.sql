-- 0104 · een bericht hoeft niet over een positie te gaan
--
-- publicatie.positie staat op not null. Dat klopte toen een bericht altijd over
-- één tranche ging: geopend, gesloten. De wachtrij levert nu ook kaarten op die
-- een bericht vragen zonder positie — een barometerstand, een week-update, een
-- maandbericht. Die passen er niet in.
--
-- SQLite kan geen kolom van not null af halen, dus de tabel wordt herbouwd. D1
-- draait met foreign keys aan, en gebeurtenis.publicatie hangt eronder: een DROP
-- van de oudertabel telt dan als het wissen van alle ouderrijen. Vandaar het
-- uitstel. (Zie §12 — dit is de tweede keer dat dit ons kost.)
pragma defer_foreign_keys = on;

create table publicatie_nieuw (
  id            integer primary key autoincrement,
  -- Mag nu leeg zijn. Een bericht over de barometer gaat over de cyclus, niet
  -- over een tranche.
  positie       integer references positie(id),
  cyclus        integer references cyclus(id),
  -- De kaart waar dit bericht uit voortkwam. Zo is achteraf te zien welke vraag
  -- tot welk bericht leidde, zonder dat je het uit de tijdlijn hoeft te raden.
  gebeurtenis   integer references gebeurtenis(id),
  soort         text not null default 'opening',
  status        text not null default 'concept',     -- concept | nalezen | klaar | verstuurd
  titel         text,
  kanaal        text not null default 'leden',
  contract      text,
  strike        real,
  expiratiedatum text,
  aantal        integer,
  premie_pt     real,
  resultaat_pt  real,
  tekst         text,
  -- Nalezen is een stap, geen veld dat je zelf aanvinkt: de vraag komt als
  -- kaart in de wachtrij van de lezer, en pas zijn antwoord vult dit.
  nalezer       text references gebruiker(id),
  nagelezen_op  text,
  verstuurd_op  text,
  verstuurd_door text references gebruiker(id),
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

insert into publicatie_nieuw
  (id, positie, cyclus, soort, status, contract, strike, expiratiedatum, aantal,
   premie_pt, resultaat_pt, tekst, verstuurd_op, verstuurd_door,
   archief, revisie, aangemaakt_op, aangemaakt_door)
select
   id, positie, cyclus, soort, status, contract, strike, expiratiedatum, aantal,
   premie_pt, resultaat_pt, tekst, verstuurd_op, verstuurd_door,
   archief, revisie, aangemaakt_op, aangemaakt_door
from publicatie;

drop table publicatie;
alter table publicatie_nieuw rename to publicatie;

create index publicatie_positie on publicatie (positie, soort);
create index publicatie_open on publicatie (status) where status <> 'verstuurd';
create index publicatie_cyclus on publicatie (cyclus, aangemaakt_op);

pragma defer_foreign_keys = off;

-- ---------------------------------------------------------- definitielaag
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst, verwijst_naar) values
  ('publicatie','titel','Titel','tekst',5,'bericht',0,0,null),
  ('publicatie','kanaal','Kanaal','keuze',6,'bericht',1,1,null),
  ('publicatie','gebeurtenis','Uit de kaart','verwijzing',7,'bericht',0,0,'gebeurtenis'),
  ('publicatie','nalezer','Nagelezen door','verwijzing',60,'feiten',0,0,'gebruiker'),
  ('publicatie','nagelezen_op','Nagelezen op','tijdstip',61,'feiten',0,0,null);

-- positie mag nu leeg blijven, ook op het formulier.
update db_field set verplicht = 0 where tabel = 'publicatie' and kolom = 'positie';
update db_field set alleen_lezen = 1 where tabel = 'publicatie' and kolom in ('gebeurtenis','nalezer','nagelezen_op');

-- De soorten die de wachtrij kan opleveren. De oude twee blijven staan, want
-- berichten die er al zijn dragen ze.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('publicatie','soort','doorrol','Doorrol',30,'blauw'),
  ('publicatie','soort','barometer','Barometerstand',40,'blauw'),
  ('publicatie','soort','week_update','Week-update',50,'grijs'),
  ('publicatie','soort','maandbericht','Maandbericht',60,'grijs'),
  ('publicatie','soort','vrij','Vrij bericht',70,'grijs');

-- Twee standen erbij tussen concept en verstuurd. 'Klaar' bestaat apart van
-- 'verstuurd' omdat nalezen en versturen twee handelingen zijn: iets kan
-- goedgekeurd zijn en toch nog niet weg.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('publicatie','status','nalezen','Ligt bij de nalezer',15,'oranje'),
  ('publicatie','status','klaar','Klaar om te versturen',18,'blauw');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('publicatie','kanaal','leden','Leden',10,'blauw'),
  ('publicatie','kanaal','intern','Intern',20,'grijs');

update db_table set titel_veld = 'titel' where naam = 'publicatie';

insert into schema_versie (versie, omschrijving) values (104, 'een bericht hoeft niet over een positie te gaan');
