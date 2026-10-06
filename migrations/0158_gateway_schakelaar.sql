-- 0158 · de Gateway aan en uit vanuit de cockpit
--
-- IBKR laat per login één sessie toe. Zit de Gateway aangemeld, dan kun jij niet
-- meer in LYNX — en dat merk je pas op het moment dat je wil handelen. Tot er
-- een eigen machinegebruiker is, is de enige oplossing: de Gateway even uit.
--
-- Dat moest tot nu toe met ssh en systemctl. Nu staat het in de cockpit, als één
-- schakelaar in de kop. Het verkeer blijft één kant op: de brug haalt deze
-- instelling op in het antwoord op zijn eigen zending, net als de hartslag en
-- de koersen. De cockpit stuurt hem nooit iets; hij leest alleen af wat er over
-- hemzelf is ingesteld.
--
-- Wat de brug ermee doet staat in brug/brug.mjs: op 'uit' laat hij de
-- API-verbinding los en stopt hij de Gateway, op 'aan' start hij hem weer. Hij
-- blijft wél zijn hartslag sturen — zo weet de cockpit het verschil tussen
-- 'staat uit omdat jij dat wou' en 'ik hoor niets meer'.
insert into brokerinstelling (sleutel, waarde, label, uitleg, soort, volgorde) values
  ('gateway_aan', '1', 'Gateway aangemeld',
   'Zet dit uit als je zelf wil handelen in LYNX: IBKR laat per login maar één sessie toe. De brug meldt de Gateway dan af en blijft zelf doorlopen; de cockpit ziet geen nieuwe posities tot je hem weer aanzet. Opnieuw aanmelden duurt ongeveer een minuut.',
   'ja_nee', 5);

insert into schema_versie (versie, omschrijving) values (158, 'de Gateway aan en uit vanuit de cockpit');
