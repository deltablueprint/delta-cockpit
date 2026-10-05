-- 0123 · 'venster gemist' is geen venstertoestand
--
-- Het venster zegt hetzelfde tegen alle leden tegelijk. 'Gemist' zegt juist iets
-- over één lid: dat hij niet heeft aangegeven de positie gevolgd te hebben op het
-- moment dat de stand naar 'in positie' ging. Dat hoort op de ledenkant thuis,
-- per lid, en niet in een stand die iedereen ziet.
--
-- De ledenkant bestaat nog niet; dit is dus niet verplaatst maar uitgesteld. Zie
-- §14 openstaande punten.
delete from db_choice
 where tabel = 'barometerstand' and kolom = 'venster' and waarde = 'gemist';

update barometerstand set venster = 'in_positie' where venster = 'gemist';

-- De aanleiding noemde 'gemist' bij de standen die met rust gelaten worden.
update processtap
   set aanleiding = replace(aanleiding, '(''opent_binnenkort'', ''open'', ''gemist'')',
                                        '(''opent_binnenkort'', ''open'')')
 where kaartsoort = 'venster';

insert into schema_versie (versie, omschrijving) values (123, 'venster gemist is geen venstertoestand maar een melding per lid');
