-- 0065 — Velden volgen de keuze die je maakt
--
-- Bij een go vraag je om de positie, bij een no-go om de reden. Allebei tonen
-- betekent dat de helft van het formulier altijd niet van toepassing is — en
-- dan gaat iemand vroeg of laat de verkeerde invullen.
--
-- `db_field.toon_als` zegt wanneer een veld in beeld komt, in dezelfde kleine
-- taal als de validatieregels: '<veld> = <waarde>'.

alter table db_field add column toon_als text;

-- De inzending: go vraagt de positie, no-go de reden.
update db_field set toon_als = 'positie = go'
 where tabel = 'inzending' and kolom in ('expiratiedatum', 'strike', 'inzet_pct');
update db_field set toon_als = 'positie = no-go'
 where tabel = 'inzending' and kolom = 'reden';

-- Het besluit: dezelfde logica op de uitkomst.
update db_field set toon_als = 'uitkomst = go'
 where tabel = 'beoordelingsmoment' and kolom in ('expiratiedatum', 'strike', 'inzet_pct', 'aantal_contracten');
update db_field set toon_als = 'uitkomst = no-go'
 where tabel = 'beoordelingsmoment' and kolom = 'volgend_moment';

-- De positie: de duiding van een afwijking hoort er alleen te staan als er
-- een afwijking is.
update db_field set toon_als = 'afwijking = 1'
 where tabel = 'positie' and kolom in ('afwijking_soort', 'afwijking_toelichting');
update db_field set toon_als = 'uitkomst = exitplan uitgevoerd'
 where tabel = 'positie' and kolom = 'reden_exit';
update db_field set toon_als = 'uitkomst = doorgerold'
 where tabel = 'positie' and kolom = 'doorgerold_naar';

-- En de drie velden van het besluit onder elkaar, met de inzet als percentage.
update db_field set kolom_rechts = 0, volgorde = 60 where tabel = 'beoordelingsmoment' and kolom = 'expiratiedatum';
update db_field set kolom_rechts = 0, volgorde = 70 where tabel = 'beoordelingsmoment' and kolom = 'strike';
update db_field set kolom_rechts = 0, volgorde = 80, type = 'procent' where tabel = 'beoordelingsmoment' and kolom = 'inzet_pct';
update db_field set type = 'procent' where tabel = 'inzending' and kolom = 'inzet_pct';
update db_field set type = 'procent' where tabel = 'positie' and kolom in ('inzet_pct', 'besluit_inzet_pct', 'winstanker_pct');

insert into schema_versie (versie, omschrijving) values (65, 'velden volgen de keuze');

-- De status van een inzending is concept of verstuurd, en dat zie je aan of je
-- hem nog kunt wijzigen. Op het formulier is het een streepje dat niets zegt.
update db_field set toon_op_formulier = 0
 where tabel = 'inzending' and kolom = 'status';
