-- 0138 · opslaan brengt je terug, en een tweede knop houdt je aan het werk
--
-- Een chartlezing vul je er een paar achter elkaar in. Vandaag blijf je na
-- opslaan op het record staan en moet je zelf terug naar de cyclus, naar het
-- tabblad, naar Nieuw. Drie handelingen om hetzelfde nog eens te doen.
--
-- Drie vlaggen in de definitielaag, want dit is gedrag per tabel en geen
-- uitzondering in een scherm:
--   na_opslaan        'ouder' = na opslaan terug naar het record waar het onder hangt
--   opslaan_en_nieuw   1 = naast Opslaan staat 'Opslaan en nieuw'
--   bijlageknop        0 = geen bijlageknop op dit record
alter table db_table add column na_opslaan text;
alter table db_table add column opslaan_en_nieuw integer not null default 0;
alter table db_table add column bijlageknop integer not null default 1;

-- De chartlezing draagt zijn afbeelding in het record zelf; een losse bijlage
-- ernaast zou een tweede plek zijn waar hetzelfde kan staan.
update db_table set na_opslaan = 'ouder', opslaan_en_nieuw = 1, bijlageknop = 0
 where naam = 'chartlezing';

insert into schema_versie (versie, omschrijving) values (138, 'opslaan en nieuw');
