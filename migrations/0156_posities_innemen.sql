-- 0156 · posities innemen
--
-- Het venster kende één moment van instappen: open, en daarna zitten we erin.
-- Zo gaat het niet. Het venster gaat open, de markt beweegt snel, en na een uur
-- is instappen niet meer voordelig — dan sluit het venster terwijl er pas één
-- tranche in de markt staat. De tweede en de derde volgen een dag of twee later,
-- zonder dat het hele besluitproces opnieuw doorlopen wordt: dat besluit staat.
--
-- Daarom een stand tussen 'Open' en 'In positie': **Posities innemen**. Daarin
-- staan we met minstens één tranche in de markt en kunnen er nog bij komen. Elke
-- tranche die erbij komt is een eigen gebeurtenis en dus een eigen bericht; het
-- venster hoeft daar niet voor heen en weer. Zodra alles ingenomen is gaat het
-- venster naar 'In positie' en is de instap voorbij.
--
-- Twee dingen volgen hieruit, en die staan in de code:
--   - de barometer wordt wakker vanaf 'Posities innemen', niet pas bij 'In
--     positie'. Een tranche die in de markt staat moet bewaakt worden, ook als
--     de volgende nog moet komen.
--   - het bericht over een tranche gaat naar alle leden van de cyclus, niet
--     alleen naar wie de eerste tranche volgt: wie die gemist heeft kan nu
--     alsnog mee.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur)
values ('barometerstand', 'venster', 'posities_innemen', 'Posities innemen', 45, 'groen');

insert into schema_versie (versie, omschrijving) values (156, 'posities innemen');
