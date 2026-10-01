-- 0029 — Nieuw record vanuit de lijst
--
-- Architectuurregel 10.0 zegt: een kindtabel krijgt geen menu-ingang en een
-- kindrecord wordt gemaakt vanuit zijn ouder. Een tabel die wél bovenaan in
-- het menu staat, moet dat knopje juist wel hebben: in de lijst van cycli of
-- events is er geen ouder om vanuit te starten.
--
-- Of een lijst dat knopje toont, is dus geen code maar definitie.

alter table db_table add column nieuw_vanuit_lijst integer not null default 0;

update db_table set nieuw_vanuit_lijst = 1 where naam in ('cyclus', 'event');

insert into schema_versie (versie, omschrijving) values (29, 'nieuw vanuit de lijst');
