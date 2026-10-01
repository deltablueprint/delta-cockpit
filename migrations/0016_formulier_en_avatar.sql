-- 0016 · recordformulier, procesbalk en avatars

-- 1. Velden die niet op het formulier horen, maar wel in de database blijven.
--    De verwijzing naar de ouder staat al in de breadcrumb; hem er nog eens
--    als veld bij zetten is ruis.
alter table db_field add column toon_op_formulier integer not null default 1;
update db_field set toon_op_formulier = 0
 where (tabel='voorwaarde'   and kolom='cyclus')
    or (tabel='cyclus_event' and kolom='cyclus');

-- 2. Weg van de cyclus: deelnemers en de fase naar de leden.
update db_field set actief = 0 where tabel='cyclus' and kolom in ('deelnemers','fase');

-- 3. In de lijst komt 'aangemaakt door' in de plaats van deelnemers.
update db_field set breedte='170px', alleen_lezen=1 where tabel='cyclus' and kolom='aangemaakt_door';
update db_view set kolommen='["label","status","geopend_op","doelexpiratie","volgend_analysemoment","resultaat_pt","aangemaakt_door"]'
 where tabel='cyclus' and naam='standaard';

-- 4. Welk veld de procesbalk bovenaan het record tekent. Leeg = geen balk.
alter table db_table add column proces_veld text;
update db_table set proces_veld = 'status' where naam = 'cyclus';

-- 5. Avatars. Een kleine afbeelding als data-URL op het gebruikersrecord;
--    iedereen zet die van zichzelf.
alter table gebruiker add column avatar text;
alter table gebruiker add column kleur text;
update gebruiker set kleur = '#136289' where id='simon';
update gebruiker set kleur = '#1F5E45' where id='jacqueline';
update gebruiker set kleur = '#8A5A12' where id='pieter';

insert into schema_versie (versie, omschrijving) values (16, 'formulier, procesbalk en avatars');
