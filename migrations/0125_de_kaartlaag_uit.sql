-- 0125 · de taakkaartlaag gaat eruit
--
-- De werkbank was een wachtrij van taken: processtappen die zichzelf tot kaart
-- stempelden, met een stuk SQL per definitie dat bepaalde wanneer. Dat bleek de
-- verkeerde vorm. Het werk aan een cyclus hoort op het cyclusrecord en in zijn
-- related lists; de werkbank gaat over de positie, het venster, de barometer en
-- wat de leden te horen krijgen.
--
-- Niets wordt verwijderd. De definities gaan op archief: ze blijven leesbaar
-- voor wie wil zien hoe het was, maar niets leest ze meer. Hun kolommen op
-- processtap blijven ook staan — een kolom laten vallen betekent de tabel
-- herbouwen, en dat is een groter risico dan een ongebruikte kolom.
--
-- Wat blijft: de gebeurtenissenstroom, de publicaties, de barometer met haar
-- venster, en de sjablonen. De nieuwe werkbank is daarop gebouwd.

-- De twaalf kaartdefinities en het proces waar ze onder hingen.
update processtap set archief = 1
 where proces = 4 or kaartsoort is not null;

update proces set archief = 1 where id = 4;

-- Het menu wijst naar een scherm dat er niet meer is. Een menuregel die op een
-- wit scherm uitkomt is erger dan een menu zonder die regel.
update db_module set actief = 0 where route = '/werkbank';

insert into schema_versie (versie, omschrijving) values (125, 'de taakkaartlaag gaat eruit');
