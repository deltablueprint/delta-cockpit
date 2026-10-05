-- 0126 · beheer opgeruimd na de kaartlaag
--
-- 0125 haalde de kaartdefinities weg, maar liet staan wat ze liet invullen: de
-- kaartvelden op het processtapformulier, hun keuzelijsten, en de
-- menuregel naar de motorrondes. Een leeg veld met een
-- label leest als iets dat nog ingevuld moet worden, en dat is het niet meer.
--
-- Alles gaat op actief = 0. Dat is wat 'niet in beheer' hier betekent: de rij
-- blijft bestaan, het formulier toont hem niet. Zo komt hij ook terug met één
-- regel zodra de nieuwe werkbank een van deze begrippen weer nodig heeft.

-- De kaartvelden op het processtapformulier.
update db_field set actief = 0
 where tabel = 'processtap'
   and kolom in ('kaartsoort', 'voorwaarde', 'aanleiding', 'sleutel_bron',
                 'prioriteit', 'opschalen_na_uur', 'opschalen_naar',
                 'kaarttitel', 'feiten', 'eigenaar_bron',
                 'knop1_doel', 'knop1_label', 'knop1_sjabloon',
                 'knop2_doel', 'knop2_label', 'knop2_reden_verplicht',
                 'prullenbak', 'prullenbak_doel', 'tweede_lezer',
                 'bron', 'reden');

-- De twee secties waarin ze stonden ('De kaart in de wachtrij', 'De knoppen
-- onder de kaart') hoeven niets: het recordscherm laat een sectie zonder
-- zichtbare velden al weg.

-- De keuzelijsten die alleen die velden bedienden. 'eigenaar' en 'afvinkregel'
-- blijven: die horen bij de stap zelf, niet bij de kaart.
update db_choice set actief = 0
 where tabel = 'processtap'
   and kolom in ('kaartsoort', 'knop1_doel', 'knop2_doel', 'sleutel_bron',
                 'prioriteit', 'prullenbak_doel', 'opschalen_naar',
                 'eigenaar_bron', 'bron');

-- De motorrondes. De motor bestaat niet meer, dus de logboektabel ook niet in
-- het menu. De rijen blijven staan: ze zeggen wat er die dagen gedraaid heeft.
update db_module set actief = 0 where label = 'Motorrondes';

-- Op de gebeurtenis wijst 'processtap' naar een kaartdefinitie die er niet meer
-- is. 'Vraagt antwoord', 'sleutel' en 'beantwoord op' blijven wel: een kaart
-- blijft bestaan, alleen gaat hij voortaan over een positie.
update db_field set actief = 0 where tabel = 'gebeurtenis' and kolom = 'processtap';
update db_field set actief = 0 where tabel = 'gebeurtenis' and kolom = 'wachten_tot';

-- De instelling van de motorrondgang stuurde niets meer aan.
update instelling set archief = 1 where sleutel = 'motor_rondgang_seconden';

insert into schema_versie (versie, omschrijving) values (126, 'beheer opgeruimd na de kaartlaag');
