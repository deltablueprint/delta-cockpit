-- 0019 · welke velden live meelopen
-- Alleen een veld met live = 1 wordt ververst, en krijgt een hartslagje naast
-- zijn waarde. In fase 1 staat er nog niets op 1: er zijn geen feeds, dus er
-- valt niets te verversen en er hoort niets te bewegen op het scherm.
-- Vanaf etappe 11 krijgen bied- en laatprijs deze vlag.

alter table db_field add column live integer not null default 0;

insert into schema_versie (versie, omschrijving) values (19, 'live velden');
