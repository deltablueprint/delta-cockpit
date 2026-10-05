-- 0102 · de kaartdefinitie
--
-- De wachtrij toont kaarten: "deze positie is gesloten, zeg het de leden",
-- "de barometer staat op 3, publiceer dat". Welke kaarten bestaan en wanneer
-- ze verschijnen hoort niet in de code thuis. Dat is procesinrichting, en die
-- staat in dit systeem al ergens: op processtap.
--
-- Een kaart ís een processtap. Dezelfde rij die zegt "deze stap hoort bij deze
-- stand van dit record" zegt met deze kolommen er ook bij: hoe de kaart heet,
-- waar de aanleiding vandaan komt, wanneer hij opent, hoe hij heet in de rij,
-- welke twee knoppen eronder staan en wat er gebeurt als je ze indrukt.
--
-- Een processtap zonder kaartsoort is een gewone stap en verandert niet. Een
-- processtap met kaartsoort is een kaartdefinitie.
--
-- De kaarten zelf hangen onder een eigen proces 'Wachtrij'. Dat proces heeft
-- met opzet toepassing = 'wachtrij' en niet de naam van een tabel: stappenVoor()
-- zoekt op toepassing = <tabelnaam>, dus geen enkel recordscherm pikt deze
-- stappen per ongeluk op als zijn eigen stappenlijst.
--
-- Deze migratie zet alleen de definitie neer. Er draait nog niets op: de motor
-- die hiernaar kijkt en gebeurtenissen omzet in kaarten komt in etappe C.

-- ------------------------------------------------------------ de kolommen
alter table processtap add column kaartsoort text;
alter table processtap add column bron text;
alter table processtap add column voorwaarde text;
alter table processtap add column sleutel_bron text;
alter table processtap add column prioriteit text;
alter table processtap add column opschalen_na_uur integer;
alter table processtap add column opschalen_naar text;
alter table processtap add column reden text;
alter table processtap add column kaarttitel text;
alter table processtap add column feiten text;
alter table processtap add column knop1_label text;
alter table processtap add column knop1_doel text;
alter table processtap add column knop1_sjabloon text;
alter table processtap add column knop2_label text;
alter table processtap add column knop2_doel text;
alter table processtap add column knop2_reden_verplicht integer not null default 0;
alter table processtap add column prullenbak integer not null default 1;
alter table processtap add column prullenbak_doel text;
alter table processtap add column tweede_lezer text;

-- ------------------------------------------------------------- het proces
-- toepassing = 'wachtrij': met opzet geen tabelnaam. Zie de kop.
insert into proces (id, naam, omschrijving, toepassing) values
  (4, 'Wachtrij', 'Welke kaarten de wachtrij maakt, waarvan ze komen en wat de knoppen eronder doen.', 'wachtrij');

-- ------------------------------------------------------ de kaartdefinities
-- volgorde = de volgorde in beheer, niet de volgorde in de rij. Wat bovenaan
-- in de wachtrij staat bepaalt de prioriteit en de leeftijd, niet dit getal.
insert into processtap
  (proces, volgorde, naam, eigenaar, verplicht,
   kaartsoort, bron, voorwaarde, sleutel_bron, prioriteit, opschalen_na_uur, opschalen_naar,
   reden, kaarttitel, feiten,
   knop1_label, knop1_doel, knop1_sjabloon,
   knop2_label, knop2_doel, knop2_reden_verplicht,
   prullenbak, prullenbak_doel, tweede_lezer)
