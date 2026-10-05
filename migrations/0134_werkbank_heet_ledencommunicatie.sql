-- 0134 · de werkbank heet Ledencommunicatie
--
-- 'Werkbank' zei wat het scherm vroeger was: een bank met werk erop. Dat werk
-- is weg (§13b) — wat er staat gaat over de leden: de stand die zij te zien
-- krijgen, de posities waar die stand uit volgt, en wat er verstuurd is.
--
-- De route blijft /werkbank. Een adres is geen naam: favorieten, bladwijzers en
-- de geschiedenis van iedereen wijzen ernaar, en die zouden allemaal op een
-- leeg scherm uitkomen. Dat is het niet waard.
update db_module set label = 'Ledencommunicatie' where route = '/werkbank';

insert into schema_versie (versie, omschrijving) values (134, 'de werkbank heet Ledencommunicatie');
