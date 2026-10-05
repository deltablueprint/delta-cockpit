-- 0094 · een voornemen heet 'Positie actie'
--
-- 'Voornemen' zei wat het ís — een aantekening vooraf — maar niet waarover het
-- gaat. 'Positie actie' zegt dat wel: wat je met deze positie gaat doen.

update db_table set label = 'Positie actie', label_mv = 'Positie acties'
 where naam = 'voornemen';

insert into schema_versie (versie, omschrijving) values (94, 'voornemen heet positie actie');
