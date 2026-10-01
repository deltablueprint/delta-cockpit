-- 0039 — De herinnering bij een behandeling gaat eruit
--
-- Hij verscheen bij elke keuze, ook als er niets aan de hand was, en werd
-- daarmee behang: een melding die je altijd ziet, lees je niet meer. De
-- motivering blijft een veld dat je invult wanneer het ertoe doet.
--
-- Een regel wordt niet verwijderd maar beëindigd: hij blijft zichtbaar in de
-- geschiedenis met de versie waarin hij gold (BOUWSPEC 3.4).

update db_rule set versie_tot = 1
 where tabel = 'cyclus_event' and kolom in ('motivering', 'zwaarte_reden');

insert into schema_versie (versie, omschrijving) values (39, 'geen melding meer bij het kiezen van een behandeling');
