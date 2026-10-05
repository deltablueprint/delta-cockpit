-- 0098 · het scherm voor posities zonder cyclus
--
-- De broker weet wat er openstaat, maar niet waar het bij hoort. Loopt er één
-- cyclus, dan zet de cockpit de positie daar vanzelf bij. Lopen er meerdere,
-- dan blijft ze wachten tot iemand kiest — en dat is de enige handeling die er
-- aan de brokerkant nog van een mens gevraagd wordt.
--
-- Het staat onder WERKEN en niet onder GEGEVENS: het is geen tabel om in te
-- kijken maar iets wat op je ligt te wachten.

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Posities zonder cyclus', 'WERKEN', null, '/onverdeeld', null, 30);

insert into schema_versie (versie, omschrijving) values (98, 'scherm voor posities zonder cyclus');
