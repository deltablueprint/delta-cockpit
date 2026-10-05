-- 0103 · een kaart uitstellen
--
-- De prullenbak op een kaart heeft twee doelen: afsluiten of uitstellen.
-- Afsluiten is een antwoord en dat kon al. Uitstellen niet, en de voor de hand
-- liggende manieren om het er alsnog in te wringen deugen geen van alle:
--
--   - de kaart beantwoorden met 'later' → hij komt nooit meer terug, want zijn
--     sleutel ligt vast en de motor maakt er geen tweede.
--   - het moment van de gebeurtenis vooruit zetten → dan liegt de tijdlijn over
--     wanneer het gebeurde, en dat is precies waar de stroom voor is.
--   - de kaart wissen en later opnieuw maken → er wordt hier niets gewist.
--
-- Dus een eigen veld. De kaart blijft onbeantwoord en blijft in de stroom staan
-- waar hij hoort; hij is alleen even niet zichtbaar in de rij.
alter table gebeurtenis add column wachten_tot text;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('gebeurtenis','wachten_tot','Uitgesteld tot','tijdstip',95,'antwoord',0,1);

insert into schema_versie (versie, omschrijving) values (103, 'een kaart uitstellen zonder de tijdlijn te vervalsen');
