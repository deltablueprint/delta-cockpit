-- 0043 — Het proces van een tranche, zoals het werkelijk loopt
--
--   besluit goedgekeurd → order bij Lynx → uitvoering vastgelegd
--   → publiceren naar leden → bewaken → gesloten
--
-- Twee wijzigingen. *Exitplan vastgelegd* vervalt als aparte stand: het
-- exitplan is een gerelateerde lijst geworden (0042) en is een voorwaarde om
-- de eerste stand uit te komen, niet een stand op zichzelf. En er komt een
-- stand bij: zodra de uitvoering vastligt gaat het bericht naar de leden,
-- vóór het bewaken begint. Eerst het feit, dan het verhaal (BOUWSPEC 6).

update positie set status = 'order bij lynx' where status = 'exitplan vastgelegd';

update db_choice set actief = 0
 where tabel = 'positie' and kolom = 'status' and waarde = 'exitplan vastgelegd';

update db_choice set volgorde = 20 where tabel = 'positie' and kolom = 'status' and waarde = 'order bij lynx';
update db_choice set volgorde = 30 where tabel = 'positie' and kolom = 'status' and waarde = 'uitvoering vastgelegd';
update db_choice set volgorde = 50 where tabel = 'positie' and kolom = 'status' and waarde = 'bewaken';
update db_choice set volgorde = 60 where tabel = 'positie' and kolom = 'status' and waarde = 'gesloten';

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('positie','status','publiceren naar leden','Publiceren naar leden',40,'oranje');

-- De stappen volgen de standen.
update processtap set archief = 1 where proces = 2;

insert into processtap (proces, volgorde, naam, stand, eigenaar, verplicht, afdwingt) values
  (2, 10, 'Exitplan vastleggen en de order plaatsen', 'besluit goedgekeurd', 'simon', 1,
      'Stoplossniveau en eventregel staan in het exitplan voor de order weggaat. De order wordt door een mens geplaatst; het systeem plaatst er nooit een.'),
  (2, 20, 'Uitvoering vastleggen', 'order bij lynx', 'simon', 1,
      'Strike, expiratie, aantal en ontvangen premie zoals Lynx ze teruggaf. Wijkt dat af van het besluit, dan hoort daar soort en toelichting bij.'),
  (2, 30, 'Publiceren naar leden', 'uitvoering vastgelegd', 'jacqueline', 1,
      'Het bericht over de ingenomen positie gaat naar de leden. Eerst het feit vastleggen, dan het verhaal.'),
  (2, 40, 'Bewaken', 'publiceren naar leden', 'simon', 1,
      'De tranche loopt: laatprijs tegen het exitplan, buffer en resultaat.'),
  (2, 50, 'Uitkomst vastleggen', 'bewaken', 'elke deelnemer', 1,
      'Waardeloos geëxpireerd, vervroegd teruggekocht, doorgerold of exitplan uitgevoerd — altijd door een mens bevestigd.');

insert into schema_versie (versie, omschrijving) values (43, 'positieproces met publicatiestap');
