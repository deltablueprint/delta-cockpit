-- 0093 · de kolom heet IBKR
--
-- De kolom zegt of er bij de broker iets bewoog dat jij nog moet plaatsen. Eén
-- woord: waar het vandaan komt. Wat eronder staat is geen tekst meer maar een
-- bolletje — groen als het stil is, oranje en pulserend als er iets ligt.

update db_field set label = 'IBKR'
 where tabel = 'cyclus' and kolom = 'duiding_open';

-- Een kolom met één bolletje erin hoeft niet breed te zijn.
update db_field set breedte = '64px'
 where tabel = 'cyclus' and kolom = 'duiding_open';

insert into schema_versie (versie, omschrijving) values (93, 'de kolom heet IBKR');
