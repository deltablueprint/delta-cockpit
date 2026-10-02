-- 0061 — Een besluit openen vraagt niets vooraf
--
-- Alles wat een nieuw besluit nodig heeft, weet het systeem al: de cyclus, de
-- datum van vandaag, het soort en de eerste stand. Dan is een leeg formulier
-- met een knop *Aanmaken* een extra handeling zonder inhoud. Of een tabel zo
-- werkt, is een eigenschap van de tabel.

alter table db_table add column nieuw_direct integer not null default 0;

update db_table set nieuw_direct = 1 where naam = 'beoordelingsmoment';

-- De kolomstandaard in de database kende de oude stand nog.
update beoordelingsmoment set status = 'aanwezigen bepalen' where status = 'blind versturen';
update db_field set standaard = 'aanwezigen bepalen'
 where tabel = 'beoordelingsmoment' and kolom = 'status';

insert into schema_versie (versie, omschrijving) values (61, 'besluit meteen openen');
