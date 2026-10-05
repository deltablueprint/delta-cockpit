-- 0086 · geen systeemsectie op het formulier
--
-- 'Aangemaakt op' en 'Aangemaakt door' onderaan een formulier zijn boekhouding
-- van het systeem, geen invulwerk. Ze staan al in de auditlog en in de lijst.
-- Een eigen sectie ervoor maakt het formulier langer zonder dat iemand er iets
-- aan heeft.
--
-- Uitgangspunt vanaf nu: een nieuwe tabel krijgt geen sectie 'systeem'.

update db_field set toon_op_formulier = 0
 where tabel = 'chartlezing' and kolom in ('aangemaakt_op', 'aangemaakt_door');

-- De sectie zelf hoeft niet weg: een sectie zonder zichtbare velden wordt niet
-- getekend. De rij blijft staan, zoals alles.

-- Een analyse voeg je toe vanuit de cyclus. Na het bewaren hoor je daar weer
-- te staan, met je nieuwe regel in de lijst — niet op het lege record dat je
-- net hebt aangemaakt.
update db_table set na_aanmaken = 'ouder' where naam = 'chartlezing';

insert into schema_versie (versie, omschrijving) values (86, 'geen systeemsectie op het formulier');