values
  (4, 10, 'Bericht bij een nieuwe positie', 'elke deelnemer', 1,
   'positie_geopend', 'ibkr', 'soort = ''positie_geopend''', 'positie', 'hoog', 24, 'hoog',
   'De leden weten nog niet dat deze positie loopt.',
   'Nieuwe positie: {{positie.naam}}',
   '["positie.naam","positie.strike","positie.premie","positie.looptijd"]',
   'Bericht opstellen', 'publicatie', 'nieuwe_positie',
   'Niet melden', 'afsluiten', 1,
   1, 'afsluiten', null),

  (4, 20, 'Bericht bij een sluiting', 'elke deelnemer', 1,
   'positie_gesloten', 'ibkr', 'soort = ''positie_gesloten''', 'positie', 'hoog', 24, 'hoog',
   'De positie is weg bij de broker, de leden zien hem nog openstaan.',
   'Positie gesloten: {{positie.naam}}',
   '["positie.naam","positie.resultaat","positie.resultaat_pt","positie.gesloten_op"]',
   'Bericht opstellen', 'publicatie', 'sluiting',
   'Niet melden', 'afsluiten', 1,
   1, 'afsluiten', null),

  (4, 30, 'Doorrol herkennen', 'elke deelnemer', 1,
   'doorrol', 'ibkr', 'soort = ''positie_gesloten'' and feiten->>''$.zelfde_dag_geopend'' = 1', 'positie', 'hoog', 24, 'hoog',
   'Een sluiting en een opening op dezelfde onderliggende waarde: dit is één verhaal, geen twee berichten.',
   'Doorrol op {{positie.onderliggend}}?',
   '["positie.naam","positie.strike","volgende.strike","volgende.looptijd"]',
   'Als doorrol melden', 'publicatie', 'doorrol',
   'Twee losse berichten', 'splitsen', 0,
   1, 'afsluiten', null),

  (4, 40, 'Barometerstand publiceren', 'elke deelnemer', 1,
   'barometer', 'meting', 'soort = ''barometer_voorstel''', 'cyclus_stand', 'hoog', 12, 'hoog',
   'Het systeem stelt een andere stand voor dan wat de leden zien.',
   'Barometer {{feiten.van}} → {{feiten.naar}}',
   '["feiten.van","feiten.naar","feiten.reden","cyclus.naam"]',
   'Stand overnemen en melden', 'publicatie', 'barometer',
   'Stand houden', 'afsluiten', 1,
   1, 'afsluiten', null);

insert into processtap
  (proces, volgorde, naam, eigenaar, verplicht,
   kaartsoort, bron, voorwaarde, sleutel_bron, prioriteit, opschalen_na_uur, opschalen_naar,
   reden, kaarttitel, feiten,
   knop1_label, knop1_doel, knop1_sjabloon,
   knop2_label, knop2_doel, knop2_reden_verplicht,
   prullenbak, prullenbak_doel, tweede_lezer)
values
  (4, 50, 'Week-update', 'elke deelnemer', 1,
   'week_update', 'klok', 'soort = ''week_verstreken''', 'cyclus_week', 'medium', 48, 'hoog',
   'Zeven dagen zonder bericht aan de leden.',
   'Week-update week {{feiten.week}}',
   '["cyclus.naam","feiten.week","feiten.laatste_bericht_op"]',
   'Update opstellen', 'publicatie', 'week_update',
   'Deze week overslaan', 'afsluiten', 1,
   1, 'afsluiten', null),

  (4, 60, 'Technische analyse', 'elke deelnemer', 1,
   'chartlezing', 'klok', 'soort = ''chartlezing_gevraagd''', 'cyclus_moment', 'medium', 72, 'hoog',
   'De charts zijn nog niet gelezen voor dit moment.',
   'Technische analyse {{cyclus.naam}}',
   '["cyclus.naam","beoordelingsmoment.datum","feiten.openstaand"]',
   'Analyse invullen', 'scherm', null,
   'Overslaan', 'afsluiten', 1,
   1, 'afsluiten', null),

  (4, 70, 'Go/no-go', 'elke deelnemer', 1,
   'gonogo', 'klok', 'soort = ''gonogo_open''', 'moment_deelnemer', 'hoog', 12, 'hoog',
   'Jouw stem ontbreekt nog in dit gesprek.',
   'Go/no-go {{cyclus.naam}}',
   '["cyclus.naam","beoordelingsmoment.datum","feiten.ingediend","feiten.van"]',
   'Blind indienen', 'scherm', null,
   null, null, 0,
   0, null, null),

  (4, 80, 'Reviewbesluit', 'elke deelnemer', 1,
   'reviewbesluit', 'klok', 'soort = ''reviewbesluit_open''', 'moment_deelnemer', 'hoog', 12, 'hoog',
   'Het besluit van dit moment is nog niet vastgelegd.',
   'Besluit vastleggen {{cyclus.naam}}',
   '["cyclus.naam","beoordelingsmoment.datum","feiten.uitkomst"]',
   'Besluit vastleggen', 'scherm', null,
   null, null, 0,
   0, null, null);

insert into processtap
  (proces, volgorde, naam, eigenaar, verplicht,
   kaartsoort, bron, voorwaarde, sleutel_bron, prioriteit, opschalen_na_uur, opschalen_naar,
   reden, kaarttitel, feiten,
   knop1_label, knop1_doel, knop1_sjabloon,
   knop2_label, knop2_doel, knop2_reden_verplicht,
   prullenbak, prullenbak_doel, tweede_lezer)
