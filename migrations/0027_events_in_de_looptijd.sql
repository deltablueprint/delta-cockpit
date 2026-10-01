-- 0027 · de cyclus haalt zelf de events uit zijn periode op
--
-- Een cyclus bezit geen events, hij heeft een periode (BOUWSPEC 3.3). Maar met
-- de hand uitzoeken welke events in die periode vallen is werk dat het systeem
-- kan doen. Bij het opslaan van een cyclus worden de ontbrekende events uit de
-- periode erbij gezet, met behandeling 'nog te wegen' — het systeem vult dus
-- wél de regel aan, maar nooit het oordeel.

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('cyclus_event','behandeling','nog te wegen','Nog te wegen', 5, 'oranje');

-- Een motivering is verplicht zodra je iets anders kiest dan accepteren, maar
-- niet zolang het nog gewogen moet worden.
update db_rule
   set voorwaarde = 'motivering nietleeg_als behandeling notin accepteren|nog te wegen'
 where tabel = 'cyclus_event' and kolom = 'motivering';

-- Bestaande cycli meteen bijvullen.
insert or ignore into cyclus_event (cyclus, event, behandeling)
select c.id, e.id, 'nog te wegen'
  from cyclus c
  join event e
    on e.archief = 0
   and e.datum >= c.geopend_op
   and e.datum <= coalesce(c.doelexpiratie, c.afgesloten_op, '9999-12-31')
 where c.archief = 0;

insert into schema_versie (versie, omschrijving) values (27, 'events in de looptijd automatisch bijvullen');
