-- 0066 — Een inzending versturen is één handeling
--
-- Je vult je oordeel in en je verstuurt het; er is geen tussenstand waarin je
-- hem bewaart en later nog aanpast. Daarom heet de knop *Verzenden* en niet
-- *Aanmaken*, vergrendelt het opslaan de inzending meteen, en kom je daarna
-- terug op het besluit — want daar gaat het verder.

alter table db_table add column aanmaakknop text;
alter table db_table add column na_aanmaken text;

update db_table set aanmaakknop = 'Verzenden', na_aanmaken = 'ouder' where naam = 'inzending';

insert into schema_versie (versie, omschrijving) values (66, 'inzending verzenden');

-- Er is geen conceptstand meer: wat ingevuld is, is verstuurd. Bestaande
-- concepten waren bedoeld als inzending, dus die gaan mee.
update inzending
   set status = 'verstuurd', verstuurd_op = coalesce(verstuurd_op, aangemaakt_op, datetime('now'))
 where status = 'concept';

update db_choice set actief = 0
 where tabel = 'inzending' and kolom = 'status' and waarde = 'concept';
