-- 0053 — De actiestappen onder de chevronbalk
--
-- Per fase staat er wat er gedaan moet worden, en elke stap vinkt zichzelf af
-- zodra het gebeurd is. Dat afvinken is geen code per scherm maar een naam op
-- de processtap (`afvinkregel`) die de worker kent. Een stap toevoegen is dus
-- een regel hier; alleen een nieuwe soort controle vraagt om code.

alter table processtap add column fase text;
alter table processtap add column afvinkregel text;
alter table processtap add column uitleg text;

-- De oude stappen horen bij het oude model.
update processtap set archief = 1;
update proces set archief = 1 where id not in (1, 2);

update proces set naam = 'Cyclus', omschrijving = 'De boog: van pre-analyse tot afgesloten.', toepassing = 'cyclus' where id = 1;
update proces set naam = 'Positie', omschrijving = 'Eén tranche: van exitplan tot vastgelegde uitkomst.', toepassing = 'positie' where id = 2;
insert into proces (id, naam, omschrijving, toepassing) values
  (3, 'Besluit', 'Eén beslissing: wie er bij was, wat ieder vond, en wat het werd.', 'beoordelingsmoment');

-- ------------------------------------------------------------- cyclus
insert into processtap (proces, volgorde, naam, stand, fase, eigenaar, verplicht, afvinkregel, uitleg) values
  (1, 10, 'Events in de looptijd behandeld', 'pre-analyse','pre-analyse','elke deelnemer',1,'events_behandeld',
      'Elk event binnen de looptijd heeft een behandeling gekregen.'),
  (1, 20, 'Instapvoorwaarden ingevuld',      'pre-analyse','pre-analyse','elke deelnemer',1,'voorwaarden_ingevuld',
      'Elke instapvoorwaarde heeft een gemeten waarde en een status.'),
  (1, 30, 'Volgend analysemoment geprikt',   'pre-analyse','pre-analyse','elke deelnemer',0,'analysemoment_geprikt',
      'Er staat een datum waarop jullie samen opnieuw kijken.'),
  (1, 40, 'Besluit aangemaakt',              'pre-analyse','pre-analyse','elke deelnemer',1,'besluit_aangemaakt',
      'Een besluit openen brengt de cyclus naar besluitvorming.'),
  (1, 50, 'Besluit afgerond',          'besluitvorming','besluitvorming','elke deelnemer',1,'besluit_afgerond',
      'Elk lopend besluit heeft een uitkomst. Een go brengt de cyclus naar in positie.'),
  (1, 60, 'Tranche in de markt',       'in positie','in positie','simon',1,'tranche_in_de_markt',
      'Minstens één tranche is uitgevoerd en gepubliceerd.'),
  (1, 70, 'Alle tranches gesloten',    'in positie','in positie','simon',1,'alle_tranches_dicht',
      'Zolang er één openstaat, blijft de cyclus lopen. Een rol verlengt de boog.'),
  (1, 80, 'Resultaat en toetsing',     'post-analyse','post-analyse','jacqueline',1,'postanalyse_gedaan',
      'Resultaat per tranche, en het oordeel over de voorwaarden achteraf.');

-- ------------------------------------------------------------- besluit
insert into processtap (proces, volgorde, naam, stand, fase, eigenaar, verplicht, afvinkregel, uitleg) values
  (3, 10, 'Aanwezigen gekozen', 'aanwezigen bepalen','aanwezigen bepalen','elke deelnemer',1,'aanwezigen_gekozen',
      'Wie beslist er mee? Het aantal aanwezigen is het quorum.'),
  (3, 20, 'Reden bij alleen beslissen', 'aanwezigen bepalen','aanwezigen bepalen','elke deelnemer',0,'alleen_toegelicht',
      'Beslist er maar één, dan hoort daar een toelichting bij. Het besluit draagt die vlag mee.'),
  (3, 30, 'Iedereen heeft blind ingezonden', 'blind inzenden','blind inzenden','elke deelnemer',1,'inzendingen_binnen',
      'Wat erin staat blijft dicht tot de laatste aanwezige verstuurd heeft.'),
  (3, 40, 'Het gesprek gevoerd', 'inzendingen open','inzendingen open','jacqueline',1,'gesprek_vastgelegd',
      'Wat het gesprek veranderde, staat opgeschreven.'),
  (3, 50, 'Uitkomst vastgelegd', 'inzendingen open','inzendingen open','jacqueline',1,'uitkomst_vastgelegd',
      'Go of no-go. Bij een go ontstaat het positierecord vanzelf.');

-- ------------------------------------------------------------- positie
insert into processtap (proces, volgorde, naam, stand, fase, eigenaar, verplicht, afvinkregel, uitleg) values
  (2, 10, 'Exitplan vastgelegd', 'exitplan en order','exitplan en order','elke deelnemer',1,'exitplan_compleet',
      'Stoplossniveau en eventregel staan vast vóór de order weggaat.'),
  (2, 20, 'Order geplaatst bij Lynx', 'exitplan en order','exitplan en order','simon',1,'order_geplaatst',
      'Een mens plaatst de order. Het systeem doet dat nooit.'),
  (2, 30, 'Uitvoering gekoppeld', 'uitvoering ophalen','uitvoering ophalen','simon',1,'uitvoering_gekoppeld',
      'De positie bij Lynx is aangewezen; contract, aantal en premie komen daaruit.'),
  (2, 40, 'Afwijking geduid', 'uitvoering ophalen','uitvoering ophalen','simon',0,'afwijking_geduid',
      'Liep het anders dan besloten, dan staat erbij wat en waarom.'),
  (2, 50, 'Bericht naar de leden', 'publiceren naar leden','publiceren naar leden','jacqueline',1,'publicatie_verstuurd',
      'Eerst het feit vastleggen, dan het verhaal. Daarna begint het bewaken.'),
  (2, 60, 'Uitkomst vastgelegd', 'bewaken','bewaken','elke deelnemer',1,'tranche_uitkomst',
      'Waardeloos geëxpireerd, teruggekocht, doorgerold of exitplan uitgevoerd.');

insert into schema_versie (versie, omschrijving) values (53, 'actiestappen per fase');
