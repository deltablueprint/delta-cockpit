-- 0082 · de chartlezing hoort bij de cyclus, niet bij het gesprek
--
-- De technische analyse is geen verslag van het overleg maar materiaal dat
-- erbij ligt: je leest de charts in de pre-analyse, en pas als dat gebeurd is
-- kan iedereen blind zijn positie insturen. Daarom hangt de chartlezing aan de
-- cyclus, verschijnt hij als gerelateerde lijst op het cyclusrecord, en staat
-- de vaste regel er vanaf het aanmaken van de cyclus.
--
-- De tabel wordt herbouwd in plaats van uitgebreid: 'beoordelingsmoment' stond
-- op NOT NULL, en een chartlezing die bij een cyclus hoort heeft geen gesprek.
-- De kolom blijft bestaan voor wat er al is vastgelegd — wissen doen we niet —
-- maar is niet langer verplicht.

create table chartlezing_nieuw (
  id            integer primary key autoincrement,
  cyclus        integer references cyclus(id),
  beoordelingsmoment integer references beoordelingsmoment(id),
  onderwerp     text not null,
  vast          integer not null default 0,
  afbeelding    text,
  commentaar    text,
  volgorde      integer not null default 100,
  archief       integer not null default 0,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

insert into chartlezing_nieuw
  (id, cyclus, beoordelingsmoment, onderwerp, vast, afbeelding, commentaar,
   volgorde, archief, aangemaakt_op, aangemaakt_door)
select cl.id,
       (select b.cyclus from beoordelingsmoment b where b.id = cl.beoordelingsmoment),
       cl.beoordelingsmoment, cl.onderwerp, cl.vast, cl.afbeelding, cl.commentaar,
       cl.volgorde, cl.archief, cl.aangemaakt_op, cl.aangemaakt_door
  from chartlezing cl;

drop table chartlezing;
alter table chartlezing_nieuw rename to chartlezing;

create index idx_chartlezing_cyclus on chartlezing (cyclus, volgorde, id);
create index idx_chartlezing_moment on chartlezing (beoordelingsmoment, volgorde, id);

-- ---------- de definitielaag ----------
-- toon_op_formulier = 0: een ouder kies je niet, die ligt vast zodra het
-- record bestaat — en juist dát maakt er een gerelateerde lijst van.
insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('chartlezing','cyclus','Cyclus','verwijzing',5,'algemeen',1,1,'cyclus',1,0,0);

-- Het gesprek is niet langer de ouder van een chartlezing.
update db_field set actief = 0, geen_lijst = 1, verplicht = 0
 where tabel = 'chartlezing' and kolom = 'beoordelingsmoment';

-- In de lijst hoort de schermafdruk zelf te staan, als duimnagel: zo zie je
-- in één oogopslag welke chart af is en welke nog leeg.
update db_view set kolommen = '["onderwerp","afbeelding","commentaar","aangemaakt_op"]'
 where tabel = 'chartlezing' and naam = 'standaard';

-- De tabel heet in de app wat hij is: de technische analyse. 'Chartlezing' was
-- de werknaam.
update db_table set label = 'Technische analyse', label_mv = 'Technische analyse'
 where naam = 'chartlezing';

-- ---------- de vaste regel staat er vanaf het begin ----------
insert into chartlezing (cyclus, onderwerp, vast, volgorde)
select c.id, 'Moving Average 8, 20, 50', 1, 10
  from cyclus c
 where c.archief = 0
   and not exists (select 1 from chartlezing cl where cl.cyclus = c.id and cl.vast = 1);

-- ---------- de processtap ----------
-- De chartlezing hoort bij de pre-analyse en gaat vooraf aan het insturen:
-- iedereen schrijft blind, maar wel op hetzelfde beeld.
update processtap set volgorde = volgorde + 10
 where proces = 1 and volgorde >= 20 and archief = 0;

insert into processtap (proces, volgorde, naam, stand, fase, eigenaar, verplicht, afvinkregel, uitleg) values
  (1, 20, 'Technische analyse gelezen', 'pre-analyse', 'pre-analyse', 'elke deelnemer', 1, 'chartlezing_gedaan',
      'Elke chart draagt een schermafdruk en wat je erin leest. Zolang dat niet rond is, kan niemand blind insturen.');

insert into schema_versie (versie, omschrijving) values (82, 'chartlezing op de cyclus, stap in de pre-analyse');
