-- 0045 — De indeling van het positieformulier, en de premie in contractwaarde
--
-- Twee dingen.
--
-- 1. Welke kolom een veld krijgt, was tot nu toe om en om: het eerste veld
--    links, het tweede rechts. Dat werkt zolang een formulier evenveel velden
--    links als rechts wil hebben. Nu kan een veld zeggen waar het hoort
--    (db_field.kolom_rechts). Staat er in een tabel niets ingevuld, dan blijft
--    het om en om — alle bestaande formulieren veranderen dus niet.
--
-- 2. De premie wordt ingevuld in contractwaarde (€), niet in punten. Punten
--    blijven de rekeneenheid eronder: het exitplan, de stoploss en de
--    vergelijking met het besluit rekenen erin verder. Het systeem rekent om
--    met de multiplier uit de portefeuille-instelling (€ 10 per punt).

alter table db_field add column kolom_rechts integer not null default 0;

alter table positie add column ontvangen_premie_eur real;

update positie
   set ontvangen_premie_eur = ontvangen_premie_pt * 10
 where ontvangen_premie_pt is not null;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('positie','ontvangen_premie_eur','Ontvangen premie (€ per contract)','getal',55,'tranche',0,0,null,1,'180px',1);

update db_field set label = 'Ontvangen premie (punten)', alleen_lezen = 1, toon_op_formulier = 0
 where tabel = 'positie' and kolom = 'ontvangen_premie_pt';

-- De indeling van de sectie 'De tranche':
--   links   tranche · expiratiedatum · strike · premie · aantal contracten
--   rechts  status · inzet in % van het kapitaal
update db_field set volgorde = 10 where tabel = 'positie' and kolom = 'tranche';
update db_field set volgorde = 20 where tabel = 'positie' and kolom = 'expiratiedatum';
update db_field set volgorde = 30 where tabel = 'positie' and kolom = 'strike';
update db_field set volgorde = 40 where tabel = 'positie' and kolom = 'ontvangen_premie_eur';
update db_field set volgorde = 50 where tabel = 'positie' and kolom = 'aantal';
update db_field set volgorde = 60, kolom_rechts = 1 where tabel = 'positie' and kolom = 'status';
update db_field set volgorde = 70, kolom_rechts = 1 where tabel = 'positie' and kolom = 'inzet_pct';

update db_view set kolommen = '["contract","status","strike","expiratiedatum","aantal","ontvangen_premie_eur","uitkomst"]'
 where tabel = 'positie' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (45, 'indeling positieformulier en premie in euro');
