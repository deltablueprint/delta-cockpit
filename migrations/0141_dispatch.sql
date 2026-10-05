-- 0141 · de navigator heet waar hij over gaat
--
-- 'Werken' zei niets: alles in deze applicatie is werken. Wat er onder stond
-- gaat over één ding — wat de leden te horen krijgen en wanneer. De groep heet
-- daarom Communicatie, en het scherm waarop dat gebeurt heet Dispatch: daar
-- gaat het de deur uit.
update db_module set groep = 'COMMUNICATIE' where groep = 'WERKEN';
update db_module set label = 'Dispatch', volgorde = 10 where route = '/werkbank';

-- Drie ingangen die niets toevoegden. Mijn taken en het dashboard-achtige
-- 'Klaar voor de leden' doen werk dat nu op het cyclusrecord en in Dispatch
-- gebeurt; posities zonder cyclus was een opruimscherm uit de tijd dat de brug
-- nog los stond. De schermen blijven bestaan, alleen staan ze niet meer in de
-- navigator.
update db_module set actief = 0
 where route in ('/taken', '/berichten', '/onverdeeld');

-- De barometer en de stroom horen bij de communicatie, niet bij de gegevens:
-- het zijn de twee logboeken van wat wij wisten en wat wij zeiden.
update db_module set groep = 'COMMUNICATIE', volgorde = 20 where doeltabel = 'barometerstand';
update db_module set groep = 'COMMUNICATIE', volgorde = 30 where doeltabel = 'gebeurtenis';
update db_module set volgorde = 40 where route = '/dashboard';

-- De barometerlijst toonde geen enkel tijdstip: zonder db_view viel hij terug op
-- de eerste zeven velden, en dat zijn de inhoudelijke. Een stand zonder wanneer
-- is onleesbaar — juist de volgorde in de tijd is wat je er wil aflezen.
insert into db_view (tabel, naam, kolommen, sortering) values
  ('barometerstand','standaard',
   '["vastgesteld_op","cyclus","stand","venster","reden","vastgesteld_door","gepubliceerd_op"]',
   'vastgesteld_op desc');

insert into schema_versie (versie, omschrijving) values (141, 'de navigator heet waar hij over gaat');
