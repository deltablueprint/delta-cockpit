-- 0046 — Het formulier begint bij het besluit
--
-- Een tranche begint niet bij zichzelf maar bij het besluit waaruit ze
-- voortkomt. Die keuze staat dus bovenaan, en wat eruit volgt — strike,
-- expiratiedatum en inzet — wordt overgenomen in plaats van overgetypt.
--
-- Overnemen gebeurt alleen zolang er niets is uitgevoerd (stand *besluit
-- goedgekeurd*). Daarna staat er een werkelijkheid in die velden die het
-- systeem niet mag overschrijven met een voornemen.

update db_sectie set label = 'Het besluit', volgorde = 5
 where tabel = 'positie' and naam = 'besluit';

update db_sectie set label = 'De tranche', volgorde = 10
 where tabel = 'positie' and naam = 'tranche';

-- In de sectie van het besluit: links de keuze, rechts wat dat besluit zei.
update db_field set volgorde = 10, kolom_rechts = 0
 where tabel = 'positie' and kolom = 'beoordelingsmoment';
update db_field set volgorde = 20, kolom_rechts = 1
 where tabel = 'positie' and kolom = 'besluit_strike';
update db_field set volgorde = 30, kolom_rechts = 1
 where tabel = 'positie' and kolom = 'besluit_expiratiedatum';
update db_field set volgorde = 40, kolom_rechts = 1
 where tabel = 'positie' and kolom = 'besluit_inzet_pct';

insert into schema_versie (versie, omschrijving) values (46, 'besluit bovenaan het positieformulier');
