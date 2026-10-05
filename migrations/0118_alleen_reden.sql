-- 0118 · 'waarom alleen besloten' alleen tonen als er één iemand was
--
-- Het veld stond er altijd, ook bij drie aanwezigen, en was niet verplicht.
-- Daardoor bleef de stap 'Reden bij alleen beslissen' openstaan zonder dat
-- iemand doorhad waar hij het moest invullen.
--
-- toon_als kent sinds nu ook aantal(kolom): dat telt een lijstje in plaats van
-- een waarde te vergelijken.
update db_field
   set toon_als = 'aantal(aanwezigen_ids) = 1',
       verplicht = 1
 where tabel = 'beoordelingsmoment' and kolom = 'alleen_reden';

insert into schema_versie (versie, omschrijving) values (118, 'waarom alleen besloten: alleen tonen bij één aanwezige, en dan verplicht');
