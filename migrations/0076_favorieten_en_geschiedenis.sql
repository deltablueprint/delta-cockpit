-- Favorieten en geschiedenis in de navigator (10.3a en 10.3b).
--
-- Het menu toont wat er ís, niet waar jij elke dag bent. Een favoriet is een
-- bewaarde plek: hij draagt de hele route, dus inclusief filter en sortering.
-- 'Cycli waar ik op wacht' is daarmee een favoriet van één persoon en geen
-- nieuwe module in db_module — de inrichting van het menu blijft van de
-- beheerder.
create table favoriet (
  id        integer primary key autoincrement,
  gebruiker text not null references gebruiker(id),
  label     text not null,
  route     text not null,                    -- zonder '#', inclusief ?filters
  kleur     text not null default 'blauw',
  icoon     text not null default 'lijst',
  volgorde  integer not null default 100,
  archief   integer not null default 0,
  aangemaakt_op text not null default (datetime('now'))
);
create index favoriet_van on favoriet (gebruiker, archief, volgorde);

-- De geschiedenis is een werkspoor, geen bewijsstuk: waar was ik ook alweer.
-- Wie wat veranderde staat in de audit trail en hoort daar. Deze tabel wordt
-- afgekapt — dat is het enige verwijderen in de applicatie, en het verwijdert
-- geen vastlegging maar een hulpmiddel.
create table bezoek (
  id        integer primary key autoincrement,
  gebruiker text not null references gebruiker(id),
  route     text not null,
  titel     text not null,
  soort     text,
  moment    text not null default (datetime('now'))
);
create index bezoek_van on bezoek (gebruiker, id desc);

insert or ignore into schema_versie (versie, omschrijving) values
  (76, 'favorieten en geschiedenis');
