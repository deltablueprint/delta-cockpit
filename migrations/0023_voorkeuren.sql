-- 0023 · persoonlijke voorkeuren
-- Hoe breed iemand zijn kolommen wil, is van die persoon — niet van de tabel.
-- De breedte in db_field blijft de standaard waar iedereen mee begint; wat
-- iemand zelf versleept, komt hier te staan en reist mee naar elk apparaat.

create table gebruiker_voorkeur (
  gebruiker text not null references gebruiker(id),
  sleutel   text not null,
  waarde    text not null,
  gewijzigd text not null default (datetime('now')),
  primary key (gebruiker, sleutel)
);

-- De tijdstipkolom was te smal: er staat nu "14:30 CEST" in, en bij een event
-- uit een andere zone ook de lokale tijd eronder.
update db_field set breedte = '150px' where tabel = 'event' and kolom = 'tijdstip';

insert into schema_versie (versie, omschrijving) values (23, 'persoonlijke voorkeuren');
