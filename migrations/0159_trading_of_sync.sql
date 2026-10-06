-- 0159 · de brug heeft twee standen: Trading of Sync
--
-- De keuze is gemaakt: één paper account, één actieve gebruiker. Er komt dus
-- geen tweede login naast de brug, en daarmee is 'Gateway aangemeld' geen
-- vinkje op een instellingenpagina maar de vraag wie op dit moment de sessie
-- is — jij of de brug. Dat zijn twee standen die elkaar uitsluiten:
--
--   Trading — de Gateway is afgemeld. Jij bent de sessie en plaatst orders in
--             LYNX. De cockpit leest niets bij; wat er staat is van het laatste
--             moment dat de brug luisterde.
--   Sync    — de Gateway is aangemeld en de brug luistert. De cockpit haalt
--             posities en uitvoeringen op. Inloggen in LYNX lukt dan niet.
--
-- De instelling blijft dezelfde ja/nee (ja = Sync): de brug leest hem af in het
-- antwoord op zijn eigen zending, en dat verandert niet. Alleen de woorden
-- veranderen, zodat de instellingenpagina hetzelfde zegt als de schakelaar in
-- de kop. Een migratie wordt nooit bijgewerkt; dit is de correctie op 0158.
update brokerinstelling
   set label = 'Sync aan (anders: Trading)',
       uitleg = 'Aan is Sync: de Gateway is aangemeld en de cockpit leest posities en uitvoeringen bij. Uit is Trading: de Gateway meldt zich af, jij bent de sessie en kunt handelen in LYNX — de cockpit leest dan niets bij. IBKR laat per login maar één sessie toe, dus het is altijd het een of het ander. Omschakelen naar Sync duurt ongeveer een minuut. Je zet dit het makkelijkst met de schakelaar in de kop van de cockpit.'
 where sleutel = 'gateway_aan';

insert into schema_versie (versie, omschrijving) values (159, 'de brug heeft twee standen: Trading of Sync');
