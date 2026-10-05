-- 0148 · de drempels van de barometer krijgen een eigen plek
--
-- Ze stonden als drie losse regels in Instellingen, tussen 'koers hoogstens zo
-- oud' en 'doorrol herkennen binnen'. Je zag er drie getallen, geen schaal: dat
-- 60 de bovenkant van 'onder druk' is en 70 iets heel anders betekent (een
-- percentage van de premie, omgekeerd geteld) stond nergens. Wie de barometer
-- wil bijstellen, wil de vijf standen onder elkaar zien met hun grens erbij.
--
-- Eén rij per stand, met de grens waarop je die stand binnenkomt: de ask zakt
-- van links naar rechts, dus de grens is de bovenkant van het vak. In punten of
-- in procent van de ontvangen premie — dat verschilt per grens en hoort dus bij
-- de regel te staan, niet in de naam van een sleutel.
create table barometerdrempel (
  id            integer primary key autoincrement,
  stand         integer not null unique,          -- 1 t/m 5
  grens_waarde  real not null,
  grens_eenheid text not null,                    -- punten | pct_premie
  -- Break-even is geen keuze maar een feit: de ask gelijk aan wat je ontving.
  -- Hij staat in de lijst omdat de schaal anders niet te lezen is, en is niet
  -- te wijzigen.
  vast          integer not null default 0,
  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

insert into barometerdrempel (stand, grens_waarde, grens_eenheid, vast, toelichting) values
  (1, 60, 'punten',     0, 'De stoploss. Hierboven hoort de tranche gesloten te zijn.'),
  (2, 50, 'punten',     0, 'De waarschuwing: aandacht, voor de harde grens in zicht komt.'),
  (3, 100,'pct_premie', 1, 'Break-even — de ask gelijk aan de ontvangen premie.'),
  (4, 50, 'pct_premie', 0, 'De helft van de premie binnen.'),
  (5, 30, 'pct_premie', 0, 'Het winstanker: dit deel van de premie staat nog open.');

-- De drie oude sleutels gaan uit de instellingen: twee plekken met hetzelfde
-- getal is hoe ze uit elkaar gaan lopen. Wat erin stond is hierboven overgezet;
-- het winstanker telde omgekeerd (70 % binnen) en staat nu als wat het is:
-- 30 % van de premie staat nog open.
update instelling set archief = 1
 where sleutel in ('stoploss_ask', 'waarschuwing_ask', 'winstanker_pct');

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde)
 values ('Barometer instellingen', 'BEHEER', null, '/barometerdrempels', null, 191);

-- Wat er in de oude tabel overblijft gaat over wanneer iets bij de leden hoort
-- te komen: hoe vers een koers moet zijn om op te mogen melden, en binnen welke
-- tijd twee handelingen één doorrol zijn. Dat is geen 'instellingen' in het
-- algemeen meer, en de naam zegt dat nu.
update db_module set label = 'Publicatie instellingen' where doeltabel = 'instelling';
update db_table set label = 'Publicatie-instelling', label_mv = 'Publicatie instellingen'
 where naam = 'instelling';

insert into schema_versie (versie, omschrijving) values (148, 'de drempels van de barometer krijgen een eigen plek');
