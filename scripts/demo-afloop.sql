-- Demo voor 'Einde van een tranche'. Laden met:
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-afloop.sql
--
-- Opruimen gaat zoals alles in deze applicatie: archiveren, niet wissen.
--   update positie set archief = 1 where cyclus = (select id from cyclus where label = 'DEMO · einde van een tranche');
--   update cyclus  set archief = 1 where label = 'DEMO · einde van een tranche';

insert into cyclus (label, status, geopend_op, doelexpiratie, toelichting)
values ('DEMO · einde van een tranche', 'in positie', '2026-09-01', '2026-10-30',
        'Demo met een nagemaakt Flex-rapport. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 1, 'bewaken', 'OESX 30OKT26 5600 PUT', 5600, '2026-10-30', 2, 38.5, '7000001', 24, 'handmatig'
  from cyclus where label = 'DEMO · einde van een tranche';

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 2, 'bewaken', 'OESX 30OKT26 5700 PUT', 5700, '2026-10-30', 1, 44.0, '7000002', 12, 'handmatig'
  from cyclus where label = 'DEMO · einde van een tranche';

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 3, 'bewaken', 'OESX 18DEC26 5400 PUT', 5400, '2026-12-18', 1, 52.0, '7000004', 10, 'handmatig'
  from cyclus where label = 'DEMO · einde van een tranche';

-- Een stoploss die geraakt is op tranche 2: dan stelt het systeem daar
-- 'exitplan uitgevoerd' voor in plaats van 'vervroegd teruggekocht'.
insert into exitregel (positie, volgorde, soort, omschrijving, niveau, eenheid, stand, geraakt_op)
select p.id, 10, 'stoploss', 'Sluiten zodra de laatprijs op 60,0 staat', 60, 'ask', 'geraakt', '2026-09-30'
  from positie p join cyclus c on c.id = p.cyclus
 where c.label = 'DEMO · einde van een tranche' and p.tranche = 2;

insert into lynx_rapport (xml, bron, regels, opgehaald_op)
values ('<?xml version="1.0" encoding="UTF-8"?>
<!-- Nagemaakt Flex-rapport voor het toetsen van de herkenning aan het einde van
     een tranche. Vier gevallen in één rapport:

       A  5600 PUT 30 okt  — teruggekocht, dezelfde dag 5500 PUT 20 nov geschreven  (rol)
       B  5700 PUT 30 okt  — teruggekocht, niets erna                               (vervroegd)
       C  5800 PUT 18 sep  — staat niet meer open, geen terugkoop, expiratie voorbij (waardeloos)
       D  5400 PUT 18 dec  — staat gewoon open                                      (niets)

     De bedragen zijn verzonnen maar in de orde van grootte die hoort bij OESX
     met multiplier 10. -->
<FlexQueryResponse queryName="Delta" type="AF">
 <FlexStatements count="1">
  <FlexStatement accountId="DU1234567" fromDate="20260901" toDate="20261003">

   <OpenPositions>
    <OpenPosition accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 20NOV26 5500 PUT" conid="7000005" strike="5500" expiry="20261120" putCall="P"
      position="-2" multiplier="10" openPrice="41.0" costBasisPrice="40.6" />
    <OpenPosition accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 18DEC26 5400 PUT" conid="7000004" strike="5400" expiry="20261218" putCall="P"
      position="-1" multiplier="10" openPrice="52.0" costBasisPrice="51.5" />
   </OpenPositions>

   <Trades>
    <!-- A · geopend, teruggekocht en doorgerold -->
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 30OKT26 5600 PUT" conid="7000001" strike="5600" expiry="20261030" putCall="P"
      buySell="SELL" openCloseIndicator="O" quantity="-2" tradePrice="38.5" multiplier="10"
      ibCommission="-3.10" netCash="766.90" tradeDate="20260915" dateTime="20260915;101500" />
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 30OKT26 5600 PUT" conid="7000001" strike="5600" expiry="20261030" putCall="P"
      buySell="BUY" openCloseIndicator="C" quantity="2" tradePrice="12.0" multiplier="10"
      ibCommission="-3.10" netCash="-243.10" tradeDate="20261002" dateTime="20261002;143000" />
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 20NOV26 5500 PUT" conid="7000005" strike="5500" expiry="20261120" putCall="P"
      buySell="SELL" openCloseIndicator="O" quantity="-2" tradePrice="41.0" multiplier="10"
      ibCommission="-3.10" netCash="816.90" tradeDate="20261002" dateTime="20261002;143200" />

    <!-- B · geopend en vervroegd teruggekocht -->
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 30OKT26 5700 PUT" conid="7000002" strike="5700" expiry="20261030" putCall="P"
      buySell="SELL" openCloseIndicator="O" quantity="-1" tradePrice="44.0" multiplier="10"
      ibCommission="-1.55" netCash="438.45" tradeDate="20260917" dateTime="20260917;094500" />
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 30OKT26 5700 PUT" conid="7000002" strike="5700" expiry="20261030" putCall="P"
      buySell="BUY" openCloseIndicator="C" quantity="1" tradePrice="9.5" multiplier="10"
      ibCommission="-1.55" netCash="-96.55" tradeDate="20260930" dateTime="20260930;111000" />

    <!-- C · geopend in augustus, nooit teruggekocht, expiratie voorbij -->
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 18SEP26 5800 PUT" conid="7000003" strike="5800" expiry="20260918" putCall="P"
      buySell="SELL" openCloseIndicator="O" quantity="-1" tradePrice="36.0" multiplier="10"
      ibCommission="-1.55" netCash="358.45" tradeDate="20260814" dateTime="20260814;103000" />

    <!-- D · geopend en staat nog open -->
    <Trade accountId="DU1234567" assetCategory="OPT" symbol="OESX" underlyingSymbol="OESX"
      description="OESX 18DEC26 5400 PUT" conid="7000004" strike="5400" expiry="20261218" putCall="P"
      buySell="SELL" openCloseIndicator="O" quantity="-1" tradePrice="52.0" multiplier="10"
      ibCommission="-1.55" netCash="518.45" tradeDate="20260925" dateTime="20260925;133000" />
   </Trades>

  </FlexStatement>
 </FlexStatements>
</FlexQueryResponse>
', 'demo', 7, '2026-10-03 09:00:00');
