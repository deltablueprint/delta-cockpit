-- De knop zegt waar hij heen gaat, niet wat je daar als laatste doet.
--
-- 'Uitkomst vastleggen' stond op het besluitrecord én op het scherm waar je
-- dan komt. De eerste brengt je naar het overleg; het vastleggen gebeurt daar,
-- aan het eind. Twee knoppen met dezelfde naam voor twee verschillende dingen
-- is één naam te veel.
update processtap
   set actieknop = 'Go / No-Go overleg'
 where proces = 3 and afvinkregel = 'uitkomst_vastgelegd';

-- De versietellers van 69 tot en met 74 stonden nog open; de migraties zelf
-- waren wel toegepast. 'insert or ignore', zodat dit ook klopt op een database
-- waar ze er toevallig al in staan.
insert or ignore into schema_versie (versie, omschrijving) values
  (69, 'geen_lijst en argumentatie'),
  (70, 'elke tabel bereikbaar in het menu'),
  (71, 'soort besluit onder de datum, formulier_kolommen'),
  (72, 'commentaar'),
  (73, 'menu opgeruimd'),
  (74, 'knop naar het go/no-go overleg');
