-- 0132 · de barometer leest de balk, en de balk staat in ask-niveaus
--
-- BOUWSPEC §10.1 beschrijft deze balk al, en 0128/0130 bouwden iets anders.
-- Dit zet het recht. Wat de spec zegt:
--
--   De balk loopt van verlies links naar winst rechts. De ask daalt dus naar
--   rechts — een geschreven optie die goedkoper wordt is winst.
--
--   De ijkpunten staan op vaste posities zodat twee tranches met verschillende
--   premies naast elkaar te lezen zijn, met break-even in het midden. Binnen
--   elk vak wordt lineair geïnterpoleerd.
--
--   Alle ijkpunten zijn ask-niveaus, want dat is de prijs waartegen je er
--   werkelijk uit komt:
--
--     stop loss       ask 60,0            (vast, uit de standaardset)
--     waarschuwing    ask 50,0            (vast, uit de standaardset)
--     break-even      ask = de premie     (per tranche)
--     helft binnen    ask = 50 % van de premie
--     winstanker      ask = 30 % van de premie   (winstanker 70 % binnen)
--
-- De stoploss is dus *niet* twee keer de premie. Dat stond nergens; het is een
-- vast niveau, en het staat per tranche op positie.stoploss_ask zodat het
-- aangescherpt kan worden — nooit verruimd (uitgangspunt, §10 regel 4).

-- ------------------------------------------------------- de vijf standen
--
-- De richting staat in §10.1 en liep in 0107 andersom: daar was 1 het rustigst.
-- Beslist op 5 oktober 2026: 1 is onder druk, 5 is vrijwel afgerond. De stand
-- telt dus op naarmate de positie veiliger staat.
update db_choice set label = 'Onder druk',        kleur = 'rood'   where tabel = 'barometerstand' and kolom = 'stand' and waarde = '1';
update db_choice set label = 'Krap',              kleur = 'oranje' where tabel = 'barometerstand' and kolom = 'stand' and waarde = '2';
update db_choice set label = 'Ruim',              kleur = 'oranje' where tabel = 'barometerstand' and kolom = 'stand' and waarde = '3';
update db_choice set label = 'Comfortabel',       kleur = 'groen'  where tabel = 'barometerstand' and kolom = 'stand' and waarde = '4';
update db_choice set label = 'Vrijwel afgerond',  kleur = 'groen'  where tabel = 'barometerstand' and kolom = 'stand' and waarde = '5';

-- Wat er al vastligt betekende het omgekeerde. Een stand van 1 die gisteren
-- 'niets aan de hand' zei, zou vandaag 'onder druk' lezen — en dat is een
-- ergere leugen dan een omgerekende rij. Dus draaien ze mee, met een notitie
-- erbij zodat niemand zich later afvraagt waarom de reden niet bij het getal
-- past.
update barometerstand
   set stand = 6 - stand,
       reden = reden || ' · [0132: de schaal is omgedraaid, 1 is nu onder druk]'
 where stand between 1 and 5;

-- ------------------------------------------------------------- de grenzen
--
-- De drempels van 0128/0130 gingen over een percentage van de stoploss. De
-- grenzen zijn ask-niveaus, en die staan hier.
update instelling set archief = 1
 where sleutel in ('barometer_krap_pct', 'barometer_letop_pct', 'barometer_comfortabel_pct');

insert into instelling (sleutel, label, waarde, eenheid, uitleg) values
  ('stoploss_ask', 'Stoploss — ask', '60', 'punten',
   'Het niveau waarop een tranche gesloten hoort te zijn. Vast, uit de standaardset. Per tranche staat hij op de positie en kan hij worden aangescherpt, nooit verruimd.'),
  ('waarschuwing_ask', 'Waarschuwing — ask', '50', 'punten',
   'Tussen de stoploss en dit niveau is de zone het diepst gekleurd. Het is het punt waarop een positie aandacht verdient vóórdat de harde grens in zicht komt, en de drempel waarop de barometer een stand laat zakken.'),
  ('winstanker_pct', 'Winstanker', '70', '% van de premie',
   'Hoeveel van de ontvangen premie binnen moet zijn voordat een tranche als vrijwel afgerond geldt. Op 70 % binnen staat de ask op 30 % van de premie.');

insert into schema_versie (versie, omschrijving) values (132, 'de balk uit de spec: ask-niveaus, 1 is onder druk');
