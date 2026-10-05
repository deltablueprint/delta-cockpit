-- 0099 · het bericht aan de leden
--
-- Een positie die bij Lynx opent, staat binnen een seconde in de cockpit met de
-- echte prijzen. Maar daarmee is ze nog niet klaar om naar de leden te gaan: de
-- cijfers vertellen wát er gebeurd is, niet waaróm. Dat laatste is het enige
-- deel van deze hele keten dat een mens moet schrijven, en het is ook het enige
-- deel dat de leden echt lezen.
--
-- Dus: zodra er een positie opent of sluit, ontstaat hier een concept met de
-- feiten er al in. De begeleidende tekst is leeg en verplicht. Pas als jij hem
-- schrijft en verstuurt, gaat de positie door naar 'bewaken'. Tot dan blijft ze
-- op 'publiceren naar leden' staan — zichtbaar wachtend.
--
-- Versturen is onomkeerbaar. Daarom is het een aparte handeling met een eigen
-- knop, en niet iets wat gebeurt omdat een veld gevuld raakt.

create table publicatie (
  id            integer primary key autoincrement,
  positie       integer not null references positie(id),
  cyclus        integer references cyclus(id),
  soort         text not null default 'opening',     -- opening | sluiting
  status        text not null default 'concept',     -- concept | verstuurd
  -- De feiten staan erin zoals ze op dat moment waren. Verandert de positie
  -- later, dan verandert een verstuurd bericht niet mee: wat eruit ging, ging
  -- eruit.
  contract      text,
  strike        real,
  expiratiedatum text,
  aantal        integer,
  premie_pt     real,
  resultaat_pt  real,
  tekst         text,
  verstuurd_op  text,
  verstuurd_door text references gebruiker(id),
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create index publicatie_positie on publicatie (positie, soort);
create index publicatie_open on publicatie (status) where status = 'concept';

update db_table set label = 'Publicatie', label_mv = 'Publicaties', titel_veld = 'contract',
                    volgorde = 70, formulier_kolommen = 1, na_aanmaken = 'ouder'
 where naam = 'publicatie';

insert into db_sectie (tabel, naam, label, volgorde) values
  ('publicatie','bericht','Het bericht', 10),
  ('publicatie','feiten', 'De feiten',    20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('publicatie','positie',       'Positie',       'verwijzing', 5,'bericht',1,1,'positie', 1,0,0),
  ('publicatie','cyclus',        'Cyclus',        'verwijzing', 6,'bericht',0,1,'cyclus',  1,1,0),
  ('publicatie','soort',         'Waarover',      'keuze',     10,'bericht',1,1,null,      1,0,1),
  ('publicatie','status',        'Stand',         'keuze',     20,'bericht',1,1,null,      1,0,1),
  ('publicatie','tekst',         'Wat we deden en waarom','lang',30,'bericht',1,0,null,    1,0,1),
  ('publicatie','contract',      'Contract',      'tekst',     40,'feiten', 0,1,null,      0,0,1),
  ('publicatie','strike',        'Strike',        'getal',     50,'feiten', 0,1,null,      0,0,1),
  ('publicatie','expiratiedatum','Expiratie',     'datum',     60,'feiten', 0,1,null,      0,0,1),
  ('publicatie','aantal',        'Aantal',        'getal',     70,'feiten', 0,1,null,      0,0,1),
  ('publicatie','premie_pt',     'Geschreven op (punten)','getal',80,'feiten',0,1,null,    0,0,1),
  ('publicatie','resultaat_pt',  'Resultaat (punten)','getal', 90,'feiten', 0,1,null,      0,0,1),
  ('publicatie','verstuurd_op',  'Verstuurd op',  'tijdstip', 100,'feiten', 0,1,null,      1,0,1),
  ('publicatie','verstuurd_door','Verstuurd door','verwijzing',110,'feiten',0,1,'gebruiker',1,1,1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('publicatie','soort','opening',  'Nieuwe positie',   10,'blauw'),
  ('publicatie','soort','sluiting', 'Positie gesloten', 20,'grijs'),
  ('publicatie','status','concept',  'Concept',   10,'oranje'),
  ('publicatie','status','verstuurd','Verstuurd', 20,'groen');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('publicatie','standaard',
   '["contract","status","soort","cyclus","premie_pt","resultaat_pt","verstuurd_op"]',
   'aangemaakt_op desc');

insert into schema_versie (versie, omschrijving) values (99, 'het bericht aan de leden');
