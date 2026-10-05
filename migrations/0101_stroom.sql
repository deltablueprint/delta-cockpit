-- 0101 · de stroom
--
-- Alles wat er in een cyclus gebeurt staat tot nu toe verspreid: een uitvoering
-- in brokergebeurtenis, een besluit in beoordelingsmoment, een bericht in
-- publicatie, een wijziging in audit. Je kunt zien wát er staat, maar niet
-- wanneer er wat gebeurde en in welke volgorde.
--
-- Deze tabel legt dat op één tijdlijn. Eén rij is één gebeurtenis: IBKR meldde
-- iets, een meting ging over een drempel, de klok tikte een dag verder, of
-- iemand van ons deed iets. Verder niets — deze migratie verandert geen enkel
-- bestaand gedrag, ze schrijft alleen mee.
--
-- Twee velden zijn er voor later en blijven nu leeg:
--   vraagt_antwoord  wordt straks de wachtrij: een gebeurtenis die een antwoord
--                    vraagt en het nog niet heeft, is een kaart.
--   sleutel          houdt die kaarten uniek, zodat dezelfde gebeurtenis niet
--                    twee keer gaat openstaan.
--
-- De stroom begint leeg. Oude cycli krijgen geen geschiedenis: een
-- reconstructie achteraf is duurder dan ze waard is, en ze zou niet kloppen.

create table gebeurtenis (
  id            integer primary key autoincrement,
  cyclus        integer references cyclus(id),
  moment        text not null default (datetime('now')),   -- wanneer het gebeurde
  bron          text not null default 'mens',              -- ibkr | meting | klok | mens
  soort         text not null,                             -- korte sleutel, bv. positie_geopend
  titel         text not null,                             -- wat er gebeurde, in gewone woorden
  detail        text,                                      -- de regel erachter
  feiten        text,                                      -- json, voor de kaart straks

  -- waar het over gaat; hoogstens één hiervan is gevuld
  positie       integer references positie(id),
  publicatie    integer references publicatie(id),
  beoordelingsmoment integer references beoordelingsmoment(id),
  processtap    integer references processtap(id),

  -- voor de wachtrij, nog niet in gebruik
  sleutel         text,
  vraagt_antwoord integer not null default 0,
  antwoord        text,
  beantwoord_op   text,
  beantwoord_door text references gebruiker(id),

  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create index gebeurtenis_cyclus on gebeurtenis (cyclus, moment desc);
create index gebeurtenis_positie on gebeurtenis (positie, moment desc);
create index gebeurtenis_open on gebeurtenis (vraagt_antwoord) where vraagt_antwoord = 1;
create unique index gebeurtenis_sleutel on gebeurtenis (sleutel) where sleutel is not null;

-- ---------------------------------------------------------------- definitie
insert into db_table (naam, label, label_mv, titel_veld, volgorde, formulier_kolommen, nieuw_vanuit_lijst)
 values ('gebeurtenis', 'Gebeurtenis', 'Stroom', 'titel', 75, 1, 0);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('gebeurtenis','wat',     'Wat er gebeurde', 10),
  ('gebeurtenis','waarover','Waar het over gaat', 20),
  ('gebeurtenis','antwoord','Het antwoord', 30);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('gebeurtenis','moment',            'Moment',        'tijdstip',  10,'wat',     1,1,null,                 0,0,1),
  ('gebeurtenis','bron',              'Bron',          'keuze',     20,'wat',     1,1,null,                 0,0,1),
  ('gebeurtenis','titel',             'Wat er gebeurde','tekst',    30,'wat',     1,1,null,                 0,0,1),
  ('gebeurtenis','detail',            'Toelichting',   'tekst',     40,'wat',     0,1,null,                 0,0,1),
  ('gebeurtenis','soort',             'Soort',         'tekst',     50,'wat',     1,1,null,                 0,1,1),
  ('gebeurtenis','cyclus',            'Cyclus',        'verwijzing',60,'waarover',0,1,'cyclus',             0,0,1),
  ('gebeurtenis','positie',           'Positie',       'verwijzing',70,'waarover',0,1,'positie',            0,0,1),
  ('gebeurtenis','publicatie',        'Bericht',       'verwijzing',80,'waarover',0,1,'publicatie',         0,1,1),
  ('gebeurtenis','beoordelingsmoment','Beoordelingsmoment','verwijzing',90,'waarover',0,1,'beoordelingsmoment',0,1,1),
  ('gebeurtenis','processtap',        'Processtap',    'verwijzing',100,'waarover',0,1,'processtap',        0,1,1),
  ('gebeurtenis','feiten',            'Feiten',        'lang',      110,'waarover',0,1,null,                0,1,1),
  ('gebeurtenis','vraagt_antwoord',   'Vraagt antwoord','ja_nee',   120,'antwoord',0,1,null,                0,0,1),
  ('gebeurtenis','antwoord',          'Antwoord',      'tekst',     130,'antwoord',0,1,null,                0,1,1),
  ('gebeurtenis','beantwoord_op',     'Beantwoord op', 'tijdstip',  140,'antwoord',0,1,null,                0,1,1),
  ('gebeurtenis','beantwoord_door',   'Beantwoord door','verwijzing',150,'antwoord',0,1,'gebruiker',        0,1,1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('gebeurtenis','bron','ibkr',  'IBKR',   10,'blauw'),
  ('gebeurtenis','bron','meting','Meting', 20,'grijs'),
  ('gebeurtenis','bron','klok',  'Klok',   30,'grijs'),
  ('gebeurtenis','bron','mens',  'Mens',   40,'groen');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('gebeurtenis','standaard',
   '["titel","vraagt_antwoord","moment","bron","cyclus","detail"]',
   'moment desc');

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Stroom', 'GEGEVENS', 'gebeurtenis', null, null, 55);

insert into schema_versie (versie, omschrijving) values (101, 'de stroom: een tijdlijn per cyclus');
