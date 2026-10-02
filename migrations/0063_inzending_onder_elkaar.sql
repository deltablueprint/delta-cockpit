-- 0063 — De positievelden van een inzending onder elkaar
--
-- Expiratiedatum, strike en inzet horen bij elkaar en worden in die volgorde
-- bedacht. Ze over twee kolommen verdelen maakt er twee losse groepjes van.

update db_field set kolom_rechts = 0, volgorde = 40
 where tabel = 'inzending' and kolom = 'expiratiedatum';
update db_field set kolom_rechts = 0, volgorde = 50
 where tabel = 'inzending' and kolom = 'strike';
update db_field set kolom_rechts = 0, volgorde = 60
 where tabel = 'inzending' and kolom = 'inzet_pct';

-- En in de sectie erboven: jouw beslissing links, de deelnemer ernaast.
update db_field set kolom_rechts = 0, volgorde = 20
 where tabel = 'inzending' and kolom = 'positie';
update db_field set kolom_rechts = 1, volgorde = 10
 where tabel = 'inzending' and kolom = 'deelnemer';
update db_field set kolom_rechts = 1, volgorde = 30
 where tabel = 'inzending' and kolom = 'status';

insert into schema_versie (versie, omschrijving) values (63, 'inzendingvelden onder elkaar');
