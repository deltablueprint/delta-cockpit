-- 0001 · fundament
-- Bewijst dat migraties lopen. De definitietabellen komen in etappe 1.

create table if not exists schema_versie (
  versie      integer primary key,
  toegepast_op text not null default (datetime('now')),
  omschrijving text not null
);

insert or ignore into schema_versie (versie, omschrijving)
values (1, 'fundament: lege database, migraties werken');
