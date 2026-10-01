-- 0040 — 'Aangemaakt door' hoort niet op een eventbehandeling
--
-- Die regels maakt het systeem zelf aan zodra een event in de looptijd van een
-- cyclus valt. Wie dat deed is dus geen informatie; wie de behandeling koos is
-- dat wel, en dat staat in de audit trail.
--
-- De velden blijven bestaan, ze staan alleen niet meer in de weg.

update db_field set toon_op_formulier = 0
 where tabel = 'cyclus_event' and kolom in ('door', 'wanneer');

update db_view set kolommen = '["event","zwaarte","behandeling","motivering"]'
 where tabel = 'cyclus_event' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (40, 'eventbehandeling opgeruimd');
