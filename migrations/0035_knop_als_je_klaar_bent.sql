-- 0035 — Eén knop, drie standen
--
-- De knop rechtsboven hoort te zeggen wat er nú van jou verwacht wordt. Bij
-- de go/no-go zijn dat drie dingen achter elkaar: eerst zelf blind versturen,
-- dan wachten tot het quorum er is, dan het gesprek. Dat derde label stond
-- er al (de volgende stap); dit is het tweede.
--
-- Het blijft definitie en geen code: ook dit label staat op de processtap.

alter table processtap add column actieknop_klaar text;

update processtap set actieknop_klaar = 'Wachten op de anderen'
 where actieknop = 'Positie blind versturen';

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('processtap','actieknop_klaar','Actieknop als jij klaar bent','tekst',85,'knop',0,0,null,1,'200px',1);

insert into schema_versie (versie, omschrijving) values (35, 'knop als je klaar bent');
