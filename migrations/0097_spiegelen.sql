-- 0097 · de broker is de bron; de cockpit spiegelt
--
-- Tot nu toe hield de cockpit een eigen begrip bij — de tranche — en probeerde
-- dat te koppelen aan wat er bij de broker stond. Alles wat moeizaam voelde
-- bestond alleen om die koppeling te onderhouden: herkenning, voorstellen,
-- vlaggen, voornemens, het overnemen van onbekende contracten. Dat is geen
-- bedrijfsproces maar boekhouding om twee lijsten gelijk te houden.
--
-- De broker weet wat er openstaat. Spiegel dat, en de machinerie heeft geen
-- reden van bestaan meer:
--
--   besluit   hoort bij de cyclus — toestemming om (nog) een positie in te
--             nemen. Nul of meer, chronologisch. Raakt een lopende positie
--             nooit; uitstappen gaat altijd via het exitplan.
--   positie   spiegelt de broker. Verschijnt als een contract opent, sluit als
--             het verdwijnt, met de echte prijzen uit de uitvoeringen.
--   exitplan  hangt aan een positie en rekent tegen háár premie.
--   cyclus    ís de keten: besluiten en posities naast elkaar op de tijdlijn.
--
-- Of een sluiting 'een rol' was, is geen gegeven meer maar een verhaal — en dat
-- hoort in de ledencommunicatie, niet in een datamodel.
--
-- Niets wordt gewist. Wat niet meer gevraagd wordt, gaat op niet-actief.

-- D1 zet foreign keys aan. Deze migratie herbouwt 'positie', en daar hangen
-- rijen onder in 'exitregel' en 'voornemen'. Een DROP van de oudertabel telt
-- dan als het wissen van alle ouderrijen, en dat weigert SQLite meteen.
-- Met defer_foreign_keys worden de controles pas aan het einde van de
-- transactie gedaan, en dan staat de tabel er weer, met dezelfde id's.
pragma defer_foreign_keys = on;

-- ---------- wat vervalt ----------
update db_table set actief = 0 where naam = 'voornemen';
update db_module set actief = 0 where route = '/afloop';

-- De vlag en het voorstel per tranche: vervangen door het feit dat de positie
-- gewoon dicht gaat zodra ze bij de broker verdwijnt.
update db_field set actief = 0
 where tabel = 'positie' and kolom in ('duiding_voorstel', 'duiding_waarom', 'duiding_op');
update db_field set actief = 0
 where tabel = 'cyclus' and kolom = 'duiding_open';
update db_view set kolommen = '["label","status","geopend_op","doelexpiratie","volgend_analysemoment","resultaat_pt","aangemaakt_door"]'
 where tabel = 'cyclus' and naam = 'standaard';

-- 'Doorgerold' blijft als uitkomst bestaan voor wat al vastgelegd is, maar
-- wordt niet meer toegekend: de cockpit weet dat een contract sloot en een
-- ander opende, niet dat het één de opvolger van het ander was.
update db_field set actief = 0 where tabel = 'positie' and kolom = 'doorgerold_naar';

-- ---------- wat erbij komt ----------
-- Een positie die bij de broker staat maar (nog) bij geen cyclus hoort. Dat is
-- de enige vraag die de broker niet kan beantwoorden.
alter table positie add column buiten_cycli integer not null default 0;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('positie','buiten_cycli','Buiten de cycli','ja_nee',12,'tranche',0,0,null,1,0,1);

-- Het besluit onder een positie wordt afgeleid: het laatste go-besluit van die
-- cyclus vóór de positie openging. Niemand kiest het, dus niemand kan het fout
-- zetten — het is een verwijzing voor de post-analyse, geen mechaniek.
update db_field set alleen_lezen = 1, keuzelijst = 0, label = 'Volgde op besluit'
 where tabel = 'positie' and kolom = 'beoordelingsmoment';

-- Een positie die opdook zonder dat er een go aan voorafging. Blokkeert niets —
-- de positie bestaat — maar valt op.
alter table positie add column zonder_besluit integer not null default 0;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, geen_lijst, toon_op_formulier) values
  ('positie','zonder_besluit','Zonder voorafgaand besluit','ja_nee',13,'tranche',0,1,null,0,0,1);


