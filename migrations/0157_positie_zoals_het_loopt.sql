-- 0157 · het proces van een tranche zoals het nu loopt
--
-- Het oude proces was gebouwd op de volgorde van vóór de brug: wij plaatsen een
-- order, halen de uitvoering op uit een Flex-rapport, koppelen hem met de hand
-- aan een tranche, en publiceren daarna. Met de brug is die volgorde omgedraaid:
-- de tranche bestáát zodra de broker hem meldt, mét prijs, binnen een seconde.
--
-- Wat eruit gaat:
--   'Order geplaatst bij Lynx'  — niet te controleren en niet nodig. Het systeem
--                                 plaatst nooit een order; dat jij er een
--                                 plaatste blijkt uit de tranche die binnenkomt.
--   'Uitvoering gekoppeld'      — dat was het koppelwerk van het Flex-tijdperk.
--   'Afwijking geduid'          — blijft bestaan, maar als stap die alleen
--                                 verschijnt als er een afwijking is.
--
-- En er komt één inhoudelijke regel bij: het **exitplan staat vóór het bericht
-- aan de leden**. Een instap die je niet kunt verdedigen — geen stoploss, geen
-- eventregel — hoort niet naar de leden te gaan.
--
-- Vier stations: Ingenomen → Exitplan → Gemeld aan de leden → Bewaken/Gesloten.

-- 1. De statussen. 'exitplan en order' en 'uitvoering ophalen' verdwijnen uit de
--    keuzelijst; wat er al in staat blijft leesbaar (nooit wissen), maar er komt
--    niets meer bij.
update db_choice set actief = 0
 where tabel = 'positie' and kolom = 'status'
   and waarde in ('exitplan en order', 'uitvoering ophalen', 'uitvoering vastgelegd');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('positie','status','ingenomen','Ingenomen', 5,'blauw'),
  ('positie','status','exitplan', 'Exitplan', 15,'oranje');

-- Wat er nu in staat verhuist mee. 'exitplan en order' was de stand vóór de
-- uitvoering; die tranches bestaan inmiddels bij de broker of niet.
update positie set status = 'exitplan'  where status = 'exitplan en order';
update positie set status = 'ingenomen' where status in ('uitvoering ophalen', 'uitvoering vastgelegd');

-- 2. De stappen. De oude vier gaan uit de weergave; de nieuwe zes komen erin.
update processtap set archief = 1
 where afvinkregel in ('order_geplaatst', 'uitvoering_gekoppeld')
   and proces in (select id from proces where toepassing = 'positie');

update processtap
   set fase = 'ingenomen', stand = 'ingenomen', volgorde = 10,
       naam = 'Tranche binnen van de broker',
       uitleg = 'De brug meldt het contract, het aantal en de premie. Hier hoeft niemand iets te doen.'
 where afvinkregel = 'tranche_binnen'
   and proces in (select id from proces where toepassing = 'positie');

insert into processtap (proces, volgorde, naam, stand, fase, verplicht, afvinkregel, uitleg)
select p.id, 10, 'Tranche binnen van de broker', 'ingenomen', 'ingenomen', 1, 'tranche_binnen',
       'De brug meldt het contract, het aantal en de premie. Hier hoeft niemand iets te doen.'
  from proces p where p.toepassing = 'positie'
   and not exists (select 1 from processtap s where s.proces = p.id and s.afvinkregel = 'tranche_binnen');

insert into processtap (proces, volgorde, naam, stand, fase, verplicht, afvinkregel, uitleg)
select p.id, 20, 'Bij een cyclus gezet', 'ingenomen', 'ingenomen', 1, 'bij_een_cyclus',
       'Loopt er één cyclus, dan gebeurt dat vanzelf. Lopen er meerdere, dan kies jij.'
  from proces p where p.toepassing = 'positie'
   and not exists (select 1 from processtap s where s.proces = p.id and s.afvinkregel = 'bij_een_cyclus');

-- Het exitplan wordt een eigen station en staat vóór het bericht.
update processtap
   set fase = 'exitplan', stand = 'exitplan', volgorde = 30,
       naam = 'Stoploss en winstanker vastgelegd',
       uitleg = 'Waar stap je uit, en waarbij. Zonder dit gaat er niets naar de leden.'
 where afvinkregel = 'exitplan_compleet'
   and proces in (select id from proces where toepassing = 'positie');

insert into processtap (proces, volgorde, naam, stand, fase, verplicht, afvinkregel, uitleg)
select p.id, 40, 'Afwijking geduid', 'exitplan', 'exitplan', 0, 'afwijking_geduid',
       'Alleen als deze tranche afwijkt van het besluit.'
  from proces p where p.toepassing = 'positie'
   and not exists (select 1 from processtap s where s.proces = p.id and s.afvinkregel = 'afwijking_geduid' and s.archief = 0);

update processtap set archief = 1
 where afvinkregel = 'afwijking_geduid' and fase <> 'exitplan'
   and proces in (select id from proces where toepassing = 'positie');

-- Het bericht.
update processtap
   set fase = 'publiceren naar leden', stand = 'publiceren naar leden', volgorde = 50,
       naam = 'Bericht naar de leden',
       uitleg = 'Het concept staat klaar zodra de tranche binnen is. Versturen is een mensenhandeling.'
 where afvinkregel = 'publicatie_verstuurd'
   and proces in (select id from proces where toepassing = 'positie');

-- En het einde.
update processtap
   set fase = 'bewaken', stand = 'bewaken', volgorde = 60,
       naam = 'Uitkomst vastgelegd',
       uitleg = 'Waardeloos geëxpireerd, teruggekocht of doorgerold — en met welk resultaat.'
 where afvinkregel = 'tranche_uitkomst'
   and proces in (select id from proces where toepassing = 'positie');

update proces set omschrijving = 'Eén tranche: van ingenomen tot vastgelegde uitkomst.'
 where toepassing = 'positie';

-- 3. En de cyclus hoort in de lijst. Een tranche zonder zichtbare cyclus dwingt
--    je het record te openen om te zien waar ze bij hoort — en bij een positie
--    die onverdeeld binnenkomt is dat juist het eerste wat je wil zien.
update db_view
   set kolommen = '["contract","cyclus","status","strike","expiratiedatum","aantal","ontvangen_premie_pt","teruggekocht_pt","resultaat_pt","uitkomst"]'
 where tabel = 'positie' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (157, 'het proces van een tranche zoals het nu loopt');
