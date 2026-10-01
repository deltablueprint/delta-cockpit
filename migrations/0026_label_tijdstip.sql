-- 0026 · label van het tijdstip
-- Het veld bevat de tijd in de zone van het event zelf (14:00 in Washington);
-- getoond wordt de Brusselse tijd. "Brussel" klopt het hele jaar, terwijl CEST
-- alleen in de zomer geldt — in de winter is het CET. De afkorting staat per
-- regel achter de waarde, waar hij wél klopt.

update db_field set label = 'Tijdstip (Brussel)' where tabel = 'event' and kolom = 'tijdstip';

insert into schema_versie (versie, omschrijving) values (26, 'label tijdstip');
