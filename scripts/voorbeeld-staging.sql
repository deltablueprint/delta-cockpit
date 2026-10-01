-- Voorbeelddata, alleen voor staging. Dit is GEEN migratie: het hoort niet in
-- migrations/ en wordt nooit op productie toegepast. Het dient om schermen te
-- kunnen beoordelen voordat er echte cycli zijn.
-- Opnieuw draaien mag: het maakt eerst schoon.

delete from voorwaarde;
delete from cyclus;

insert into cyclus (id, label, status, geopend_op, doelexpiratie, volgend_analysemoment, toelichting, aangemaakt_door) values
  (1,'Cyclus 2026-10','go-nogo',   '2026-09-14','2026-11-20','2026-09-29','Voorbeeld — lopende cyclus','simon'),
  (2,'Cyclus 2026-09','afgesloten','2026-08-10','2026-09-18',null,        'Voorbeeld — afgesloten met winst','jacqueline'),
  (3,'Cyclus 2026-08','afgesloten','2026-07-06','2026-08-21',null,        'Voorbeeld','pieter');

update cyclus set resultaat_pt = 24.0,  eerste_instap='2026-08-14', afgesloten_op='2026-09-18' where id = 2;
update cyclus set resultaat_pt = 38.5,  eerste_instap='2026-07-10', afgesloten_op='2026-08-21' where id = 3;

insert into voorwaarde (cyclus, naam, soort, bron, gemeten_waarde, status, gemeten_door, gemeten_op, volgorde) values
  (1,'Daling t.o.v. vorige top','instap','SX5E · slot vs top aug','2,4 %',  'groen', 'simon',     '2026-09-29 11:10',10),
  (1,'Snelheid van de daling',  'instap','handelskalender',       '4 dagen','rood',  'simon',     '2026-09-29 11:10',20),
  (1,'VSTOXX bandbreedte',      'instap','VSTOXX slot',           '18,4',   'groen', 'simon',     '2026-09-29 11:10',30),
  (1,'Skew OTM-put',            'instap','IV 6050P ÷ ATM bij Lynx','+23 %', 'groen', 'jacqueline','2026-09-29 09:45',40),
  (1,'Volumebevestiging',       'instap','volume vs 20-daags',    '0,8×',   'rood',  'simon',     '2026-09-29 11:10',50),
  (1,'Herstel na zwaar event',  'instap','eventskalender',        '4 dagen','groen', 'simon',     '2026-09-29 11:10',60),
  (1,'Technische analyse',      'instap','Pieter · chartlezing',  'oranje', 'oranje','pieter',    '2026-09-28 16:50',70),
  (1,'Stop loss',               'uitstap','laatprijs optie',      'ask 60,0','groen','simon',     '2026-09-29 11:10',80),
  (1,'Winstanker 70 %',         'uitstap','laatprijs optie',      '30 % van premie','niet gemeten',null,null,90),
  (1,'Break-even',              'uitstap','laatprijs optie',      '= premie','niet gemeten',null,null,100);
