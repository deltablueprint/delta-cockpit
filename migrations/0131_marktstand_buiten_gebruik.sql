-- 0131 · marktstand is buiten gebruik
--
-- 0128 maakte deze tabel voor de stand van de onderliggende index. Sinds 0130
-- meet de barometer op de ask van het contract, en dat getal komt al mee bij
-- elke hartslag van de brug. De indexkoers is daarmee overbodig geworden: geen
-- extra abonnement op Eurex-data, geen tweede ding dat stil kan uitvallen.
--
-- De tabel blijft staan, zoals alles hier blijft staan. Niets leest of schrijft
-- hem nog; de brug stuurt geen marktstanden meer mee en worker/brug.js neemt ze
-- niet meer aan. Komt er ooit een meting waarvoor de koers wél nodig is — een
-- afstand tot de strike naast de ask bijvoorbeeld — dan staat hij er.
--
-- Wat er in staat is een momentopname van een paar dagen testen. Die gaat wel
-- weg: hij zegt niets over een cyclus, een besluit of een positie, en een rij
-- die een koers van vorige week beweert is erger dan een lege tabel.
delete from marktstand;

insert into schema_versie (versie, omschrijving) values (131, 'marktstand buiten gebruik');
