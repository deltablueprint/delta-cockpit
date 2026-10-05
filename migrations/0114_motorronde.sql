-- 0114 · de motor laat zien dat hij draait
--
-- De cron schreef zijn verslag naar console.log en verder niets. Valt hij om op
-- een zondagnacht, dan merk je dat maandag aan een wachtrij die te leeg is — en
-- een te lege wachtrij ziet eruit als rust. Dat is het verkeerde om niet te
-- kunnen onderscheiden.
--
-- Eén rij per ronde. Niet in de stroom: daar hoort staan wat er in een cyclus
-- gebeurde, niet dat een machine elk uur zijn werk deed (§3.2a). Dit is
-- bedrijfsvoering en hoort apart.
create table motorronde (
  id            integer primary key autoincrement,
  begonnen_op   text not null default (datetime('now')),
  geeindigd_op  text,
  aanleiding    text not null default 'cron',   -- cron | brug | mens
  gelukt        integer not null default 0,
  slagen        integer not null default 0,     -- wat de klok schreef
  gemeld        integer not null default 0,     -- toestanden die kaart werden
  bekeken       integer not null default 0,     -- gebeurtenissen gewogen
  kaarten       integer not null default 0,     -- nieuwe kaarten
  dubbel        integer not null default 0,
  overgeslagen  text,                            -- json: welke definities, en waarom
  fout          text,
  duur_ms       integer
);

create index motorronde_tijd on motorronde (begonnen_op desc);

-- ---------------------------------------------------------- definitielaag
insert into db_table (naam, label, label_mv, titel_veld, volgorde, formulier_kolommen, nieuw_vanuit_lijst)
 values ('motorronde', 'Motorronde', 'Motorrondes', 'aanleiding', 97, 1, 0);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('motorronde','ronde','De ronde',10),
  ('motorronde','uitkomst','Wat hij deed',20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst, alleen_lezen) values
  ('motorronde','begonnen_op','Begonnen','tijdstip',10,'ronde',0,0,1),
  ('motorronde','geeindigd_op','Geeindigd','tijdstip',20,'ronde',0,0,1),
  ('motorronde','aanleiding','Aanleiding','keuze',30,'ronde',0,1,1),
  ('motorronde','gelukt','Gelukt','ja_nee',40,'ronde',0,0,1),
  ('motorronde','duur_ms','Duur (ms)','getal',50,'ronde',0,0,1),
  ('motorronde','slagen','Kalenderslagen','getal',60,'uitkomst',0,0,1),
  ('motorronde','gemeld','Toestanden gemeld','getal',70,'uitkomst',0,0,1),
  ('motorronde','bekeken','Gebeurtenissen bekeken','getal',80,'uitkomst',0,0,1),
  ('motorronde','kaarten','Nieuwe kaarten','getal',90,'uitkomst',0,0,1),
  ('motorronde','dubbel','Al bekend','getal',100,'uitkomst',0,0,1),
  ('motorronde','overgeslagen','Overgeslagen definities','lang',110,'uitkomst',0,0,1),
  ('motorronde','fout','Fout','lang',120,'uitkomst',0,0,1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('motorronde','aanleiding','cron','De klok',10,'grijs'),
  ('motorronde','aanleiding','brug','Een melding van IBKR',20,'blauw'),
  ('motorronde','aanleiding','mens','Met de hand',30,'grijs');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('motorronde','rondes',
   '["begonnen_op","aanleiding","gelukt","kaarten","gemeld","duur_ms","fout"]',
   'begonnen_op desc');

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Motorrondes', 'BEHEER', 'motorronde', null, null, 195);

insert into schema_versie (versie, omschrijving) values (114, 'de motor laat zien dat hij draait');
