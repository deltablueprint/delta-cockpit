-- 0011 · kolombreedte in de definitielaag
-- De lijst gebruikte de breedte van de inhoud; daardoor viel elke rij anders
-- uit. Breedte hoort bij het veld, niet bij het scherm.

alter table db_field add column breedte text;    -- css-breedte, bv '120px'; leeg = rest van de ruimte

update db_field set breedte = '150px' where tabel='cyclus' and kolom='status';
update db_field set breedte = '110px' where tabel='cyclus' and kolom='geopend_op';
update db_field set breedte = '120px' where tabel='cyclus' and kolom='doelexpiratie';
update db_field set breedte = '170px' where tabel='cyclus' and kolom='volgend_analysemoment';
update db_field set breedte = '150px' where tabel='cyclus' and kolom='resultaat_pt';
update db_field set breedte = '220px' where tabel='cyclus' and kolom='deelnemers';
update db_field set breedte = '90px'  where tabel='cyclus' and kolom='fase';

update db_field set breedte = '110px' where tabel='voorwaarde' and kolom='soort';
update db_field set breedte = '200px' where tabel='voorwaarde' and kolom='bron';
update db_field set breedte = '140px' where tabel='voorwaarde' and kolom='gemeten_waarde';
update db_field set breedte = '130px' where tabel='voorwaarde' and kolom='status';
update db_field set breedte = '110px' where tabel='voorwaarde' and kolom='gemeten_door';
update db_field set breedte = '140px' where tabel='voorwaarde' and kolom='gemeten_op';

insert into schema_versie (versie, omschrijving) values (11, 'kolombreedtes');
