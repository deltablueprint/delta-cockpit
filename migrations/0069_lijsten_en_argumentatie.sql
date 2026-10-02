-- Een verwijzing die geen kindlijst oplevert.
--
-- Een inzending hangt aan het beoordelingsmoment; de cyclus staat er alleen bij
-- zodat je zonder omweg kunt filteren. Beide velden staan niet op het formulier,
-- dus leverden ze allebei een gerelateerde lijst op — en zo kwamen de
-- inzendingen ook onder de cyclus te staan, waar ze niet horen. `geen_lijst`
-- zegt per veld dat deze verwijzing geen tabblad verdient.
alter table db_field add column geen_lijst integer not null default 0;

update db_field set geen_lijst = 1
 where tabel = 'inzending' and kolom = 'cyclus';

-- De motivering hoort bij allebei.
--
-- Het veld heette 'Reden bij no-go' en kwam alleen in beeld bij een no-go. Maar
-- waarom je wél wilt schrijven is net zo goed het gesprek waard als waarom je
-- het niet wilt: het veld heet nu Argumentatie en staat er altijd.
update db_field
   set label = 'Argumentatie', toon_als = null, verplicht = 1
 where tabel = 'inzending' and kolom = 'reden';

update db_rule
   set voorwaarde = 'reden nietleeg',
       melding    = 'Schrijf op waarom: zonder argumentatie is een inzending geen oordeel.'
 where tabel = 'inzending' and kolom = 'reden';
