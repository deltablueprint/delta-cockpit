-- 0109 · de inrichting rechtgezet
--
-- Een audit van de definitielaag (scripts/proef/inrichting.mjs) vond veertig
-- plekken waar de afspraak 'alles staat in beheer' niet meer klopte. Drie
-- soorten, en alle drie waren ze van buiten te zien:
--
--   1. Vier menu-items wezen naar een tabel die niet bestaat. Erop klikken gaf
--      een foutmelding.
--   2. Drie tabellen hadden wel een scherm maar geen enkel veld. De worker
--      antwoordt dan 'heeft nog geen velden' en je kijkt tegen een fout aan.
--   3. Losse kolommen zonder veld, en één veld in een sectie die niet bestaat.
--
-- Er wordt hier niets gewist dat een vastlegging is. Dit is definitielaag: een
-- menu-item dat nergens heen gaat is geen gegeven dat bewaard moet blijven, maar
-- er staat wel een uit-schakelaar op, dus die gebruiken we.

-- ----------------------------------------------- 1. menu-items die nergens heen gaan
-- meting en maandverslag zijn gepland maar nooit gebouwd. standaardvoorwaarde
-- ging op in voorwaarde, en publicatiesjabloon heet sinds 0105 berichtsjabloon
-- en heeft daar zijn eigen item.
update db_module set actief = 0
 where doeltabel in ('meting', 'maandverslag', 'standaardvoorwaarde', 'publicatiesjabloon');

update db_table set actief = 0
 where naam in ('meting', 'maandverslag', 'standaardvoorwaarde', 'publicatiesjabloon', 'chartanalyse');

-- ------------------------------------------- 2. schermen zonder één veld
-- Gebruikers. wachtwoord_hash krijgt met opzet geen veld: wat niet op een
-- formulier staat, kan ook niet per ongeluk op een scherm komen.
insert into db_sectie (tabel, naam, label, volgorde) values
  ('gebruiker','wie','Wie',10),
  ('gebruiker','toegang','Toegang',20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('gebruiker','naam','Naam','tekst',10,'wie',1,0),
  ('gebruiker','korte_naam','Roepnaam','tekst',20,'wie',0,0),
  ('gebruiker','email','E-mailadres','tekst',30,'toegang',1,0),
  ('gebruiker','actief','Mag aanmelden','ja_nee',40,'toegang',1,0),
  ('gebruiker','kleur','Kleur','tekst',50,'wie',0,0),
  ('gebruiker','avatar','Afbeelding','bestand',60,'wie',0,0),
  ('gebruiker','wachtwoord_gezet_op','Wachtwoord gezet op','tijdstip',70,'toegang',0,1),
  ('gebruiker','aangemaakt_op','Aangemaakt op','tijdstip',80,'toegang',0,1);

-- Handelsdagen. Deze tabel wordt gevuld door een import, dus alles staat vast;
-- je komt hier kijken, niet wijzigen.
insert into db_sectie (tabel, naam, label, volgorde) values
  ('handelsdag','dag','De dag',10);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('handelsdag','datum','Datum','datum',10,'dag',1,1),
  ('handelsdag','beurs','Beurs','tekst',20,'dag',1,1),
  ('handelsdag','status','Status','tekst',30,'dag',1,1),
  ('handelsdag','opening','Opening','tijd',40,'dag',0,1),
  ('handelsdag','sluiting','Sluiting','tijd',50,'dag',0,1),
  ('handelsdag','bron','Bron','tekst',60,'dag',0,1),
  ('handelsdag','toelichting','Toelichting','lang',70,'dag',0,1);

-- Het auditlog. Alles vast: dit is een verslag, geen formulier.
insert into db_sectie (tabel, naam, label, volgorde) values
  ('audit','wat','Wat er veranderde',10);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen) values
  ('audit','wanneer','Wanneer','tijdstip',10,'wat',0,1),
  ('audit','wie','Wie','tekst',20,'wat',0,1),
  ('audit','tabel','Tabel','tekst',30,'wat',0,1),
  ('audit','record','Record','getal',40,'wat',0,1),
  ('audit','soort','Soort','tekst',50,'wat',0,1),
  ('audit','veld','Veld','tekst',60,'wat',0,1),
  ('audit','oude_waarde','Was','lang',70,'wat',0,1),
  ('audit','nieuwe_waarde','Werd','lang',80,'wat',0,1),
  ('audit','reden','Reden','lang',90,'wat',0,1),
  ('audit','gebeurtenis','Gebeurtenis','tekst',100,'wat',0,1);

update db_table set titel_veld = 'naam' where naam = 'gebruiker';
update db_table set titel_veld = 'datum' where naam = 'handelsdag';
update db_table set titel_veld = 'soort'  where naam = 'audit';

insert into schema_versie (versie, omschrijving) values (109, 'de inrichting rechtgezet: dode menu-items en schermen zonder velden');
