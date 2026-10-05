-- 0096 · break-even is een ask, geen indexstand
--
-- Het break-even stond als 'strike min premie' in indexpunten, met de
-- omschrijving 'onder dit niveau kost de tranche geld'. Dat klopt alleen op de
-- expiratiedag. Eerder hangt de waarde van de optie ook af van volatiliteit en
-- tijdswaarde: op datzelfde indexniveau staat de put dan veel hoger dan de
-- ontvangen premie, en sta je onder water terwijl de regel zegt van niet. Een
-- exitregel waar je op een slechte dag de verkeerde conclusie uit trekt, is
-- erger dan geen exitregel.
--
-- Het echte break-even is wél een ask, en het is een getal dat er al was: de
-- ontvangen premie. Koop je terug boven dat bedrag, dan kost de tranche geld.
-- Dat geldt op elke dag, ongeacht volatiliteit — het is een aftrekking.
--
-- Het indexniveau verdwijnt niet, maar wordt wat het is: een referentiepunt met
-- een eerlijke omschrijving, als eigen soort naast de drie bewakingsregels.

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('exitregel','soort','expiratieniveau','Expiratieniveau', 35, 'grijs');

-- De bestaande break-evenregels worden omgezet naar de ask, met de premie van
-- hun eigen tranche. Wat er stond blijft bewaard als expiratieniveau.
insert into exitregel (positie, volgorde, soort, omschrijving, niveau, eenheid, stand)
select e.positie, 35, 'expiratieniveau',
       'Staat de index op de expiratiedag hieronder, dan kost de tranche geld',
       e.niveau, 'indexstand', 'niet geraakt'
  from exitregel e
 where e.soort = 'break-even' and e.archief = 0 and e.eenheid = 'punten'
   and not exists (select 1 from exitregel x where x.positie = e.positie and x.soort = 'expiratieniveau');

update exitregel
   set eenheid = 'ask',
       omschrijving = 'Terugkopen boven deze prijs kost de tranche geld',
       niveau = (select round(p.ontvangen_premie_pt, 1) from positie p where p.id = exitregel.positie),
       revisie = revisie + 1
 where soort = 'break-even' and archief = 0 and eenheid = 'punten';

insert into schema_versie (versie, omschrijving) values (96, 'break-even in ask, expiratieniveau apart');