values
  (4, 90, 'Herbeoordeling', 'elke deelnemer', 1,
   'herbeoordeling', 'meting', 'soort = ''drempel_overschreden''', 'cyclus_voorwaarde', 'medium', 48, 'hoog',
   'Een voorwaarde staat anders dan bij het besluit.',
   'Herbeoordelen: {{feiten.voorwaarde}}',
   '["feiten.voorwaarde","feiten.was","feiten.is","cyclus.naam"]',
   'Opnieuw beoordelen', 'scherm', null,
   'Geen gevolg', 'afsluiten', 1,
   1, 'afsluiten', null),

  (4, 100, 'Bericht nalezen', 'elke deelnemer', 1,
   'nalezen', 'mens', 'soort = ''nalezen_gevraagd''', 'publicatie_lezer', 'hoog', 8, 'hoog',
   'Een collega vraagt of jij dit bericht nog naleest voor het weggaat.',
   'Nalezen: {{publicatie.titel}}',
   '["publicatie.titel","publicatie.opgesteld_door","publicatie.kanaal"]',
   'Nalezen en vrijgeven', 'publicatie', null,
   'Terug naar de opsteller', 'terug', 1,
   0, null, null),

  (4, 110, 'Maandverslag', 'elke deelnemer', 1,
   'maandverslag', 'klok', 'soort = ''maand_verstreken''', 'maand', 'laag', 168, 'medium',
   'De maand is om en het verslag staat nog niet klaar.',
   'Maandverslag {{feiten.maand}}',
   '["feiten.maand","feiten.posities","feiten.resultaat_pt"]',
   'Verslag opstellen', 'scherm', null,
   'Deze maand overslaan', 'afsluiten', 1,
   1, 'afsluiten', null),

  (4, 120, 'Maandbericht', 'elke deelnemer', 1,
   'maandbericht', 'klok', 'soort = ''maandverslag_klaar''', 'maand', 'laag', 168, 'medium',
   'Het verslag is klaar maar de leden hebben het niet.',
   'Maandbericht {{feiten.maand}}',
   '["feiten.maand","publicatie.titel","feiten.resultaat_pt"]',
   'Bericht opstellen', 'publicatie', 'maandbericht',
   'Niet versturen', 'afsluiten', 1,
   1, 'afsluiten', 'jacqueline');

-- ---------------------------------------------------------- definitielaag
-- Twee secties erbij. Ze staan achteraan, want een gewone processtap gebruikt
-- ze niet en moet er niet eerst doorheen scrollen.
insert into db_sectie (tabel, naam, label, volgorde) values
  ('processtap','kaart','De kaart in de wachtrij',30),
  ('processtap','knoppen','De knoppen onder de kaart',40);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst) values
  ('processtap','kaartsoort','Kaartsoort','keuze',200,'kaart',0,1),
  ('processtap','bron','Bron','keuze',210,'kaart',0,1),
  ('processtap','voorwaarde','Voorwaarde','lang',220,'kaart',0,0),
  ('processtap','sleutel_bron','Sleutel','keuze',230,'kaart',0,1),
  ('processtap','prioriteit','Prioriteit','keuze',240,'kaart',0,1),
  ('processtap','opschalen_na_uur','Opschalen na (uur)','getal',250,'kaart',0,0),
  ('processtap','opschalen_naar','Opschalen naar','keuze',260,'kaart',0,1),
  ('processtap','reden','Reden op de kaart','tekst',270,'kaart',0,0),
  ('processtap','kaarttitel','Titel van de kaart','tekst',280,'kaart',0,0),
  ('processtap','feiten','Feiten','lang',290,'kaart',0,0),
  ('processtap','tweede_lezer','Vaste tweede lezer','verwijzing',300,'kaart',0,0),
  ('processtap','knop1_label','Knop 1 — label','tekst',310,'knoppen',0,0),
  ('processtap','knop1_doel','Knop 1 — doel','tekst',320,'knoppen',0,0),
  ('processtap','knop1_sjabloon','Knop 1 — sjabloon','tekst',330,'knoppen',0,0),
  ('processtap','knop2_label','Knop 2 — label','tekst',340,'knoppen',0,0),
  ('processtap','knop2_doel','Knop 2 — doel','tekst',350,'knoppen',0,0),
  ('processtap','knop2_reden_verplicht','Knop 2 vraagt een reden','ja_nee',360,'knoppen',0,0),
  ('processtap','prullenbak','Prullenbak tonen','ja_nee',370,'knoppen',0,0),
  ('processtap','prullenbak_doel','Prullenbak — doel','keuze',380,'knoppen',0,1);

