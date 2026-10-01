-- 0037 — Etappe 11: de positie als één record met een status
--
-- Eén uitgevoerde tranche is één record, met één statusveld dat zegt waar hij
-- staat (BOUWSPEC 10.0f). Wat eerder losse actieschermen waren, zijn standen
-- van dit record geworden.
--
-- De brokerkoppeling is er nog niet: in fase 1 vul je dezelfde velden met de
-- hand in (6). Het systeem plaatst nooit zelf een order — ook niet straks.

create table positie (
  id            integer primary key autoincrement,
  cyclus        integer not null references cyclus(id),
  beoordelingsmoment integer references beoordelingsmoment(id),
  tranche       integer not null default 1,
  status        text not null default 'besluit goedgekeurd',
  contract      text,
  strike        real,
  expiratiedatum text,
  aantal        integer,
  ontvangen_premie_pt real,
  inzet_pct     real,

  besluit_strike real,
  besluit_expiratiedatum text,
  besluit_inzet_pct real,

  stoploss_ask  real not null default 60.0,
  winstanker_pct real,
  break_even    real,
  eventregel    text,
  wie_volgt     text references gebruiker(id),

  uitvoering_op text,
  herkomst      text not null default 'handmatig',
  afwijking     integer not null default 0,
  afwijking_soort text,
  afwijking_toelichting text,

  uitkomst      text,
  sluittijdstip text,
  resultaat_pt  real,
  doorgerold_naar integer references positie(id),
  reden_exit    text,

  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create index positie_cyclus on positie (cyclus);

update db_table set titel_veld = 'contract', proces_veld = 'status',
                    related_weergave = 'tabbladen', nieuw_vanuit_lijst = 0
 where naam = 'positie';

insert into db_sectie (tabel, naam, label, volgorde) values
  ('positie','tranche',  'De tranche',            10),
  ('positie','besluit',  'Wat het besluit zei',   20),
  ('positie','exitplan', 'Exitplan',              30),
  ('positie','uitvoering','De uitvoering',        40),
  ('positie','einde',    'Uitkomst',              50),
  ('positie','systeem',  'Systeem',               90);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('positie','cyclus',             'Cyclus',                 'verwijzing',  5,'tranche',   1,1,'cyclus',1,'180px',0),
  ('positie','beoordelingsmoment', 'Beoordelingsmoment',     'verwijzing',  6,'tranche',   0,1,'beoordelingsmoment',1,'150px',0),
  ('positie','tranche',            'Tranche',                'getal',      10,'tranche',   1,0,null,1,'90px',1),
  ('positie','status',             'Status',                 'keuze',      20,'tranche',   1,0,null,1,'180px',1),
  ('positie','contract',           'Contract',               'tekst',      30,'tranche',   0,0,null,1,'240px',1),
  ('positie','strike',             'Strike',                 'getal',      40,'tranche',   0,0,null,1,'100px',1),
  ('positie','expiratiedatum',     'Expiratiedatum',         'datum',      50,'tranche',   0,0,null,1,'130px',1),
  ('positie','aantal',             'Aantal contracten',      'getal',      60,'tranche',   0,0,null,1,'130px',1),
  ('positie','ontvangen_premie_pt','Ontvangen premie (pt)',  'getal',      70,'tranche',   0,0,null,1,'150px',1),
  ('positie','inzet_pct',          'Inzet in % van het kapitaal','getal',  80,'tranche',   0,0,null,1,'150px',1),
  ('positie','besluit_strike',        'Besluit: strike',        'getal',  110,'besluit',0,1,null,1,'120px',1),
  ('positie','besluit_expiratiedatum','Besluit: expiratiedatum','datum',  120,'besluit',0,1,null,1,'150px',1),
  ('positie','besluit_inzet_pct',     'Besluit: inzet in %',    'getal',  130,'besluit',0,1,null,1,'130px',1),
  ('positie','stoploss_ask',   'Stoploss (ask)',                'getal',  210,'exitplan',1,0,null,1,'120px',1),
  ('positie','winstanker_pct', 'Winstanker (% van de premie)',  'getal',  220,'exitplan',0,0,null,1,'160px',1),
  ('positie','break_even',     'Break-even',                    'getal',  230,'exitplan',0,0,null,1,'120px',1),
  ('positie','eventregel',     'Welke events sluiten voortijdig','tekst', 240,'exitplan',0,0,null,1,'260px',1),
  ('positie','wie_volgt',      'Wie volgt dagelijks',           'verwijzing',250,'exitplan',0,0,'gebruiker',1,'160px',1),
  ('positie','uitvoering_op',  'Uitgevoerd op',                 'tijdstip',310,'uitvoering',0,0,null,1,'150px',1),
  ('positie','herkomst',       'Herkomst',                      'keuze',   320,'uitvoering',1,0,null,1,'120px',1),
  ('positie','afwijking',      'Afwijking van het besluit',     'ja_nee',  330,'uitvoering',0,1,null,1,'150px',1),
  ('positie','afwijking_soort','Soort afwijking',               'keuze',   340,'uitvoering',0,0,null,1,'160px',1),
  ('positie','afwijking_toelichting','Toelichting bij de afwijking','lang',350,'uitvoering',0,0,null,1,'280px',1),
  ('positie','uitkomst',       'Uitkomst',                      'keuze',   410,'einde',0,0,null,1,'180px',1),
  ('positie','sluittijdstip',  'Gesloten op',                   'tijdstip',420,'einde',0,0,null,1,'150px',1),
  ('positie','resultaat_pt',   'Resultaat in punten',           'getal',   430,'einde',0,0,null,1,'140px',1),
  ('positie','doorgerold_naar','Doorgerold naar',               'verwijzing',440,'einde',0,0,'positie',1,'150px',1),
  ('positie','reden_exit',     'Reden bij exitplan',            'tekst',   450,'einde',0,0,null,1,'240px',1),
  ('positie','toelichting',    'Toelichting',                   'lang',    800,'systeem',0,0,null,1,'280px',1),
  ('positie','aangemaakt_op',  'Aangemaakt op',                 'tijdstip',810,'systeem',0,1,null,0,'150px',1),
  ('positie','aangemaakt_door','Aangemaakt door',               'verwijzing',820,'systeem',0,1,'gebruiker',0,'160px',1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('positie','status','besluit goedgekeurd',  'Besluit goedgekeurd',  10,'grijs'),
  ('positie','status','exitplan vastgelegd',  'Exitplan vastgelegd',  20,'blauw'),
  ('positie','status','order bij lynx',       'Order bij Lynx',       30,'blauw'),
  ('positie','status','uitvoering vastgelegd','Uitvoering vastgelegd',40,'blauw'),
  ('positie','status','bewaken',              'Bewaken',              50,'oranje'),
  ('positie','status','gesloten',             'Gesloten',             60,'groen'),
  ('positie','herkomst','handmatig','Met de hand', 10,'grijs'),
  ('positie','herkomst','broker',   'Van de broker',20,'blauw'),
  ('positie','afwijking_soort','andere strike',    'Andere strike',     10,'oranje'),
  ('positie','afwijking_soort','andere expiratie', 'Andere expiratie',  20,'oranje'),
  ('positie','afwijking_soort','minder contracten','Minder contracten', 30,'oranje'),
  ('positie','afwijking_soort','slechtere fill',   'Slechtere fill',    40,'oranje'),
  ('positie','afwijking_soort','deels uitgevoerd', 'Deels uitgevoerd',  50,'oranje'),
  ('positie','afwijking_soort','anders',           'Anders',            60,'grijs'),
  ('positie','uitkomst','waardeloos geexpireerd', 'Waardeloos geëxpireerd', 10,'groen'),
  ('positie','uitkomst','vervroegd teruggekocht', 'Vervroegd teruggekocht', 20,'groen'),
  ('positie','uitkomst','doorgerold',             'Doorgerold',             30,'blauw'),
  ('positie','uitkomst','exitplan uitgevoerd',    'Exitplan uitgevoerd',    40,'rood');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('positie','standaard','["contract","status","strike","expiratiedatum","aantal","ontvangen_premie_pt","uitkomst"]','id desc');

-- Volgorde, geen waarschuwing: het exitplan ligt er vóór de order (6).
insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('positie','stoploss_ask','stoploss_ask nietleeg_als status notin besluit goedgekeurd',
   'Het exitplan gaat vóór de order: zet eerst de stoploss als ask-niveau.',1,1),
  ('positie','eventregel','eventregel nietleeg_als status notin besluit goedgekeurd',
   'Zet erbij welke events deze tranche voortijdig sluiten.',1,1),
  ('positie','wie_volgt','wie_volgt nietleeg_als status notin besluit goedgekeurd',
   'Leg vast wie deze tranche dagelijks volgt.',1,1),
  ('positie','afwijking_soort','afwijking_soort nietleeg_als afwijking = 1',
   'De uitvoering wijkt af van het besluit: kies het soort afwijking.',0,1),
  ('positie','afwijking_toelichting','afwijking_toelichting nietleeg_als afwijking = 1',
   'Leg vast waarom de uitvoering afwijkt van het besluit.',0,1),
  ('positie','reden_exit','reden_exit nietleeg_als uitkomst = exitplan uitgevoerd',
   'Bij een exitplan-uitvoering hoort een reden.',1,1),
  ('positie','doorgerold_naar','doorgerold_naar nietleeg_als uitkomst = doorgerold',
   'Wijs de opvolger aan waarnaar is doorgerold.',1,1);

insert into proces (id, naam, omschrijving, toepassing) values
  (2, 'Positie', 'Van goedgekeurd besluit tot vastgelegde uitkomst van één tranche.', 'positie');

insert into processtap (proces, volgorde, naam, stand, eigenaar, verplicht, afdwingt) values
  (2, 10, 'Exitplan vastleggen',   'besluit goedgekeurd',  'elke deelnemer', 1,
      'Stoploss als ask-niveau, winstanker, break-even, de eventregel en wie dagelijks volgt. Dit gaat vóór de order.'),
  (2, 20, 'Order bij Lynx',        'exitplan vastgelegd',  'simon', 1,
      'De order wordt door een mens geplaatst. Het systeem plaatst nooit zelf een order.'),
  (2, 30, 'Uitvoering vastleggen', 'order bij lynx',       'simon', 1,
      'Contract, strike, expiratie, aantal en ontvangen premie. Wijkt dat af van het besluit, dan hoort daar soort en toelichting bij.'),
  (2, 40, 'Bewaken',               'uitvoering vastgelegd','simon', 1,
      'De tranche loopt: laatprijs tegen de stoploss, buffer en resultaat.'),
  (2, 50, 'Uitkomst vastleggen',   'bewaken',              'elke deelnemer', 1,
      'Waardeloos geëxpireerd, vervroegd teruggekocht, doorgerold of exitplan uitgevoerd — altijd door een mens bevestigd.');

insert into schema_versie (versie, omschrijving) values (37, 'etappe 11: de positie');
