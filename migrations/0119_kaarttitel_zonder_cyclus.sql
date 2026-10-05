-- 0119 · de cyclus staat als pil op de kaart, niet in de titel
--
-- De titel luidde 'Technische analyse {{cyclus.naam}}', dus op het scherm stond
-- 'Technische analyse Test Cyclus' als één zin. Waar iets over gaat is geen deel
-- van wat er gevraagd wordt; dat hoort ernaast te staan, niet erin.
--
-- De wachtrij stuurt de cyclus al mee, dus het scherm kan hem zelf zetten.
update processtap set kaarttitel = 'Technische analyse'
 where kaartsoort = 'chartlezing';
update processtap set kaarttitel = 'Go/no-go'
 where kaartsoort = 'gonogo';
update processtap set kaarttitel = 'Besluit vastleggen'
 where kaartsoort = 'reviewbesluit';
update processtap set kaarttitel = 'Maandverslag {{feiten.maand}}'
 where kaartsoort = 'maandverslag';

insert into schema_versie (versie, omschrijving) values (119, 'de cyclus staat als pil op de kaart, niet in de titel');
