-- 0095 · de stand als tweede kolom, en wat een tranche opbracht
--
-- Drie dingen die bij elkaar horen omdat ze allemaal over lezen gaan.
--
-- 1. Een stand staat altijd op dezelfde plek: direct na de naam. Je scant een
--    lijst van links naar rechts; wat iets ís staat vooraan, hoe het ervoor
--    staat meteen erachter. Nu stond het per tabel ergens anders.
--
-- 2. 'Gesloten' was groen. Groen betekent in dit systeem 'goed'; een gesloten
--    tranche is niet goed of slecht, die is klaar. Dat is grijs.
--
-- 3. Wat een tranche opbracht lees je in punten, want zo staat het in de
--    optieketen: je schreef op 38,5 en kocht terug op 12,0. Het bedrag in euro
--    is daarvan afgeleid en hoeft niet in de lijst. Wat eraan ontbrak is de
--    terugkoopprijs: zonder dat getal zie je het resultaat wel, maar niet
--    waaruit het bestaat.

alter table positie add column teruggekocht_pt real;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('positie','teruggekocht_pt','Teruggekocht (punten)','getal',155,'uitkomst',0,1,null,1,0,1);

-- Een tranche die waardeloos expireerde is op nul teruggekocht: je betaalde
-- niets om eruit te komen. Dat is een getal, geen leegte.
update positie set teruggekocht_pt = 0
 where uitkomst = 'waardeloos geexpireerd' and teruggekocht_pt is null;

-- ---------- 1 · de stand als tweede kolom ----------
update db_view set kolommen = '["naam","status","bron","gemeten_waarde","gemeten_door","gemeten_op"]'
 where tabel = 'voorwaarde' and naam = 'standaard';

update db_view set kolommen = '["positie","stand","soort","omschrijving","niveau","eenheid","geraakt_op"]'
 where tabel = 'exitregel' and naam = 'standaard';

update db_view set kolommen = '["positie","status","soort","nieuwe_strike","nieuwe_expiratiedatum","aantal","uitgevoerd_op"]'
 where tabel = 'voornemen' and naam = 'standaard';

-- ---------- 2 · gesloten is grijs ----------
update db_choice set kleur = 'grijs'
 where tabel = 'positie' and kolom = 'status' and waarde = 'gesloten';

-- ---------- 3 · de premie in punten, met de terugkoop erbij ----------
update db_view set kolommen = '["contract","status","strike","expiratiedatum","aantal","ontvangen_premie_pt","teruggekocht_pt","resultaat_pt","uitkomst"]'
 where tabel = 'positie' and naam = 'standaard';

update db_field set label = 'Geschreven op (punten)' where tabel = 'positie' and kolom = 'ontvangen_premie_pt';
update db_field set label = 'Premie (€ per contract)' where tabel = 'positie' and kolom = 'ontvangen_premie_eur';

insert into schema_versie (versie, omschrijving) values (95, 'stand als tweede kolom, premie in punten');
