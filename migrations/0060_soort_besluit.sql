-- 0060 — Een nieuw besluit is een instapbesluit
--
-- Het soort stuurt de flow: een instapbesluit gaat met een blinde ronde, een
-- rol of een vervroegde sluiting niet. Verreweg de meeste besluiten zijn
-- instapbesluiten, dus dat is de startwaarde — en geen streepje dat je eerst
-- moet invullen voordat het scherm iets zegt.

update db_field set standaard = 'instap'
 where tabel = 'beoordelingsmoment' and kolom = 'soort';

insert into schema_versie (versie, omschrijving) values (60, 'soort besluit begint op instap');