-- ---------- een positie zonder cyclus moet kunnen bestaan ----------
-- De broker weet niet bij welke cyclus een contract hoort. Een positie die
-- opduikt terwijl er meer dan één cyclus loopt, blijft dus even onverdeeld
-- staan tot iemand kiest. Daarvoor mag 'cyclus' leeg zijn — tot nu toe stond
-- die kolom op NOT NULL, een overblijfsel van toen een positie alleen uit een
-- besluit kon ontstaan.
--
-- De tabel wordt herbouwd; alles blijft staan.

create table positie_nieuw (
  id            integer primary key autoincrement,
  cyclus        integer references cyclus(id),
  beoordelingsmoment integer references beoordelingsmoment(id),
  tranche       integer not null default 1,
  status        text not null default 'besluit goedgekeurd',
  contract      text,
  strike        real,
  expiratiedatum text,
  aantal        integer,
  ontvangen_premie_pt real,
  inzet_pct     real,
  besluit_strike real,
  besluit_expiratiedatum text,
  besluit_inzet_pct real,
  stoploss_ask  real not null default 60.0,
  winstanker_pct real,
  break_even    real,
  eventregel    text,
  wie_volgt     text references gebruiker(id),
  uitvoering_op text,
  herkomst      text not null default 'handmatig',
  afwijking     integer not null default 0,
  afwijking_soort text,
  afwijking_toelichting text,
  uitkomst      text,
  sluittijdstip text,
  resultaat_pt  real,
  doorgerold_naar integer,
  reden_exit    text,
  toelichting   text,
  archief       integer not null default 0,
  revisie       integer not null default 1,
  aangemaakt_op text not null default (datetime('now')),
  aangemaakt_door text references gebruiker(id),
  ontvangen_premie_eur real,
  order_geplaatst integer not null default 0,
  order_op      text,
  gepubliceerd  integer not null default 0,
  gepubliceerd_op text,
  conid         text,
  duiding_voorstel text,
  duiding_waarom text,
  duiding_op    text,
  teruggekocht_pt real,
  buiten_cycli  integer not null default 0,
  zonder_besluit integer not null default 0
);

insert into positie_nieuw (id, cyclus, beoordelingsmoment, tranche, status, contract, strike, expiratiedatum, aantal, ontvangen_premie_pt, inzet_pct, besluit_strike, besluit_expiratiedatum, besluit_inzet_pct, stoploss_ask, winstanker_pct, break_even, eventregel, wie_volgt, uitvoering_op, herkomst, afwijking, afwijking_soort, afwijking_toelichting, uitkomst, sluittijdstip, resultaat_pt, doorgerold_naar, reden_exit, toelichting, archief, revisie, aangemaakt_op, aangemaakt_door, ontvangen_premie_eur, order_geplaatst, order_op, gepubliceerd, gepubliceerd_op, conid, duiding_voorstel, duiding_waarom, duiding_op, teruggekocht_pt, buiten_cycli, zonder_besluit)
select id, cyclus, beoordelingsmoment, tranche, status, contract, strike, expiratiedatum, aantal, ontvangen_premie_pt, inzet_pct, besluit_strike, besluit_expiratiedatum, besluit_inzet_pct, stoploss_ask, winstanker_pct, break_even, eventregel, wie_volgt, uitvoering_op, herkomst, afwijking, afwijking_soort, afwijking_toelichting, uitkomst, sluittijdstip, resultaat_pt, doorgerold_naar, reden_exit, toelichting, archief, revisie, aangemaakt_op, aangemaakt_door, ontvangen_premie_eur, order_geplaatst, order_op, gepubliceerd, gepubliceerd_op, conid, duiding_voorstel, duiding_waarom, duiding_op, teruggekocht_pt, buiten_cycli, zonder_besluit from positie;

drop table positie;
alter table positie_nieuw rename to positie;
create index positie_cyclus on positie (cyclus);
create index positie_conid on positie (conid);

pragma defer_foreign_keys = off;

insert into schema_versie (versie, omschrijving) values (97, 'de broker is de bron; de cockpit spiegelt');
