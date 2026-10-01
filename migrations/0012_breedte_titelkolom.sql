-- 0012 · breedte van de titelkolom
-- De titelkolom nam alle overgebleven ruimte. Elke kolom krijgt nu een breedte;
-- wat overblijft gaat naar een lege kolom rechts, zoals in een gewone lijst.

update db_field set breedte = '240px' where tabel='cyclus'     and kolom='label';
update db_field set breedte = '260px' where tabel='voorwaarde' and kolom='naam';
update db_field set breedte = '200px' where tabel='cyclus'     and kolom='deelnemers';

insert into schema_versie (versie, omschrijving) values (12, 'breedte titelkolom');
