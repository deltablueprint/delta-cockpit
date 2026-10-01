-- 0044 — Het besluit onder een tranche is een keuze, geen aanname
--
-- Eén cyclus kent meerdere beoordelingsmomenten, en meerdere tranches. Welk
-- besluit onder déze tranche ligt, hoort dus zichtbaar en aanpasbaar te zijn:
-- het systeem vult het laatste goedgekeurde besluit voor, en wie een ander
-- bedoelt kiest het uit de lijst van die cyclus.
--
-- Wat het besluit zei wordt daarbij meegekopieerd, niet opgezocht: een besluit
-- dat later wordt bijgesteld mag de vergelijking met deze uitvoering niet met
-- terugwerkende kracht veranderen.

-- Een verwijzing kan als keuzelijst getoond worden in plaats van als nummer.
alter table db_field add column keuzelijst integer not null default 0;

update db_field
   set label = 'Besluit', sectie = 'besluit', volgorde = 100,
       toon_op_formulier = 1, alleen_lezen = 0, keuzelijst = 1
 where tabel = 'positie' and kolom = 'beoordelingsmoment';

insert into schema_versie (versie, omschrijving) values (44, 'besluit kiezen onder een tranche');
