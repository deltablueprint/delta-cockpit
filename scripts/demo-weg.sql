-- Alle demo weg. Alleen voor staging; GEEN migratie.
--
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-weg.sql
--
-- Draai dit voordat je met echte posities gaat werken: een demo-cyclus die
-- blijft staan is een cyclus waar de herkenning een echte tranche aan kan
-- hangen, en dan staat er een paper-positie in een verzonnen maand. Alles komt
-- terug met demo-dispatch.sql en demo-historie.sql — die scripts zijn hun eigen
-- opruiming.
--
-- De demo-leden blijven staan: die hangen aan verstuurde berichten uit de
-- historie en zijn verder niemand tot last.

-- ---------- opruimen van een eerdere demo ----------
-- Alles wat aan de demo-cyclus hangt moet mee, en in deze volgorde. Liep je op
-- de demo een concept op (Dispatch maakt er een bij publiceren), dan wees er een
-- rij in publicatie naar de positie en de gebeurtenis, en weigerde het opruimen
-- met FOREIGN KEY constraint failed. Verwijzingen náár een rij worden daarom
-- eerst losgemaakt; verwijzingen die een rij zelf uitdeelt hinderen een delete
-- niet.
--
-- Geen tijdelijke tabellen en geen pragma's: D1 staat die niet toe en antwoordt
-- met 'not authorized: SQLITE_AUTH'. Elke regel zoekt de demo dus opnieuw op via
-- het label, en de volgorde zorgt dat die zoektocht nog iets vindt.
update gebeurtenis    set publicatie = null where publicatie in (select id from publicatie where cyclus in (select id from cyclus where label = 'DEMO · dispatch') or positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label = 'DEMO · dispatch')));
update barometerstand set publicatie = null where publicatie in (select id from publicatie where cyclus in (select id from cyclus where label = 'DEMO · dispatch') or positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label = 'DEMO · dispatch')));
update positie        set doorgerold_naar = null where cyclus in (select id from cyclus where label = 'DEMO · dispatch');

delete from publicatie_ontvanger where publicatie in (select id from publicatie where cyclus in (select id from cyclus where label = 'DEMO · dispatch') or positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label = 'DEMO · dispatch')));
delete from publicatie   where cyclus in (select id from cyclus where label = 'DEMO · dispatch') or positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label = 'DEMO · dispatch'));
delete from barometerstand where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from gebeurtenis    where cyclus in (select id from cyclus where label = 'DEMO · dispatch') or positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch'));
delete from positiemeting  where positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch'));
delete from positievolger  where positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch'));
delete from exitregel      where positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch'));
delete from voornemen      where positie in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch')) or opvolger in (select id from positie where cyclus in (select id from cyclus where label = 'DEMO · dispatch'));
delete from positie        where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from voorwaarde         where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from chartlezing        where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from beoordelingsmoment where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from inzending          where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from cyclus_event       where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from brokerpositie where conid like '9900%';
delete from cyclus        where label = 'DEMO · dispatch';

-- ---------- opruimen ----------
update gebeurtenis    set publicatie = null where publicatie in (select id from publicatie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.') or positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')));
update barometerstand set publicatie = null where publicatie in (select id from publicatie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.') or positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')));
update positie        set doorgerold_naar = null where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from publicatie_ontvanger where publicatie in (select id from publicatie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.') or positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')));
delete from publicatie   where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.') or positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.'));
delete from barometerstand where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from gebeurtenis    where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.') or positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.'));
delete from positiemeting  where positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.'));
delete from positievolger  where positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.'));
delete from exitregel      where positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.'));
delete from voornemen      where positie in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.')) or opvolger in (select id from positie where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.'));
delete from positie        where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from voorwaarde         where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from chartlezing        where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from beoordelingsmoment where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from inzending          where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from cyclus_event       where cyclus in (select id from cyclus where toelichting = 'Demo-historie. Niet echt.');
delete from cyclus where toelichting = 'Demo-historie. Niet echt.';

-- En de demo-events uit de looptijd.
delete from cyclus_event where event in (select id from event where naam like 'DEMO · %');
delete from event where naam like 'DEMO · %';
