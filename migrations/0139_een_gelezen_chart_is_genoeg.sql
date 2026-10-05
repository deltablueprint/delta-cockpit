-- 0139 · één gelezen chart is genoeg
--
-- De stap telde élke chartlezing. Voeg je naast de standaardset nog een chart
-- toe, dan sprong de stap terug naar open zolang die ene nieuwe leeg was —
-- terwijl het werk juist vooruit ging. Zelfde redenering als bij de
-- instapvoorwaarden (0135): een stap hoort niet te straffen dat je méér
-- opschrijft.
update processtap
   set uitleg = 'Eén chart met een schermafdruk én wat je erin leest, is genoeg. Wat je daarnaast nog toevoegt is winst, geen voorwaarde.'
 where afvinkregel = 'chartlezing_gedaan';

insert into schema_versie (versie, omschrijving) values (139, 'een gelezen chart is genoeg');
