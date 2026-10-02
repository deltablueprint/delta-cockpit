-- 0055 — Welke stappen de poort openen
--
-- Een record schuift naar de volgende fase zodra alle verplichte stappen van
-- zijn huidige fase gedaan zijn. Dat maakt de gates leesbaar: ze staan in
-- dezelfde lijst als de stappen, en 'verplicht' zegt of een stap de poort
-- bewaakt of alleen een herinnering is.
--
-- Twee bijstellingen. Een cyclus gaat pas naar *in positie* als er een besluit
-- met een **go** ligt — een no-go houdt hem in besluitvorming (dat is geen
-- vertraging maar een toestand). En de toelichting bij alleen beslissen is
-- geen vrijblijvende herinnering: zonder die reden gaat de poort niet open.

update processtap
   set naam = 'Besluit met een go', afvinkregel = 'besluit_met_go',
       uitleg = 'Een no-go houdt de cyclus in besluitvorming, met een nieuw analysemoment. Dat is wachten, geen vertraging.'
 where proces = 1 and afvinkregel = 'besluit_afgerond';

update processtap set verplicht = 1 where afvinkregel = 'alleen_toegelicht';
update processtap set verplicht = 0 where afvinkregel = 'gesprek_vastgelegd';
update processtap set verplicht = 0 where afvinkregel = 'analysemoment_geprikt';

insert into schema_versie (versie, omschrijving) values (55, 'gates per fase');
