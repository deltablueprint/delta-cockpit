-- 0049 — Het Flex-rapport wordt aangeleverd, niet opgehaald
--
-- IBKR weigert verzoeken die van Cloudflare komen ("Access denied for
-- 141.101.76.100"): datacenterverkeer wordt geweerd vóór ons token ook maar
-- bekeken wordt. De worker kan het rapport dus niet zelf halen.
--
-- Daarom draait het ophalen op een machine met een gewoon IP, en levert die
-- het rapport hier af. Dat verandert niets aan het uitgangspunt: er gaat nog
-- steeds alleen informatie van de broker naar ons, nooit andersom.

create table lynx_rapport (
  id            integer primary key autoincrement,
  xml           text not null,
  opgehaald_op  text not null default (datetime('now')),
  bron          text not null default 'script',
  regels        integer
);

insert into schema_versie (versie, omschrijving) values (49, 'flex-rapport wordt aangeleverd');
