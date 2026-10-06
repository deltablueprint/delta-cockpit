-- De koersen van de demo terug op nu. Alleen voor staging; GEEN migratie.
--
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-koersen.sql
--
-- De barometer meet alleen op een verse prijs (instelling koers_vers_minuten,
-- standaard 20 minuten). Een demo die gisteren ingeladen is, meet dus niets
-- meer: de balk wordt grijs en het scherm zegt 'de prijs is te oud'. Dit zet
-- dezelfde prijzen terug met het tijdstip van nu. Het mag zo vaak als je wil.
delete from brokerpositie where conid like '9900%';
insert into brokerpositie (conid, contract, onderliggend, soort, strike, expiratiedatum, putcall,
                           multiplier, aantal, marktprijs, biedprijs, laatprijs, gewijzigd_op)
select p.conid, p.contract, 'OESX', 'OPT', p.strike, p.expiratiedatum, 'P', 10, -p.aantal,
       case p.tranche when 1 then 51.0 when 2 then 14.0 else 1.4 end,
       case p.tranche when 1 then 50.0 when 2 then 13.5 else 1.2 end,
       case p.tranche when 1 then 52.0 when 2 then 14.5 else 1.5 end,
       datetime('now')
  from positie p join cyclus c on c.id = p.cyclus
 where c.label = 'DEMO · dispatch' and p.conid like '9900%' and p.uitkomst is null;
