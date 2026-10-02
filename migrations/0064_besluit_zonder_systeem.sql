-- 0064 — Geen systeemsectie op het besluit
--
-- Wanneer het besluit is aangemaakt en wie de uitkomst vastlegde, staat in de
-- audit trail. Op het formulier voegt het niets toe aan de beslissing zelf.
-- Wie het vastlegde komt straks wel terug in de post-analyse, daar hoort het.

update db_field set toon_op_formulier = 0
 where tabel = 'beoordelingsmoment'
   and kolom in ('vastgelegd_door', 'vastgelegd_op', 'aangemaakt_op');

insert into schema_versie (versie, omschrijving) values (64, 'besluit zonder systeemsectie');
