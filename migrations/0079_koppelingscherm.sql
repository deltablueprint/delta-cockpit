-- Het scherm van de brokerkoppeling.
--
-- Een koppeling die stil kan uitvallen, hoort een plek te hebben waar je ziet
-- dat ze leeft. Niet weggestopt in een logbestand op een machine waar je nooit
-- komt, maar in het menu, naast de andere inrichting.
insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Brokerkoppeling', 'BEHEER', null, '/koppeling', null, 105);

-- Wat je aan de koppeling mag veranderen zonder op de machine in te loggen.
-- Nadrukkelijk niet: tokens, sleutels en wachtwoorden. Die staan in Cloudflare
-- en op de brugmachine, en horen nergens in een scherm thuis — ook niet
-- afgeschermd, want een veld dat een geheim kan tonen is een veld dat het ooit
-- toont.
--
-- De brug haalt deze instellingen op in het antwoord op zijn eigen zending. Zo
-- komt een wijziging binnen tien seconden aan zonder dat de cockpit ooit iets
-- naar de brug hoeft te sturen: het verkeer blijft één kant op.
create table brokerinstelling (
  sleutel     text primary key,
  waarde      text not null,
  label       text not null,
  uitleg      text,
  soort       text not null default 'getal',    -- getal | ja_nee | tekst
  volgorde    integer not null default 100,
  gewijzigd   text not null default (datetime('now')),
  gewijzigd_door text
);

insert into brokerinstelling (sleutel, waarde, label, uitleg, soort, volgorde) values
  ('hartslag_seconden', '10', 'Hartslag',
   'Hoe vaak de brug van zich laat horen, ook als er niets gebeurt. Korter is sneller merken dat hij weg is, en meer verkeer.', 'getal', 10),
  ('stilte_grens_seconden', '35', 'Stiltegrens',
   'Hoe lang stilte nog normaal is. Daarna staat de koppeling op weg en zegt elk scherm dat erbij. Houd dit ruim boven de hartslag.', 'getal', 20),
  ('marktdata', '0', 'Koersen meesturen',
   'Of de brug ook de koers van de open contracten volgt. Vereist een abonnement op Eurex-data bij IBKR; zonder dat abonnement komt er niets door en kost het niets.', 'ja_nee', 30),
  ('flex_vangnet', '1', 'Flex als nachtelijk vangnet',
   'Het Flex-rapport één keer per nacht ophalen om aan te vullen wat de brug gemist heeft als hij eruit lag, en om prijzen en commissies te corrigeren.', 'ja_nee', 40);

insert or ignore into schema_versie (versie, omschrijving) values
  (79, 'het scherm van de brokerkoppeling');

-- De bied- en laatprijs van een open contract, als de brug koersen meestuurt.
-- Voor een geschreven optie is de laatprijs wat het kost om eruit te stappen,
-- en dus de prijs waar het exitplan op rekent.
alter table brokerpositie add column biedprijs real;
alter table brokerpositie add column laatprijs real;
