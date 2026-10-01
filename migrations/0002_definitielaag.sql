-- 0002 · definitielaag
-- De applicatie leest haar eigen vorm uit deze tabellen. Velden, menu's en
-- weergaven worden hier beheerd, niet in code (uitgangspunt 3).

create table configuratieversie (
  nummer        integer primary key,
  aangemaakt_op text not null default (datetime('now')),
  door          text,
  omschrijving  text not null,
  bevroren      integer not null default 0
);

create table db_table (
  naam        text primary key,              -- technische naam, Engels
  label       text not null,                 -- enkelvoud, Nederlands
  label_mv    text not null,                 -- meervoud
  titel_veld  text not null,                 -- welk veld het record benoemt
  archiveerbaar integer not null default 1,
  actief      integer not null default 1,
  volgorde    integer not null default 100
);

create table db_field (
  id          integer primary key autoincrement,
  tabel       text not null references db_table(naam),
  kolom       text not null,
  label       text not null,
  type        text not null,                 -- tekst|lang|getal|bedrag|procent|datum|tijdstip|keuze|verwijzing|ja_nee|bestand
  volgorde    integer not null default 100,
  sectie      text not null default 'algemeen',
  verplicht   integer not null default 0,
  alleen_lezen integer not null default 0,
  standaard   text,
  verwijst_naar text references db_table(naam),   -- bij type verwijzing
  audit       integer not null default 0,     -- logt dit veld in de audit trail (10.0d)
  actief      integer not null default 1,
  unique (tabel, kolom)
);

create table db_choice (
  id        integer primary key autoincrement,
  tabel     text not null,
  kolom     text not null,
  waarde    text not null,
  label     text not null,
  volgorde  integer not null default 100,
  kleur     text,                             -- groen|oranje|rood|blauw|grijs
  actief    integer not null default 1,
  unique (tabel, kolom, waarde)
);

create table db_module (
  id         integer primary key autoincrement,
  label      text not null,
  groep      text not null,                   -- WERKEN|GEGEVENS|VASTLEGGING|BEHEER
  doeltabel  text references db_table(naam),
  route      text,                            -- voor schermen zonder tabel (dashboard, mijn taken)
  standaardfilter text,
  volgorde   integer not null default 100,
  actief     integer not null default 1
);

create table db_view (
  id        integer primary key autoincrement,
  tabel     text not null references db_table(naam),
  naam      text not null default 'standaard',
  kolommen  text not null,                    -- json: lijst van kolomnamen
  sortering text,
  actief    integer not null default 1,
  unique (tabel, naam)
);

-- Rekenlaag: bestaat, wordt in fase 1 niet uitgevoerd (BOUWSPEC 4.3a).
create table db_rule (
  id           integer primary key autoincrement,
  tabel        text not null references db_table(naam),
  kolom        text,
  voorwaarde   text not null,
  melding      text not null,
  blokkeert    integer not null default 1,
  versie_vanaf integer not null references configuratieversie(nummer),
  versie_tot   integer references configuratieversie(nummer)
);

create table db_calc (
  id           integer primary key autoincrement,
  tabel        text not null references db_table(naam),
  kolom        text not null,
  formule      text not null,
  versie_vanaf integer not null references configuratieversie(nummer),
  versie_tot   integer references configuratieversie(nummer)
);

insert into configuratieversie (nummer, door, omschrijving)
values (1, 'systeem', 'startversie — fase 1, geen rekenlaag actief');

insert into schema_versie (versie, omschrijving) values (2, 'definitielaag');
