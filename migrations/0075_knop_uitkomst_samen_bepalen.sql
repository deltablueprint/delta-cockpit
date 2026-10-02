-- De knop draagt de naam van de stap waar hij voor staat.
--
-- Op het besluitrecord staat in de fase *Inzendingen bespreken* één stap:
-- *Uitkomst samen bepalen*. De knop ernaast hoort dezelfde naam te dragen —
-- dat is wat je gaat doen. *Uitkomst vastleggen* is de knop op het scherm met
-- de tijdlijn, aan het eind van dat gesprek: daar wordt de uitkomst
-- daadwerkelijk vastgelegd. Twee namen voor twee handelingen.
update processtap
   set actieknop = 'Uitkomst samen bepalen'
 where proces = 3 and afvinkregel = 'uitkomst_vastgelegd';

insert or ignore into schema_versie (versie, omschrijving) values
  (75, 'knop uitkomst samen bepalen');
