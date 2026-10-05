-- 0130 · de barometer meet op de ask, niet op de strike
--
-- 0128 mat de afstand van de spot tot de strike. Dat vraagt de stand van de
-- onderliggende index, en dus een abonnement op Eurex-data en een brug die
-- draait — terwijl het getal dat er werkelijk toe doet al binnenkomt: de ask.
--
-- De ask is wat het kost om de positie terug te kopen, en dus precies wat er
-- nog op het spel staat. De schaal loopt van het ene uiterste naar het andere:
--
--   ask = 0            de optie is waardeloos, de hele premie is binnen
--   ask = de stoploss  eruit volgens het exitplan (standaard 60, 2x de premie)
--
-- De vijf treden zijn vijf stukken van die weg, in procent van de stoploss. Ze
-- staan in beheer, want ze gaan bijgesteld worden.
--
-- De spot verdwijnt hiermee uit de meting. De tabel marktstand blijft bestaan
-- en de brug blijft hem vullen: hij is niet fout, hij bepaalt alleen niets
-- meer. Dat scheelt een afhankelijkheid die er niet hoeft te zijn.
update instelling
   set sleutel = 'barometer_krap_pct',
       label  = 'Barometer — grens krap',
       waarde = '80', eenheid = '% van de stoploss',
       uitleg = 'Staat de ask op dit deel van de stoploss of hoger, dan is de stand Krap. Op of over de stoploss is het de zwaarste stand.'
 where sleutel = 'barometer_krap_pct';

update instelling
   set label  = 'Barometer — grens let op',
       waarde = '60', eenheid = '% van de stoploss',
       uitleg = 'Tussen deze grens en de grens krap is de stand Let op.'
 where sleutel = 'barometer_letop_pct';

update instelling
   set label  = 'Barometer — grens comfortabel',
       waarde = '35', eenheid = '% van de stoploss',
       uitleg = 'Tussen deze grens en de grens let op is de stand Comfortabel. Daaronder is het Ruim.'
 where sleutel = 'barometer_comfortabel_pct';

-- De zwaarste stand heet niet meer naar de spot. Hij zegt nu wat hij meet: de
-- ask heeft de stoploss uit het exitplan geraakt, en dan is het geen oordeel
-- meer maar een afspraak.
update db_choice set label = 'Op de stoploss'
 where tabel = 'barometerstand' and kolom = 'stand' and waarde = '5';

-- De koersversheid ging over de indexkoers. Hij gaat nu over de ask, en die
-- komt bij elke hartslag van de brug mee.
update instelling
   set label = 'Ask hoogstens zo oud',
       uitleg = 'Is de laatste koers van het contract ouder dan dit, dan meet de barometer niet en doet het systeem geen voorstel. Een stand op een prijs van gisteren is erger dan geen stand.'
 where sleutel = 'koers_vers_minuten';

insert into schema_versie (versie, omschrijving) values (130, 'de barometer meet op de ask');
