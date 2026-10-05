-- 0122 · een meting draagt wie hem deed en wanneer
--
-- Drie dingen die samenhingen en samen één verwarring opleverden.
--
-- 1. De kolommen heetten verkeerd. 'gemeten_door' stond op het scherm als
--    'Aangemaakt door' en 'gemeten_op' als 'Aangemaakt op'. Ze gaan niet over
--    aanmaken maar over meten, en omdat ze leeg bleven leek het alsof er iets
--    stuk was.
--
-- 2. Je kon een gemeten waarde intypen zonder dat er iemand bij stond. Wie heeft
--    gekeken en wanneer, is bij een instapvoorwaarde geen bijzaak: het besluit
--    steunt erop.
--
-- 3. De stap 'Instapvoorwaarden gemeten' telt alleen wat een status heeft. Vul je
--    een waarde in en laat je de status op 'niet gemeten' staan, dan blijft de
--    stap openstaan en zie je niet waarom. Een waarde zonder oordeel helpt het
--    gesprek ook niet: 2,4 % is pas iets als er 'groen' bij staat.
update db_field set label = 'Gemeten door' where tabel = 'voorwaarde' and kolom = 'gemeten_door';
update db_field set label = 'Gemeten op'   where tabel = 'voorwaarde' and kolom = 'gemeten_op';

update processtap
   set uitleg = 'Elke voorwaarde heeft een gemeten waarde én een status. Een waarde zonder oordeel helpt het gesprek niet: 2,4 % is pas iets als er groen, oranje of rood bij staat.'
 where afvinkregel = 'voorwaarden_ingevuld';

insert into schema_versie (versie, omschrijving) values (122, 'een meting draagt wie hem deed en wanneer');
