-- 0120 · een stap heet wat hij controleert
--
-- 'Instapvoorwaarden ingevuld · 0 van 3' terwijl er drie voorwaarden staan: de
-- stap heet 'ingevuld' maar de regel telt wat er gemeten is. Je hebt ze
-- ingevuld, dus de stap liegt tegen je.
--
-- Twee namen aangepast en overal de uitleg erbij, zodat je bij een stap die niet
-- afgaat niet hoeft te raden wat er dan nog moet.
update processtap
   set naam = 'Instapvoorwaarden gemeten',
       uitleg = 'Elke voorwaarde heeft een gemeten waarde en een status. Aanmaken is niet genoeg: zolang er ''niet gemeten'' staat, telt hij niet mee.'
 where afvinkregel = 'voorwaarden_ingevuld';

update processtap
   set uitleg = 'Elke chart heeft een schermafdruk én wat je erin leest. Een plaatje zonder lezing zegt niets tegen wie er later naar kijkt.'
 where afvinkregel = 'chartlezing_gedaan' and (uitleg is null or uitleg = '');

insert into schema_versie (versie, omschrijving) values (120, 'een stap heet wat hij controleert');
