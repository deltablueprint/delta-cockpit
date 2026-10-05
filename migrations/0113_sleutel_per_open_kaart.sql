-- 0113 · de sleutel geldt per openstaande kaart, niet voor altijd
--
-- De unieke index op gebeurtenis.sleutel gold over alle rijen. Daardoor was een
-- sleutel na één keer voorgoed bezet, en dat is precies verkeerd om voor alles
-- wat heen en weer beweegt:
--
--   barometer 3 → 4 (kaart, beantwoord), 4 → 5, en dan de markt wordt rustig en
--   het systeem stelt weer 4 voor. Sleutel 'barometer:c7:4' bestond al, dus er
--   kwam geen kaart. Niemand werd gevraagd de stand terug te zetten.
--
--   een voorwaarde die rood → groen → rood gaat, krijgt de tweede keer geen
--   kaart. Juist de tweede keer is het interessant.
--
--   en bij de go/no-go: na één ronde beantwoorden kreeg niemand ooit nog een
--   kaart, want 'gonogo:simon' was bezet.
--
-- Wat er bewaakt moet worden is niet 'deze vraag is ooit gesteld' maar 'deze
-- vraag staat nu open'. Een beantwoorde kaart hoort de weg vrij te maken voor
-- dezelfde vraag als die zich opnieuw voordoet.
drop index gebeurtenis_sleutel;

create unique index gebeurtenis_sleutel on gebeurtenis (sleutel)
 where sleutel is not null and vraagt_antwoord = 1 and beantwoord_op is null;

-- De go/no-go-aanleiding nam alleen de deelnemer als sleutel, zonder het
-- beoordelingsmoment. Met twee open momenten kreeg alleen het eerste kaarten,
-- en na het beantwoorden ervan kreeg niemand er ooit nog een.
update processtap set aanleiding =
  'select m.cyclus as cyclus, m.id as beoordelingsmoment,
          m.id || '':'' || g.id as sleuteldeel,
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

insert into schema_versie (versie, omschrijving) values (113, 'de sleutel geldt per openstaande kaart, niet voor altijd');
