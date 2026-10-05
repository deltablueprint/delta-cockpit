-- 0145 · de handelskalender had geen id, en viel dus om
--
-- 'Handelsdagen' stond sinds 0005 in het menu en gaf elke keer een foutmelding:
-- D1_ERROR: no such column: id. De tabel komt uit 0003, van vóór de generieke
-- lijst, en draagt (datum, beurs) als sleutel. Elk scherm in deze applicatie
-- rekent op één ding: een rij heeft een id. Een tabel die dat niet heeft, heeft
-- geen scherm — dus krijgt hij er een.
--
-- Hij draagt nu ook archief en revisie, zodat archiveren en bewerken in de
-- lijst werken zoals overal elders. (datum, beurs) blijft uniek: twee rijen voor
-- dezelfde dag op dezelfde beurs is een fout, geen keuze.
pragma defer_foreign_keys = on;

create table handelsdag_nieuw (
  id          integer primary key autoincrement,
  datum       text not null,
  beurs       text not null default 'EUREX',
  status      text not null,
  opening     text,
  sluiting    text,
  bron        text not null default 'import',
  toelichting text,
  archief     integer not null default 0,
  revisie     integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  unique (datum, beurs)
);

insert into handelsdag_nieuw (datum, beurs, status, opening, sluiting, bron, toelichting)
  select datum, beurs, status, opening, sluiting, bron, toelichting from handelsdag;

drop table handelsdag;
alter table handelsdag_nieuw rename to handelsdag;

create index idx_handelsdag_status on handelsdag (beurs, status, datum);

pragma defer_foreign_keys = off;

-- De lijst begint bij de eerstvolgende dag, niet bij 2019.
insert into db_view (tabel, naam, kolommen, sortering) values
  ('handelsdag','standaard','["datum","beurs","status","opening","sluiting","bron"]','datum desc');

insert into schema_versie (versie, omschrijving) values (145, 'de handelskalender krijgt een id');
