-- 0133 · twee standen hernoemd
--
-- 'Ruim' en 'Vrijwel afgerond' zeggen te weinig over wat er van een lid
-- gevraagd wordt. De schaal leest nu als één aflopende reeks:
--
--   1 Onder druk · 2 Krap · 3 Aandacht · 4 Comfortabel · 5 Veilig
--
-- De grenzen veranderen niet, alleen de woorden — en die gaan naar de leden,
-- dus ze horen in beheer te staan en niet in de code.
update db_choice set label = 'Aandacht'
 where tabel = 'barometerstand' and kolom = 'stand' and waarde = '3';

update db_choice set label = 'Veilig'
 where tabel = 'barometerstand' and kolom = 'stand' and waarde = '5';

insert into schema_versie (versie, omschrijving) values (133, 'twee standen hernoemd');
