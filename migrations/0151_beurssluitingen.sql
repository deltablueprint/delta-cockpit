-- 0151 · de kalender bewaart de uitzonderingen, niet elke dag
--
-- De tabel droeg 730 rijen: elke dag van 2026 en 2027, waarvan 510 'open' en 208
-- 'weekend'. Wie het scherm opende kreeg 31 december 2027 bovenaan en moest door
-- twee jaar zaterdagen scrollen om iets te vinden. Dat is geen kalender maar een
-- afdruk van de tijd.
--
-- Een zaterdag hoeft niet vastgelegd te worden om te weten dat de beurs dicht
-- is. Wat je wél moet vastleggen zijn de dagen die je niet uit een weekdag kunt
-- afleiden: Goede Vrijdag, Paasmaandag, 1 mei, de kerstdagen. Die blijven; de
-- rest gaat eruit. De regel staat in de code: een dag zonder rij is een
-- handelsdag als het maandag tot en met vrijdag is.
--
-- Hiermee gaat de tabel van 730 rijen naar 24, en leest het scherm als wat het
-- is: de dagen waarop de beurs dicht is.
delete from handelsdag where status = 'open';
delete from handelsdag where lower(coalesce(toelichting, '')) = 'weekend';

update db_module set label = 'Beurssluitingen' where doeltabel = 'handelsdag';
update db_table set label = 'Beurssluiting', label_mv = 'Beurssluitingen' where naam = 'handelsdag';

-- Vooruit in de tijd, want daar gaat het over: welke dag komt eraan.
update db_view set kolommen = '["datum","toelichting","beurs","status","bron"]',
                   sortering = 'datum asc'
 where tabel = 'handelsdag' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (151, 'de kalender bewaart de uitzonderingen');
