-- 0153 · de leden, wie wat volgt, en wie een bericht kreeg
--
-- Tot nu toe stond er nergens wie de leden zijn. 'Verstuurd naar de leden' was
-- een kolom en een logregel met '412 leden' erin — een getal dat niemand kon
-- navragen. Drie tabellen maken daar iets controleerbaars van.
--
-- 1. lid — wie er meeleest. Niet dezelfde tabel als gebruiker: dat zijn wij,
--    de mensen die in de cockpit werken. Een lid komt nooit in de cockpit.
create table lid (
  id            integer primary key autoincrement,
  naam          text not null,
  email         text not null,
  status        text not null default 'actief',      -- actief | opgezegd
  aangemeld_op  text not null default (date('now')),
  opgezegd_op   text,
  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id)
);

create unique index lid_email on lid (email) where archief = 0;

-- 2. positievolger — een lid dat zegt: deze positie volg ik. Dat zet hij zelf
--    aan in de app. Stoppen wist de rij niet maar zet een datum: dat iemand een
--    positie een week gevolgd heeft en toen afhaakte, is zelf een feit.
create table positievolger (
  id            integer primary key autoincrement,
  positie       integer not null references positie(id),
  lid           integer not null references lid(id),
  gevolgd_op    text not null default (datetime('now')),
  gestopt_op    text,
  bron          text not null default 'app',         -- app | cockpit
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create unique index positievolger_paar on positievolger (positie, lid) where archief = 0;
create index positievolger_lid on positievolger (lid, gestopt_op);

-- 3. publicatie_ontvanger — naar wie dit bericht gaat, en waarom. Bij het
--    opstellen is het een voorbeeld van wie het zou krijgen; bij het versturen
--    wordt het bevroren: wat eruit ging, ging eruit. Daarom staat de reden
--    erbij — 'volgt deze positie' is iets anders dan 'volgt deze cyclus'.
create table publicatie_ontvanger (
  id            integer primary key autoincrement,
  publicatie    integer not null references publicatie(id),
  lid           integer not null references lid(id),
  reden         text,
  bezorgd_op    text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now'))
);

create unique index publicatie_ontvanger_paar on publicatie_ontvanger (publicatie, lid) where archief = 0;

-- 4. En de vastlegging zegt over wélke tranche ze gaat. Een barometerstand komt
--    niet uit de lucht: het is één positie die de stand naar beneden duwt — de
--    zwakste. Zonder die verwijzing weet je bij het bericht niet wie het moet
--    krijgen, want dat zijn de leden die juist díé positie volgen.
alter table barometerstand add column positie integer references positie(id);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst, verwijst_naar, alleen_lezen)
 values ('barometerstand','positie','Welke tranche','verwijzing',55,'herkomst',0,0,'positie',1);

update db_view set kolommen = '["vastgesteld_op","cyclus","stand","venster","positie","reden","vastgesteld_door","gepubliceerd_op"]'
 where tabel = 'barometerstand' and naam = 'standaard';

-- ---------------------------------------------------------- definitielaag
insert into db_table (naam, label, label_mv, titel_veld, volgorde, formulier_kolommen, nieuw_vanuit_lijst) values
  ('lid', 'Lid', 'Leden', 'naam', 44, 2, 1),
  ('positievolger', 'Volger', 'Volgers', 'lid', 45, 2, 1),
  ('publicatie_ontvanger', 'Ontvanger', 'Ontvangers', 'lid', 46, 2, 0);

insert into db_sectie (tabel, naam, label, volgorde) values
  ('lid','lid','Het lid',10),
  ('lid','aanmelding','Aanmelding',20),
  ('positievolger','volgt','Volgt',10),
  ('publicatie_ontvanger','naar','Naar wie',10);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, toon_op_formulier) values
  ('lid','naam','Naam','tekst',10,'lid',1,0,null,1),
  ('lid','email','E-mailadres','tekst',20,'lid',1,0,null,1),
  ('lid','status','Status','keuze',30,'lid',1,0,null,1),
  ('lid','aangemeld_op','Aangemeld op','datum',40,'aanmelding',0,1,null,1),
  ('lid','opgezegd_op','Opgezegd op','datum',50,'aanmelding',0,0,null,1),
  ('lid','toelichting','Toelichting','lang',60,'aanmelding',0,0,null,1),

  -- De positie staat niet op het formulier: je komt hier vanaf de positie, en
  -- dan ligt hij vast. Dat is ook wat er een gerelateerde lijst van maakt.
  ('positievolger','positie','Positie','verwijzing',10,'volgt',1,1,'positie',0),
  ('positievolger','lid','Lid','verwijzing',20,'volgt',1,0,'lid',1),
  ('positievolger','gevolgd_op','Volgt sinds','tijdstip',30,'volgt',0,1,null,1),
  ('positievolger','gestopt_op','Gestopt op','tijdstip',40,'volgt',0,0,null,1),
  ('positievolger','bron','Waar vandaan','keuze',50,'volgt',1,1,null,1),

  ('publicatie_ontvanger','publicatie','Bericht','verwijzing',10,'naar',1,1,'publicatie',0),
  ('publicatie_ontvanger','lid','Lid','verwijzing',20,'naar',1,1,'lid',1),
  ('publicatie_ontvanger','reden','Waarom dit lid','tekst',30,'naar',0,1,null,1),
  ('publicatie_ontvanger','bezorgd_op','Bezorgd op','tijdstip',40,'naar',0,1,null,1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('lid','status','actief','Actief',10,'groen'),
  ('lid','status','opgezegd','Opgezegd',20,'grijs'),
  ('positievolger','bron','app','In de app',10,'blauw'),
  ('positievolger','bron','cockpit','Met de hand',20,'grijs');

insert into db_view (tabel, naam, kolommen, sortering) values
  ('lid','standaard','["naam","email","status","aangemeld_op"]','naam asc'),
  ('positievolger','standaard','["lid","gevolgd_op","gestopt_op","bron"]','gevolgd_op desc'),
  ('publicatie_ontvanger','standaard','["lid","reden","bezorgd_op"]','id asc');

-- Op het bericht hoort te staan waar het over gaat. De positie stond er niet op
-- het formulier: hij was de 'ouder', en een ouder toont de kruimelbalk. Maar een
-- barometerbericht hangt aan een cyclus en draagt sinds vandaag óók een tranche,
-- en dan is 'waar gaat dit over' een vraag die het formulier moet beantwoorden.
--
-- De cyclus wordt de ouder — die heeft elk bericht, ook een bericht zonder
-- positie — en de positie komt als vast veld op het formulier te staan.
update db_field set toon_op_formulier = 1, verplicht = 0
 where tabel = 'publicatie' and kolom = 'positie';
update db_field set geen_lijst = 0
 where tabel = 'publicatie' and kolom = 'cyclus';

insert into db_module (label, groep, doeltabel, route, standaardfilter, volgorde)
 values ('Leden', 'COMMUNICATIE', 'lid', null, null, 6);

insert into schema_versie (versie, omschrijving) values (153, 'de leden, wie wat volgt, en wie een bericht kreeg');
