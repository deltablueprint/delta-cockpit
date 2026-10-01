-- 0038 — De portefeuille-instelling: kapitaal, multiplier en tolerantie
--
-- Zonder noemer is "12 %" een getal zonder betekenis, en zonder tolerantie is
-- "wijkt de uitvoering af van het besluit?" een vraag die de code zelf zou
-- moeten beantwoorden. Allebei horen het instellingen te zijn (6).
--
-- Dit is het begin van wat in etappe 11b uitgroeit tot blootstelling en
-- reserve over alle open tranches heen; hier staat alleen wat etappe 11 nodig
-- heeft. De instelling heeft *geldig vanaf*: een verhoging van het kapitaal
-- maakt oude toetsingen niet met terugwerkende kracht anders.

create table portefeuille_instelling (
  id                integer primary key autoincrement,
  geldig_vanaf      text not null default (date('now')),
  kapitaal          real not null,
  multiplier        real not null default 10.0,
  max_inzet_pct     real,
  min_reserve_pct   real,
  max_inzet_cyclus_pct real,
  overschrijding    text not null default 'waarschuwt',
  tolerantie_premie_pct real not null default 10.0,
  toelichting       text,
  archief           integer not null default 0,
  revisie           integer not null default 1,
  aangemaakt_op     text not null default (datetime('now')),
  aangemaakt_door   text references gebruiker(id)
);

update db_table set titel_veld = 'geldig_vanaf', nieuw_vanuit_lijst = 1
 where naam = 'portefeuille_instelling';

insert into db_sectie (tabel, naam, label, volgorde) values
  ('portefeuille_instelling','geld','Kapitaal',10),
  ('portefeuille_instelling','grenzen','Grenzen',20),
  ('portefeuille_instelling','systeem','Systeem',90);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('portefeuille_instelling','geldig_vanaf','Geldig vanaf','datum',10,'geld',1,0,null,1,'130px',1),
  ('portefeuille_instelling','kapitaal','Kapitaal (€)','getal',20,'geld',1,0,null,1,'140px',1),
  ('portefeuille_instelling','multiplier','Multiplier (€ per punt)','getal',30,'geld',1,0,null,1,'160px',1),
  ('portefeuille_instelling','max_inzet_pct','Maximale inzet (%)','getal',40,'grenzen',0,0,null,1,'140px',1),
  ('portefeuille_instelling','min_reserve_pct','Minimale reserve (%)','getal',50,'grenzen',0,0,null,1,'150px',1),
  ('portefeuille_instelling','max_inzet_cyclus_pct','Maximale inzet per cyclus (%)','getal',60,'grenzen',0,0,null,1,'180px',1),
  ('portefeuille_instelling','overschrijding','Bij overschrijding','keuze',70,'grenzen',1,0,null,1,'150px',1),
  ('portefeuille_instelling','tolerantie_premie_pct','Tolerantie op de premie (%)','getal',80,'grenzen',1,0,null,1,'170px',1),
  ('portefeuille_instelling','toelichting','Toelichting','lang',90,'grenzen',0,0,null,1,'280px',1),
  ('portefeuille_instelling','aangemaakt_op','Aangemaakt op','tijdstip',810,'systeem',0,1,null,0,'150px',1),
  ('portefeuille_instelling','aangemaakt_door','Aangemaakt door','verwijzing',820,'systeem',0,1,'gebruiker',0,'160px',1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('portefeuille_instelling','overschrijding','waarschuwt','Waarschuwt',10,'oranje'),
  ('portefeuille_instelling','overschrijding','blokkeert','Blokkeert',20,'rood');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('portefeuille_instelling','standaard','["geldig_vanaf","kapitaal","max_inzet_pct","min_reserve_pct","tolerantie_premie_pct","overschrijding"]','geldig_vanaf desc');

insert into db_rule (tabel, kolom, voorwaarde, melding, blokkeert, versie_vanaf) values
  ('portefeuille_instelling','kapitaal','kapitaal > 0','Het kapitaal moet groter zijn dan nul.',1,1);

-- De waarden uit de septemberanalyse als startpunt; aanpassen is een nieuwe
-- regel met een eigen 'geldig vanaf', geen wijziging van deze.
insert into portefeuille_instelling (geldig_vanaf, kapitaal, multiplier, max_inzet_pct, min_reserve_pct, max_inzet_cyclus_pct, overschrijding, tolerantie_premie_pct, toelichting)
 values ('2026-09-01', 250000, 10.0, 60.0, 40.0, 24.0, 'waarschuwt', 10.0,
         'Startwaarden uit de septemberanalyse: eerste tranche ten hoogste 24 %, minimaal 40 % reserve. Kapitaal is een aanname — pas hem aan met een nieuwe regel.');

insert into schema_versie (versie, omschrijving) values (38, 'portefeuille-instelling');
