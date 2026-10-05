-- 0112 · de aanleiding van een kaart
--
-- Tot nu toe kon een kaart maar op één manier ontstaan: er gebeurde iets, dat
-- werd een gebeurtenis, en de weger stempelde die tot kaart. Dat dekt alles wat
-- IBKR meldt en alles wat wij doen.
--
-- Vier kaarten vallen daarbuiten, want ze gaan over iets dat er níét gebeurde:
-- een go/no-go waarin jouw stem ontbreekt, een besluit dat niet is vastgelegd,
-- charts die niet gelezen zijn, een voorwaarde die uit de pas loopt. Daar is
-- geen gebeurtenis van; er is alleen een toestand die blijft hangen.
--
-- Die toestand kan de motor opzoeken. De vraag is waar die zoekopdracht staat,
-- en het antwoord moet hetzelfde zijn als bij al het andere: in beheer. Anders
-- is dit de ene plek waar kaartlogica alsnog in de code kruipt.
--
-- aanleiding is een SELECT die rijen oplevert waar een kaart bij hoort. Alleen
-- lezen, nooit schrijven: de motor weigert alles wat niet met 'select' begint,
-- en alles met een puntkomma, commentaar of een schrijfwoord erin.
alter table processtap add column aanleiding text;

-- De kolommen die zo'n SELECT mag teruggeven. Meer is er niet nodig, en wat er
-- niet in staat wordt genegeerd in plaats van blind in een insert geduwd.
--   cyclus, positie, publicatie, beoordelingsmoment  — waar het over gaat
--   titel, detail                                   — wat erboven komt te staan
--   sleuteldeel                                     — wat deze aanleiding uniek maakt
--   feiten_json                                     — de feiten, als json

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht) values
  ('processtap','aanleiding','Aanleiding opzoeken met','lang',225,'kaart',0);

-- ------------------------------------------------- de vier toestandskaarten
update processtap set aanleiding =
  'select m.cyclus as cyclus, m.id as beoordelingsmoment, g.id as sleuteldeel,
          ''Go/no-go: jouw stem ontbreekt'' as titel,
          c.label as detail
     from beoordelingsmoment m
     join cyclus c on c.id = m.cyclus
     join gebruiker g on g.actief = 1
    where m.archief = 0 and m.status = ''blind inzenden''
      and not exists (select 1 from inzending i
                       where i.beoordelingsmoment = m.id and i.deelnemer = g.id
                         and i.archief = 0 and i.verstuurd_op is not null)'
 where kaartsoort = 'gonogo';

update processtap set aanleiding =
  'select m.cyclus as cyclus, m.id as beoordelingsmoment, m.id as sleuteldeel,
          ''Het besluit is nog niet vastgelegd'' as titel,
          c.label as detail
     from beoordelingsmoment m
     join cyclus c on c.id = m.cyclus
    where m.archief = 0 and m.status = ''blind versturen'''
 where kaartsoort = 'reviewbesluit';

update processtap set aanleiding =
  'select m.cyclus as cyclus, m.id as beoordelingsmoment, m.id as sleuteldeel,
          ''De charts zijn nog niet gelezen'' as titel,
          c.label as detail
     from beoordelingsmoment m
     join cyclus c on c.id = m.cyclus
    where m.archief = 0 and m.status in (''inzendingen open'', ''blind inzenden'')
      and not exists (select 1 from chartlezing l
                       where l.beoordelingsmoment = m.id and l.archief = 0
                         and coalesce(trim(l.commentaar), '''') <> '''')'
 where kaartsoort = 'chartlezing';

update processtap set aanleiding =
  'select v.cyclus as cyclus, v.id as sleuteldeel,
          ''Voorwaarde staat op '' || v.status || '': '' || v.naam as titel,
          v.toelichting as detail
     from voorwaarde v
     join cyclus c on c.id = v.cyclus
    where v.archief = 0 and v.status = ''rood''
      and c.archief = 0 and c.status not in (''afgesloten'', ''geannuleerd'')'
 where kaartsoort = 'herbeoordeling';

-- De sleutelvormen die bij deze aanleidingen horen. cyclus_moment en
-- moment_deelnemer gebruikten feiten die er bij een toestandskaart niet zijn;
-- sleuteldeel is wat de SELECT zelf aanwijst.
update processtap set sleutel_bron = 'aanleiding'
 where kaartsoort in ('gonogo', 'reviewbesluit', 'chartlezing', 'herbeoordeling');

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','sleutel_bron','aanleiding','Per aanleiding',5,'grijs');


-- De voorwaarde van deze vier wees naar een soort die niemand meer schrijft.
-- De melder stempelt zelf, dus de weger komt er niet aan — maar een definitie
-- die iets beweert dat niet klopt, leest later als een fout die er niet is.
update processtap set voorwaarde = 'soort = ''' || kaartsoort || '_open'''
 where kaartsoort in ('gonogo', 'reviewbesluit', 'chartlezing', 'herbeoordeling');

insert into schema_versie (versie, omschrijving) values (112, 'de aanleiding van een kaart staat in beheer, niet in de code');
