-- 0013 · audit trail
-- Elke wijziging aan een inhoudelijke tabel laat een spoor na (BOUWSPEC 10.0d).
-- Append-only: regels worden nooit gewijzigd of verwijderd.
--   soort = veld        → één veldwijziging, met oude en nieuwe waarde
--   soort = gebeurtenis → een handeling die geen veld is (aangemaakt,
--                         gearchiveerd, gedupliceerd, gepubliceerd)

create table audit (
  id          integer primary key autoincrement,
  wanneer     text not null default (datetime('now')),
  wie         text references gebruiker(id),
  tabel       text not null,
  record      integer not null,
  soort       text not null,            -- veld | gebeurtenis
  veld        text,
  oude_waarde text,
  nieuwe_waarde text,
  gebeurtenis text,
  reden       text
);

create index idx_audit_record on audit (tabel, record, id desc);
create index idx_audit_wanneer on audit (wanneer desc);

insert into schema_versie (versie, omschrijving) values (13, 'audit trail');
