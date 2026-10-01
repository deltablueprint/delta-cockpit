-- 0041 — Het positieformulier vraagt alleen wat je bij het aanmaken weet
--
-- Wat het systeem zelf kan invullen, hoort het niet te vragen; wat pas aan het
-- eind van de looptijd bekend is, hoort niet in het formulier te staan waarmee
-- je begint.
--
--   contract        → het systeem stelt het samen uit expiratie en strike
--   tranche         → het nummer volgt uit de cyclus
--   stoploss (ask)  → staat vast op 60,0 (BOUWSPEC 6)
--   winstanker      → 70 % van de ontvangen premie als startwaarde
--   eventregel      → hoort bij het exitplan, niet bij het aanmaken
--   wie volgt       → idem
--   uitkomst e.d.   → die sectie komt pas in beeld zodra het record bestaat

update db_field set toon_op_formulier = 0, alleen_lezen = 1
 where tabel = 'positie' and kolom = 'contract';

update db_field set alleen_lezen = 1
 where tabel = 'positie' and kolom = 'tranche';

update db_field set standaard = '60'
 where tabel = 'positie' and kolom = 'stoploss_ask';

update db_field set standaard = '70'
 where tabel = 'positie' and kolom = 'winstanker_pct';

-- break-even volgt straks uit strike en ontvangen premie; hem bij het
-- aanmaken vragen betekent hem met de hand uitrekenen.
update db_field set toon_op_formulier = 0
 where tabel = 'positie' and kolom in ('eventregel', 'wie_volgt', 'break_even');

-- Een sectie kan zeggen dat ze bij het aanmaken nog niets te melden heeft.
alter table db_sectie add column verbergen_bij_nieuw integer not null default 0;

update db_sectie set verbergen_bij_nieuw = 1
 where tabel = 'positie' and naam in ('einde', 'uitvoering');

-- De regels die het exitplan afdwingen gingen over velden die nu niet meer op
-- het formulier staan. Het exitplan blijft verplicht vóór de order, maar dan
-- via de twee velden die er wél staan.
update db_rule set versie_tot = 1
 where tabel = 'positie' and kolom in ('eventregel', 'wie_volgt');

insert into schema_versie (versie, omschrijving) values (41, 'positieformulier opgeschoond');