-- Een vaste tweede lezer is een mens, geen keuzelijstje dat naast de
-- gebruikerstabel gaat leven en er na de eerste personeelswissel naast ligt.
update db_field set verwijst_naar = 'gebruiker' where tabel = 'processtap' and kolom = 'tweede_lezer';

-- De keuzelijsten. Rood/amber/grijs voor de prioriteit: groen betekent in dit
-- systeem overal 'in orde', en een kaart die openstaat is dat juist niet.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','prioriteit','hoog','Hoog',10,'rood'),
  ('processtap','prioriteit','medium','Medium',20,'oranje'),
  ('processtap','prioriteit','laag','Laag',30,'grijs'),
  ('processtap','opschalen_naar','hoog','Hoog',10,'rood'),
  ('processtap','opschalen_naar','medium','Medium',20,'oranje'),
  ('processtap','bron','ibkr','IBKR',10,'blauw'),
  ('processtap','bron','meting','Meting',20,'blauw'),
  ('processtap','bron','klok','Klok',30,'grijs'),
  ('processtap','bron','mens','Mens',40,'grijs');

-- De sleutel bepaalt wanneer twee aanleidingen dezelfde kaart zijn. Zonder dit
-- staat na drie keer draaien dezelfde vraag drie keer in de rij.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','sleutel_bron','positie','Per positie',10,'grijs'),
  ('processtap','sleutel_bron','cyclus_stand','Per cyclus en stand',20,'grijs'),
  ('processtap','sleutel_bron','cyclus_week','Per cyclus en week',30,'grijs'),
  ('processtap','sleutel_bron','cyclus_moment','Per cyclus en moment',40,'grijs'),
  ('processtap','sleutel_bron','cyclus_voorwaarde','Per cyclus en voorwaarde',50,'grijs'),
  ('processtap','sleutel_bron','moment_deelnemer','Per moment en deelnemer',60,'grijs'),
  ('processtap','sleutel_bron','publicatie_lezer','Per publicatie en lezer',70,'grijs'),
  ('processtap','sleutel_bron','maand','Per maand',80,'grijs');

-- Wat de prullenbak doet. Wissen staat er niet bij: een kaart wegklikken is
-- een antwoord, en antwoorden blijven staan.
insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','prullenbak_doel','afsluiten','Afsluiten zonder actie',10,'grijs'),
  ('processtap','prullenbak_doel','uitstellen','Uitstellen tot morgen',20,'grijs');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','kaartsoort','positie_geopend','Positie geopend',10,'blauw'),
  ('processtap','kaartsoort','positie_gesloten','Positie gesloten',20,'blauw'),
  ('processtap','kaartsoort','doorrol','Doorrol',30,'blauw'),
  ('processtap','kaartsoort','barometer','Barometer',40,'blauw'),
  ('processtap','kaartsoort','week_update','Week-update',50,'grijs'),
  ('processtap','kaartsoort','chartlezing','Technische analyse',60,'grijs'),
  ('processtap','kaartsoort','gonogo','Go/no-go',70,'grijs'),
  ('processtap','kaartsoort','reviewbesluit','Reviewbesluit',80,'grijs'),
  ('processtap','kaartsoort','herbeoordeling','Herbeoordeling',90,'grijs'),
  ('processtap','kaartsoort','nalezen','Bericht nalezen',100,'grijs'),
  ('processtap','kaartsoort','maandverslag','Maandverslag',110,'grijs'),
  ('processtap','kaartsoort','maandbericht','Maandbericht',120,'grijs');

-- Een eigen lijstweergave: de kaartdefinities naast elkaar, zonder de kolommen
-- die alleen een gewone processtap gebruikt.
insert into db_view (tabel, naam, kolommen, sortering) values
  ('processtap','kaarten',
   '["naam","kaartsoort","bron","prioriteit","sleutel_bron","knop1_label","knop2_label"]',
   'volgorde asc');

insert into schema_versie (versie, omschrijving) values (102, 'de kaartdefinitie op processtap');
