-- 0090 · de vlag: er is iets gebeurd dat om duiding vraagt
--
-- Soms gaat het te snel voor een aankondiging: je handelt eerst bij Lynx en de
-- applicatie moet volgen. Dan kan het systeem niet vergelijken met wat je zei,
-- en moet het zelf kijken wat er veranderde. Wat het ziet, bewaart het hier —
-- anders zou elke lijst die je opent het hele rapport moeten herlezen.
--
-- De vlag wordt gezet op het moment dat de stand binnenkomt: bij elke push van
-- de brug en bij het nachtelijke rapport. Zo is hij zo vers als de koppeling,
-- en niet zo vers als het laatste scherm dat iemand toevallig opende.

alter table positie add column duiding_voorstel text;   -- wat het systeem denkt
alter table positie add column duiding_waarom text;     -- waarop het dat baseert
alter table positie add column duiding_op text;         -- wanneer het dat zag

alter table cyclus add column duiding_open integer not null default 0;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('cyclus','duiding_open','Vraagt om duiding','vlag',25,'cyclus',0,1,null,0,0,0),
  ('positie','duiding_voorstel','Waargenomen','tekst',   205,'uitkomst',0,1,null,0,0,1),
  ('positie','duiding_waarom',  'Waarop',     'lang',    206,'uitkomst',0,1,null,0,0,1),
  ('positie','duiding_op',      'Gezien op',  'tijdstip',207,'uitkomst',0,1,null,0,0,1);

-- In de cyclilijst staat de vlag vooraan na de status: daar kijk je als je wilt
-- weten of er iets op je ligt te wachten.
update db_view set kolommen = '["label","status","duiding_open","geopend_op","doelexpiratie","volgend_analysemoment","resultaat_pt","aangemaakt_door"]'
 where tabel = 'cyclus' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (90, 'vlag voor wat om duiding vraagt');
