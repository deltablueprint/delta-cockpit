-- 0036 — De uitkomst legt de omvang vast als percentage, niet als aantal
--
-- Een besluit gaat over hoeveel van het kapitaal je inzet; het aantal
-- contracten dat daaruit volgt, is iets wat de uitvoering teruggeeft. Zo
-- staan de inzendingen en de uitkomst ook op dezelfde noemer (BOUWSPEC 5.4).
--
-- `aantal_contracten` blijft bestaan: dat is het veld waarin de uitvoering
-- straks wordt vastgelegd en waartegen het besluit vergeleken wordt (10.0e
-- punt 7). Het hoort alleen niet thuis in het blok waarin het gesprek zijn
-- uitkomst noteert.

alter table beoordelingsmoment add column inzet_pct real;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('beoordelingsmoment','inzet_pct','Inzet in % van het kapitaal','getal',75,'uitkomst',0,1,null,1,'150px',1);

update db_field set label = 'Aantal contracten (uit de uitvoering)'
 where tabel = 'beoordelingsmoment' and kolom = 'aantal_contracten';

update db_view
   set kolommen = '["datum","status","uitkomst","strike","expiratiedatum","inzet_pct","vastgelegd_door"]'
 where tabel = 'beoordelingsmoment' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (36, 'uitkomst in procent van het kapitaal');
