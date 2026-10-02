-- 0068 — De knop naar het gesprek
--
-- Zodra alle inzendingen binnen zijn, is er één ding te doen: samen kijken en
-- de uitkomst vastleggen. Dat gebeurt op een eigen scherm, want daar staat
-- materiaal bij elkaar dat op een formulier niet past — de tijdlijn van de
-- events, de inzendingen naast elkaar, de stand van de portefeuille.
--
-- De knop komt uit de processtap, zoals elke actieknop.

update processtap
   set actieknop = 'Uitkomst vastleggen', doelscherm = 'uitkomst'
 where proces = 3 and afvinkregel = 'uitkomst_vastgelegd';

insert into schema_versie (versie, omschrijving) values (68, 'knop naar het gesprek');

-- In deze fase is er één ding te doen, en dat doe je samen. 'Het gesprek
-- gevoerd' als aparte stap suggereerde dat het gesprek iets anders is dan het
-- bepalen van de uitkomst — dat is het niet.
update processtap set archief = 1 where afvinkregel = 'gesprek_vastgelegd';

update processtap
   set naam = 'Uitkomst samen bepalen',
       uitleg = 'Kijk samen naar de tijdlijn, de inzendingen en de voorwaarden, en leg één uitkomst vast. Bij een go ontstaat het positierecord vanzelf.'
 where afvinkregel = 'uitkomst_vastgelegd' and proces = 3;
