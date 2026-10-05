-- 0111 · vrije tekst waar een keuzelijst hoort
--
-- Drie velden in de definitielaag waren vrije tekst terwijl de code maar een
-- handvol waarden kent. Dat is de gevaarlijkste soort fout in een systeem als
-- dit: je richt iets in, het scherm neemt het aan, en pas als de kaart voor het
-- eerst echt verschijnt doet de knop niets.
--
--   knop1_doel / knop2_doel  — wat een knop op een kaart doet
--   afvinkregel              — hoe een processtap zichzelf afvinkt
--
-- De code houdt de uitvoering; de database houdt de lijst. scripts/proef/
-- inrichting.mjs legt die twee naast elkaar en klaagt zodra ze uit elkaar lopen.

update db_field set type = 'keuze', keuzelijst = 1
 where tabel = 'processtap' and kolom in ('knop1_doel', 'knop2_doel');

update db_field set type = 'keuze', keuzelijst = 1
 where tabel = 'processtap' and kolom = 'afvinkregel';

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','knop1_doel','publicatie','Bericht opstellen',10,'blauw'),
  ('processtap','knop1_doel','scherm','Naar een scherm',20,'blauw'),
  ('processtap','knop1_doel','afsluiten','Afsluiten zonder actie',30,'grijs'),
  ('processtap','knop1_doel','uitstellen','Uitstellen',40,'grijs'),
  ('processtap','knop1_doel','splitsen','Als twee losse dingen behandelen',50,'grijs'),
  ('processtap','knop1_doel','terug','Terug naar de opsteller',60,'grijs');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur)
  select 'processtap', 'knop2_doel', waarde, label, volgorde, kleur
    from db_choice where tabel = 'processtap' and kolom = 'knop1_doel';

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','afvinkregel','events_behandeld','Events in de looptijd behandeld',10,'grijs'),
  ('processtap','afvinkregel','chartlezing_gedaan','Technische analyse gedaan',20,'grijs'),
  ('processtap','afvinkregel','voorwaarden_ingevuld','Instapvoorwaarden ingevuld',30,'grijs'),
  ('processtap','afvinkregel','analysemoment_geprikt','Analysemoment geprikt',40,'grijs'),
  ('processtap','afvinkregel','besluit_aangemaakt','Besluit aangemaakt',50,'grijs'),
  ('processtap','afvinkregel','besluit_met_go','Besluit met een go',60,'grijs'),
  ('processtap','afvinkregel','tranche_in_de_markt','Tranche in de markt',70,'grijs'),
  ('processtap','afvinkregel','alle_tranches_dicht','Alle tranches dicht',80,'grijs'),
  ('processtap','afvinkregel','postanalyse_gedaan','Post-analyse gedaan',90,'grijs'),
  ('processtap','afvinkregel','aanwezigen_gekozen','Aanwezigen gekozen',100,'grijs'),
  ('processtap','afvinkregel','alleen_toegelicht','Alleen toegelicht',110,'grijs'),
  ('processtap','afvinkregel','inzendingen_binnen','Inzendingen binnen',120,'grijs'),
  ('processtap','afvinkregel','gesprek_vastgelegd','Gesprek vastgelegd',130,'grijs'),
  ('processtap','afvinkregel','uitkomst_vastgelegd','Uitkomst vastgelegd',140,'grijs'),
  ('processtap','afvinkregel','exitplan_compleet','Exitplan compleet',150,'grijs'),
  ('processtap','afvinkregel','order_geplaatst','Order geplaatst',160,'grijs'),
  ('processtap','afvinkregel','uitvoering_gekoppeld','Uitvoering gekoppeld',170,'grijs'),
  ('processtap','afvinkregel','afwijking_geduid','Afwijking geduid',180,'grijs'),
  ('processtap','afvinkregel','publicatie_verstuurd','Publicatie verstuurd',190,'grijs'),
  ('processtap','afvinkregel','tranche_uitkomst','Uitkomst van de tranche',200,'grijs');

insert into schema_versie (versie, omschrijving) values (111, 'vrije tekst waar een keuzelijst hoort');
