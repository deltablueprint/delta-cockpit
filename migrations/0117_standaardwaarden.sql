-- 0117 · wat het systeem zelf weet, vraagt het niet
--
-- Een nieuw formulier opende met twee lege velden die niemand ooit anders
-- invult: de datum van vandaag, en wie het aanmaakt. Dat zijn geen vragen maar
-- feiten die het systeem al heeft.
--
-- Het gereedschap bestond al: db_field.standaard kent 'vandaag', 'nu' en 'ik',
-- en het nieuwe-record-scherm vult die in voor je begint. Alleen stond hij op
-- deze velden niet aan.

-- Wie het aanmaakt. Dit veld staat overal op alleen-lezen, dus hij werd ook
-- nooit met de hand gevuld — hij bleef gewoon leeg op het formulier, en pas bij
-- het bewaren zette de worker hem alsnog. Je zag dus iets anders dan wat er
-- ging gebeuren.
update db_field set standaard = 'ik'
 where kolom = 'aangemaakt_door' and actief = 1
   and (standaard is null or standaard = '');

-- De dag waarop een cyclus opengaat is de dag waarop je hem aanmaakt. Is dat
-- een keer niet zo, dan pas je hem aan — maar dat is de uitzondering, en een
-- formulier hoort naar de regel te staan.
update db_field set standaard = 'vandaag'
 where tabel = 'cyclus' and kolom = 'geopend_op';

insert into schema_versie (versie, omschrijving) values (117, 'wat het systeem zelf weet, vraagt het niet');
