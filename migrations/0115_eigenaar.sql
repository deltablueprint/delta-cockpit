-- 0115 · een kaart heeft een eigenaar
--
-- Alles stond in ieders rij. Voor het meeste klopt dat — wie als eerste tijd
-- heeft, stelt het bericht op — maar niet voor alles:
--
--   'Go/no-go: jouw stem ontbreekt' is per persoon. Pieter zag die van
--   Jacqueline, kon hem wegklikken, en dan was de sleutel bezet en werd zij
--   nooit meer gevraagd. Dat is niet theoretisch; een review vond het.
--
--   'Nalezen' ligt bij één iemand. Dat de opsteller hem ook ziet is niet erg,
--   dat hij hem kan beantwoorden wel.
--
-- Dus: een kaart mag een eigenaar hebben. Waar die vandaan komt staat in de
-- definitie, niet in de code.
alter table gebeurtenis add column eigenaar text references gebruiker(id);

-- Hoe de eigenaar gevonden wordt. 'iedereen' is met opzet de standaard: het
-- meeste werk is van ons samen, en een kaart die van niemand is, is van ons
-- allemaal.
alter table processtap add column eigenaar_bron text not null default 'iedereen';

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst) values
  ('processtap','eigenaar_bron','Van wie is de kaart','keuze',235,'kaart',0,1);

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, keuzelijst, verwijst_naar, alleen_lezen) values
  ('gebeurtenis','eigenaar','Van wie','verwijzing',97,'antwoord',0,0,'gebruiker',1);

insert into db_choice (tabel, kolom, waarde, label, volgorde, kleur) values
  ('processtap','eigenaar_bron','iedereen','Van ons samen',10,'grijs'),
  ('processtap','eigenaar_bron','aanleiding','Wie de aanleiding aanwijst',20,'blauw'),
  ('processtap','eigenaar_bron','nalezer','De nalezer van het bericht',30,'blauw');

-- De twee kaartsoorten die echt van één iemand zijn.
update processtap set eigenaar_bron = 'aanleiding' where kaartsoort = 'gonogo';
update processtap set eigenaar_bron = 'nalezer'    where kaartsoort = 'nalezen';

-- De go/no-go-aanleiding wijst de deelnemer al aan in zijn sleutel; nu ook als
-- eigenaar, zodat het scherm en het slot op het antwoord hem allebei kennen.
update processtap set aanleiding =
  'select m.cyclus as cyclus, m.id as beoordelingsmoment,
          m.id || '':'' || g.id as sleuteldeel,
          g.id as eigenaar,
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

create index gebeurtenis_eigenaar on gebeurtenis (eigenaar)
 where vraagt_antwoord = 1 and beantwoord_op is null;

insert into schema_versie (versie, omschrijving) values (115, 'een kaart heeft een eigenaar');
