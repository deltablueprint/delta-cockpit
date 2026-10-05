-- 0127 · de laatste sporen van de kaartlaag
--
-- Na 0125 en 0126 stond er nog een en ander overeind dat alleen bestond omdat
-- de motor bestond. Een review vond het; het staat hier bij elkaar.
--
-- Zoals eerder: niets wordt verwijderd, alles gaat uit. De uitzondering staat
-- onderaan en is er met reden.

-- 1. De tabel 'motorronde'. 0126 haalde alleen de menuregel weg, maar de tabel
--    stond nog actief in de definitielaag — dus in /api/meta, in het
--    beheerscherm 'Tabellen en velden', en als werkend scherm op #/t/motorronde.
--    Een tabel met een keuzelijst 'De klok' voor een klok die niet meer loopt.
--    De rijen blijven staan: ze zeggen wat er die dagen gedraaid heeft.
update db_table  set actief = 0 where naam  = 'motorronde';
update db_field  set actief = 0 where tabel = 'motorronde';
update db_choice set actief = 0 where tabel = 'motorronde';
update db_view   set actief = 0 where tabel = 'motorronde';

-- 2. De weergave 'kaarten' op processtap. Zeven kolommen, waarvan er zes in
--    0126 zijn uitgezet. Hij rendert niet omdat worker/lijst.js alleen de
--    weergave 'standaard' leest — maar dat is geluk, geen opzet.
update db_view set actief = 0 where tabel = 'processtap' and naam = 'kaarten';

-- 3. De twee instellingen van de achterstandsmeter. worker/achterstand.js is
--    weg; deze twee stuurden niets meer aan en stonden met uitleg en al in het
--    beheerscherm. 0126 deed dit wel voor motor_rondgang_seconden.
update instelling set archief = 1
 where sleutel in ('achterstand_amber_uur', 'achterstand_rood_uur');

-- 4. Favorieten en bezoeken die naar /werkbank wijzen. Dit is de ene plek waar
--    wél verwijderd wordt, en dat is precies zoals afgesproken: een favoriet en
--    je eigen geschiedenis zijn geen vastlegging maar een persoonlijke
--    instelling. Ze bewaren niets over een cyclus, een besluit of een positie —
--    ze zeggen alleen waar jij graag heen gaat en waar je net was. Laat je ze
--    staan, dan houdt iedereen die de werkbank als favoriet had een ster in zijn
--    menu die op een leeg scherm uitkomt.
delete from favoriet where route = '/werkbank' or route like '/werkbank?%';
delete from bezoek    where route = '/werkbank' or route like '/werkbank?%';

insert into schema_versie (versie, omschrijving) values (127, 'de laatste sporen van de kaartlaag');
