-- 0110 · de laatste kolommen zonder veld
--
-- Wat na 0109 overbleef uit de audit: losse kolommen die wel bestaan maar nergens
-- in te richten zijn, en één veld dat in een sectie stond die niet bestaat.
--
-- Een kolom zonder veld is niet onschuldig. Hij wordt wél geschreven en gelezen
-- door de code, maar je kunt hem nergens zien of zetten — dus als hij ooit fout
-- staat, is er geen scherm waarop je dat merkt, laat staan corrigeert.

-- teruggekocht_pt stond in sectie 'uitkomst'. Die sectie bestaat niet op positie;
-- de secties daar heten besluit, einde, exitplan, systeem, tranche en uitvoering.
-- Het veld kwam dus nergens op het formulier terecht.
update db_field set sectie = 'einde'
 where tabel = 'positie' and kolom = 'teruggekocht_pt';

-- Drie kolommen op processtap uit oudere migraties. Ze sturen echt gedrag aan —
-- fase bepaalt waar een stap hoort, afvinkregel hoe hij zichzelf afvinkt — en
-- juist dat hoort in beheer te staan en niet alleen in een migratie.
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('processtap','fase','Fase','tekst',45,'stap',0,0),
  ('processtap','afvinkregel','Vinkt zichzelf af met','tekst',65,'stap',0,0),
  ('processtap','uitleg','Uitleg','lang',75,'stap',0,0);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('beoordelingsmoment','inzet_pct_besluit','Inzet bij het besluit','procent',95,'uitkomst',0,1);

-- De sleutel van een gebeurtenis is machinewerk, maar wel het machinewerk waar
-- de hele wachtrij op steunt. Zichtbaar en vast: als er ooit twee kaarten voor
-- hetzelfde opduiken, wil je kunnen zien waarom.
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('gebeurtenis','sleutel','Sleutel','tekst',96,'antwoord',0,1);

insert into schema_versie (versie, omschrijving) values (110, 'de laatste kolommen zonder veld');
