-- 0087 · het scherm 'Einde van een tranche'
--
-- Doorrollen, vervroegd terugkopen en een stoploss die raakt gaan niet door het
-- besluitproces: ze zijn tijdsgevoelig en de handeling gebeurt bij Lynx
-- (BOUWSPEC 6). De cockpit leest achteraf wat er gebeurd is en vraagt om
-- duiding. Dat scherm hoort bij VASTLEGGING, naast de besluiten.

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Einde van een tranche', 'VASTLEGGING', null, '/afloop', null, 35);

insert into schema_versie (versie, omschrijving) values (87, 'scherm einde van een tranche');
