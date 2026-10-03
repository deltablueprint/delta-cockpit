-- De live verbinding met de broker.
--
-- Het Flex-rapport blijft bestaan als nachtelijke controle, maar het is niet
-- langer de bron waar de cockpit op werkt. Die bron is nu een doorlopende
-- verbinding: de brug luistert naast IB Gateway en duwt elke verandering
-- meteen door. Drie tabellen, elk met één taak.

-- Wat er op dit moment bij de broker open staat. Eén regel per contract; de
-- brug is de enige die hem vult, en hij overschrijft steeds het hele beeld.
create table brokerpositie (
  conid          text primary key,
  contract       text,
  onderliggend   text,
  soort          text,
  strike         real,
  expiratiedatum text,
  putcall        text,
  multiplier     real,
  aantal         real not null,
  gem_kostprijs  real,
  marktprijs     real,
  waarde         real,
  ongerealiseerd real,
  gerealiseerd   real,
  gewijzigd_op   text not null default (datetime('now'))
);

-- Wat de brug zag gebeuren, in volgorde en nooit overschreven. Dit is het
-- spoor waarmee een tranche aan haar einde geduid wordt: een aantal dat naar
-- nul gaat, een uitvoering met haar prijs. De audit trail gaat over wat mensen
-- deden; dit gaat over wat de markt deed.
create table brokergebeurtenis (
  id        integer primary key autoincrement,
  soort     text not null,                     -- positie | uitvoering | verbinding
  conid     text,
  contract  text,
  richting  text,
  aantal    real,
  van       real,
  naar      real,
  prijs     real,
  uitvoering_id text unique,                   -- execId: dezelfde fill komt nooit twee keer binnen
  moment    text,
  ontvangen_op text not null default (datetime('now'))
);
create index brokergebeurtenis_tijd on brokergebeurtenis (id desc);

-- De stand van de verbinding zelf. Eén regel, altijd dezelfde. Zonder dit zou
-- de cockpit stil oude getallen tonen als de brug eruit ligt, en dat is erger
-- dan niets tonen.
create table brokerverbinding (
  id              integer primary key check (id = 1),
  verbonden       integer not null default 0,
  laatste_bericht text,
  rekening        text,
  kapitaal        real,
  reden           text
);
insert into brokerverbinding (id, verbonden) values (1, 0);

insert or ignore into schema_versie (versie, omschrijving) values
  (78, 'de brug: live verbinding met de broker');
