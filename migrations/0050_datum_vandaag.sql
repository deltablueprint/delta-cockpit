-- 0050 — Een datum die vandaag is, hoef je niet in te typen
--
-- De definitielaag kende alleen vaste standaardwaarden. Twee woorden komen er
-- bij: 'vandaag' en 'nu'. Zo blijft het een instelling en geen regel code per
-- veld.

update db_field set standaard = 'vandaag'
 where tabel = 'beoordelingsmoment' and kolom = 'datum';

insert into schema_versie (versie, omschrijving) values (50, 'standaardwaarde vandaag');
