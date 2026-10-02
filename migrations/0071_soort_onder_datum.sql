-- Soort besluit hoort in de leeskolom.
--
-- Het veld stond rechts, alleen, met een lege kolom eronder: daar raakte het
-- zoek. Het zegt wát voor besluit dit is — instap, rol, vervroegd sluiten — en
-- dat lees je vlak na de datum, niet aan de overkant van het scherm.
--
-- Maar het was ook het enige veld dat zelf een kolom koos, en dáárop viel de
-- rest van het formulier terug: zodra niemand meer rechts wil staan, verdeelde
-- het scherm de velden om en om over twee kolommen. Een tabel kan dat nu zelf
-- zeggen: `db_table.formulier_kolommen` = 1 betekent alles onder elkaar.
alter table db_table add column formulier_kolommen integer not null default 2;

update db_table set formulier_kolommen = 1 where naam = 'beoordelingsmoment';

update db_field
   set kolom_rechts = 0, volgorde = 12
 where tabel = 'beoordelingsmoment' and kolom = 'soort';
