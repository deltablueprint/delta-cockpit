-- 0128 · de barometer wordt gemeten
--
-- Tot nu toe was de stand een oordeel op een schaal van 1 tot 5. Hij wordt nu
-- afgeleid uit waar de markt staat ten opzichte van de strike van de zwakste
-- open positie. Dezelfde vijf treden, maar met een naam die zegt wat hij meet
-- en een grens die in beheer staat.
--
--   1 Ruim           > 6 % boven de strike
--   2 Comfortabel    4 – 6 %
--   3 Let op         2 – 4 %
--   4 Krap           0 – 2 %
--   5 Onder de strike
--
-- 1 blijft het rustigst. Dat was zo en dat blijft zo: de schaal zelf verandert
-- niet, alleen wat hij betekent en wie hem invult.
update db_choice set label = 'Ruim',            kleur = 'groen'  where tabel = 'barometerstand' and kolom = 'stand' and waarde = '1';
update db_choice set label = 'Comfortabel',     kleur = 'groen'  where tabel = 'barometerstand' and kolom = 'stand' and waarde = '2';
update db_choice set label = 'Let op',          kleur = 'oranje' where tabel = 'barometerstand' and kolom = 'stand' and waarde = '3';
update db_choice set label = 'Krap',            kleur = 'oranje' where tabel = 'barometerstand' and kolom = 'stand' and waarde = '4';
update db_choice set label = 'Onder de strike', kleur = 'rood'   where tabel = 'barometerstand' and kolom = 'stand' and waarde = '5';

-- De grenzen staan in beheer, want ze gaan bijgesteld worden. Ze staan in
-- procent van de spot boven de strike: is de afstand kleiner dan de grens, dan
-- geldt die stand.
insert into instelling (sleutel, label, waarde, eenheid, uitleg) values
  ('barometer_krap_pct', 'Barometer — grens krap', '2', '%',
   'Staat de spot minder dan dit percentage boven de strike, dan is de stand Krap. Onder de strike is het altijd de zwaarste stand.'),
  ('barometer_letop_pct', 'Barometer — grens let op', '4', '%',
   'Tussen de grens krap en deze grens is de stand Let op.'),
  ('barometer_comfortabel_pct', 'Barometer — grens comfortabel', '6', '%',
   'Tussen de grens let op en deze grens is de stand Comfortabel. Daarboven is het Ruim.'),
  ('koers_vers_minuten', 'Koers hoogstens zo oud', '20', 'minuten',
   'Is de laatste koers van de onderliggende ouder dan dit, dan meet de barometer niet en doet het systeem geen voorstel. Een stand op een koers van gisteren is erger dan geen stand.'),
  ('doorrol_minuten', 'Doorrol herkennen binnen', '60', 'minuten',
   'Gaat er binnen deze tijd na het sluiten van een positie een nieuwe open in dezelfde cyclus, dan is dat één doorrol en geen twee losse gebeurtenissen.');

-- De stand van de onderliggende. De brug stuurt hem mee; zonder brug is hij er
-- niet, en dan meet de barometer niets. Eén rij per onderliggende, overschreven
-- bij elke hartslag: dit is een momentopname en geen vastlegging. Wat bewaard
-- moet blijven staat in de gebeurtenissenstroom.
create table marktstand (
  onderliggend text primary key,
  stand        real not null,
  moment       text not null default (datetime('now')),
  bron         text not null default 'brug'
);

-- De werkbank staat weer in het menu, op dezelfde plek als eerst.
update db_module set actief = 1 where route = '/werkbank';

insert into schema_versie (versie, omschrijving) values (128, 'de barometer wordt gemeten');
