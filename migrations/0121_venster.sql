-- 0121 · het venster krijgt de standen die het nodig heeft
--
-- Het venster had er drie: open, wacht, dicht. Dat was gebouwd op de verkeerde
-- vraag — 'kunnen wij instappen'. Het venster gaat niet over ons maar over de
-- voorbereidingstijd van een lid: elke maand ligt het instapmoment anders, en
-- wie pas hoort dat we erin zitten als we erin zitten, is mentaal te laat.
--
-- Dus een verloop in plaats van een schakelaar, met twee standen die vooraf
-- waarschuwen ('besluit loopt', 'opent binnenkort') en twee die achteraf zeggen
-- hoe het afliep.
delete from db_choice where tabel = 'barometerstand' and kolom = 'venster';

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('barometerstand','venster','gesloten',        'Gesloten',         10,'grijs'),
  ('barometerstand','venster','besluit',         'Besluit loopt',    20,'blauw'),
  ('barometerstand','venster','opent_binnenkort','Opent binnenkort', 30,'oranje'),
  ('barometerstand','venster','open',            'Open',             40,'groen'),
  ('barometerstand','venster','in_positie',      'In positie',       50,'blauw'),
  ('barometerstand','venster','gemist',          'Venster gemist',   60,'grijs'),
  ('barometerstand','venster','afgerond',        'Afgerond',         70,'grijs');

-- Wat er al vastligt, verhuist mee. 'wacht' lag het dichtst bij 'besluit loopt';
-- 'dicht' bij 'gesloten'. Er wordt niets gewist: standen zijn vastlegging.
update barometerstand set venster = 'gesloten' where venster = 'dicht';
update barometerstand set venster = 'besluit'  where venster = 'wacht';

-- ---------------------------------------------- de kaart die het bijstelt
--
-- Niet een trigger op 'er is een besluit aangemaakt' maar het verschil tussen
-- waar het proces staat en wat de leden zien. Mis je de trigger — de motor lag
-- stil, iemand klikte hem weg — dan is het verschil er morgen nog, en komt de
-- kaart gewoon terug.
--
-- Twee standen worden met opzet nooit voorgesteld: 'opent binnenkort' en 'open'.
-- Dat is jullie oordeel over de markt, en juist die twee zijn voor een lid het
-- meeste waard. Een systeem dat die zelf zet, zet ze een keer verkeerd.
-- De aanleiding rekent de verwachte stand één keer uit in een binnenste select,
-- en vergelijkt hem buiten. Twee keer dezelfde CASE schrijven werkte ook, maar
-- dan staan er twee plekken die uit elkaar kunnen lopen.
--
-- Er staat met opzet geen SQL-commentaar in: de motor weigert dat (een -- in een
-- ingerichte query is een manier om de rest te laten verdwijnen).
--
-- 'opent_binnenkort', 'open' en 'gemist' worden nooit voorgesteld en nooit
-- overschreven: dat is jullie oordeel over de markt.
insert into processtap
  (proces, volgorde, naam, eigenaar, verplicht,
   kaartsoort, bron, voorwaarde, aanleiding, sleutel_bron, eigenaar_bron,
   prioriteit, opschalen_na_uur, opschalen_naar,
   reden, kaarttitel, feiten,
   knop1_label, knop1_doel, knop2_label, knop2_doel, knop2_reden_verplicht,
   prullenbak, prullenbak_doel)
values
  (4, 45, 'Venster bijstellen', 'elke deelnemer', 1,
   'venster', 'meting', 'soort = ''venster_open''',
   'select cyclus, cyclus || '':'' || verwacht as sleuteldeel,
           ''Venster staat op '' || coalesce(nu_label, ''niets'') as titel,
           ''Het proces is verder dan wat de leden zien.'' as detail
      from (select c.id as cyclus, b.venster as nu, k.label as nu_label,
                   case
                     when c.status in (''afgesloten'', ''geannuleerd'') then ''afgerond''
                     when exists (select 1 from positie p where p.cyclus = c.id
                                   and p.archief = 0
                                   and p.status not in (''gesloten'', ''voorgenomen''))
                       then ''in_positie''
                     when exists (select 1 from beoordelingsmoment m where m.cyclus = c.id
                                   and m.archief = 0 and m.status <> ''uitkomst vastgelegd'')
                       then ''besluit''
                     else ''gesloten''
                   end as verwacht
              from cyclus c
              left join barometerstand b on b.id = (select b2.id from barometerstand b2
                     where b2.cyclus = c.id and b2.archief = 0
                     order by b2.vastgesteld_op desc, b2.id desc limit 1)
              left join db_choice k on k.tabel = ''barometerstand''
                     and k.kolom = ''venster'' and k.waarde = b.venster
             where c.archief = 0)
     where coalesce(nu, ''-'') <> verwacht
       and coalesce(nu, ''-'') not in (''opent_binnenkort'', ''open'', ''gemist'')',
   'aanleiding', 'iedereen',
   'medium', 24, 'hoog',
   'Het proces is verder dan wat de leden zien.',
   'Venster bijstellen',
   '["cyclus.naam"]',
   'Venster zetten', 'scherm',
   null, null, 0,
   1, 'afsluiten');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','kaartsoort','venster','Venster bijstellen',45,'blauw');

insert into schema_versie (versie, omschrijving) values (121, 'het venster krijgt de standen die het nodig heeft');
