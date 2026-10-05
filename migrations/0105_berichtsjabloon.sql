-- 0105 · de berichtsjablonen
--
-- Een kaartdefinitie zegt met knop1_sjabloon welk bericht er klaargezet wordt.
-- Die naam moet ergens op uitkomen, en dat mag geen tekst in de code zijn: de
-- woorden waarmee wij onze leden aanspreken horen in beheer te staan, waar ze
-- te lezen en te wijzigen zijn zonder dat er iemand hoeft te deployen.
--
-- De plaatshouders zijn dezelfde als op de kaart: {{positie.naam}},
-- {{feiten.van}}, {{cyclus.naam}}. Wat niet ingevuld kan worden valt weg — een
-- bericht met een gat erin kun je nalezen, een bericht met accolades erin gaat
-- per ongeluk zo de deur uit.
create table berichtsjabloon (
  id            integer primary key autoincrement,
  naam          text not null,                        -- waar knop1_sjabloon naar wijst
  label         text not null,
  soort         text not null default 'vrij',         -- wordt publicatie.soort
  kanaal        text not null default 'leden',
  titel         text,
  tekst         text not null,
  -- Een bericht dat altijd eerst langs iemand anders moet. Leeg = direct klaar.
  vaste_nalezer text references gebruiker(id),
  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create unique index berichtsjabloon_naam on berichtsjabloon (naam) where archief = 0;

insert into berichtsjabloon (naam, label, soort, titel, tekst, toelichting) values
  ('nieuwe_positie', 'Nieuwe positie', 'opening',
   'Nieuwe positie: {{positie.naam}}',
   'We zijn een nieuwe positie ingegaan: {{positie.naam}}.

Premie: {{positie.premie}} punten. Looptijd tot {{positie.expiratiedatum}}.

Wat dit betekent: [waarom nu, in één alinea].',
   'Het waarom blijft mensenwerk. Het sjabloon zet de feiten klaar, niet het oordeel.'),

  ('sluiting', 'Positie gesloten', 'sluiting',
   'Positie gesloten: {{positie.naam}}',
   'De positie {{positie.naam}} is gesloten.

Resultaat: {{positie.resultaat_pt}} punten.

Wat dit betekent: [de uitkomst in één alinea].',
   null),

  ('doorrol', 'Doorrol', 'doorrol',
   'Doorrol op {{positie.onderliggend}}',
   'We hebben de positie op {{positie.onderliggend}} doorgerold.

Van: {{positie.naam}}
Naar: {{volgende.naam}}

Waarom: [in één alinea].',
   'Eén verhaal, geen twee berichten. De sluiting en de opening horen hier bij elkaar.'),

  ('barometer', 'Barometerstand', 'barometer',
   'De barometer gaat naar {{feiten.naar}}',
   'De barometer staat vanaf vandaag op {{feiten.naar}} (was {{feiten.van}}).

Waarom: {{feiten.reden}}

Wat dit voor u betekent: [in één alinea].',
   null),

  ('week_update', 'Week-update', 'week_update',
   'Week-update',
   'De stand van zaken deze week.

[Wat er gebeurde, of juist niet.]

De barometer staat op [stand].',
   'Ook een week waarin niets gebeurde is een bericht waard: stilte leest als vergeten.'),

  ('maandbericht', 'Maandbericht', 'maandbericht',
   'Maandbericht {{feiten.maand}}',
   'Het maandoverzicht van {{feiten.maand}}.

Resultaat over de maand: {{feiten.resultaat_pt}} punten.

[De maand in een paar alinea''s.]',
   null);

-- ---------------------------------------------------------- definitielaag
insert into db_table (naam, label, label_mv, titel_veld, volgorde, formulier_kolommen, nieuw_vanuit_lijst)
 values ('berichtsjabloon', 'Berichtsjabloon', 'Berichtsjablonen', 'label', 78, 1, 1);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('berichtsjabloon','sjabloon','Het sjabloon',10),
  ('berichtsjabloon','gebruik','Hoe het gebruikt wordt',20);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst, verwijst_naar) values
  ('berichtsjabloon','naam','Verwijsnaam','tekst',10,'gebruik',1,0,null),
  ('berichtsjabloon','label','Naam','tekst',20,'sjabloon',1,0,null),
  ('berichtsjabloon','soort','Soort bericht','keuze',30,'gebruik',1,1,null),
  ('berichtsjabloon','kanaal','Kanaal','keuze',40,'gebruik',1,1,null),
  ('berichtsjabloon','titel','Titel','tekst',50,'sjabloon',0,0,null),
  ('berichtsjabloon','tekst','Tekst','lang',60,'sjabloon',1,0,null),
  ('berichtsjabloon','vaste_nalezer','Altijd laten nalezen door','verwijzing',70,'gebruik',0,0,'gebruiker'),
  ('berichtsjabloon','toelichting','Toelichting','lang',80,'gebruik',0,0,null);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur)
  select 'berichtsjabloon', 'soort', waarde, label, volgorde, kleur
    from db_choice where tabel = 'publicatie' and kolom = 'soort';
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur)
  select 'berichtsjabloon', 'kanaal', waarde, label, volgorde, kleur
    from db_choice where tabel = 'publicatie' and kolom = 'kanaal';

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde) values
  ('Berichtsjablonen', 'INRICHTING', 'berichtsjabloon', null, null, 85);

insert into schema_versie (versie, omschrijving) values (105, 'de berichtsjablonen staan in beheer, niet in de code');
