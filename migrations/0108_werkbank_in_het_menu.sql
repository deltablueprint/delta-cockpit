-- 0108 · de werkbank in het menu
--
-- Het scherm waarop je elke ochtend begint hoort bovenaan te staan, boven het
-- dashboard: het dashboard laat zien hoe het ervoor staat, de werkbank zegt wat
-- er nog moet gebeuren. Dat tweede is waarvoor je inlogt.
insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Werkbank', 'WERKEN', null, '/werkbank', null, 5);

-- Twee migraties terug zijn er modules in een groep 'INRICHTING' gezet. Die
-- groep bestond nog niet, en er is er al een die precies dit doet: BEHEER. Twee
-- namen voor hetzelfde is hoe een menu uit elkaar valt.
update db_module set groep = 'BEHEER', volgorde = 152
 where doeltabel = 'berichtsjabloon';
update db_module set groep = 'BEHEER', volgorde = 190
 where doeltabel = 'instelling';

insert into schema_versie (versie, omschrijving) values (108, 'de werkbank in het menu');
