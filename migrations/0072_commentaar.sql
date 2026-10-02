-- 'Wat het gesprek veranderde' heet commentaar.
--
-- Het label stelde een vraag en het invulveld herhaalde die vraag nog eens; wie
-- het invult weet zelf wel waar het over gaat.
update db_field set label = 'Commentaar'
 where tabel = 'beoordelingsmoment' and kolom = 'wat_veranderde';
