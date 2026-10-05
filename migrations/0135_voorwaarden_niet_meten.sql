-- 0135 · een instapvoorwaarde wordt bepaald, niet gemeten
--
-- Op het cyclusrecord hoefde elke voorwaarde een gemeten waarde te dragen, met
-- wie hem mat en wanneer. In de praktijk is dat niet wat er gebeurt: je kijkt,
-- je oordeelt, en je zet de status. Het getal eromheen was een tweede
-- administratie die niemand bijhield, waardoor de stap bleef openstaan terwijl
-- het werk gedaan was.
--
-- Vanaf nu: de voorwaarde en haar status, en die status zet een mens zelf.
--
-- 1. De meetvelden uit de definitielaag. De kolommen blijven staan — wat er ooit
--    in gezet is blijft leesbaar, maar er komt niets meer bij.
update db_field set actief = 0
 where tabel = 'voorwaarde' and kolom in ('gemeten_waarde', 'gemeten_door', 'gemeten_op');

-- 2. De lijst toont de voorwaarde en haar status. Verder niets.
update db_view set kolommen = '["naam","status"]'
 where tabel = 'voorwaarde' and naam = 'standaard';

-- 3. De regel die een waarde eiste bij een oordeel heeft geen onderwerp meer.
update db_rule set versie_tot = (select max(nummer) from configuratieversie)
 where tabel = 'voorwaarde' and kolom = 'gemeten_waarde' and versie_tot is null;

-- 4. 'Niet gemeten' heet nu wat het is: nog niet bepaald. De waarde blijft
--    'niet gemeten', want die staat in bestaande rijen; alleen het woord op het
--    scherm verandert.
update db_choice set label = 'Nog niet bepaald'
 where tabel = 'voorwaarde' and kolom = 'status' and waarde = 'niet gemeten';

-- 5. De stap heet naar wat hij doet, en gaat af zodra er één voorwaarde staat.
--    Het oordeel per voorwaarde is werk voor het gesprek, niet voor een vinkje:
--    een stap die pas afgaat als alles groen, oranje of rood staat, duwt mensen
--    naar een status kiezen om van de stap af te zijn.
update processtap
   set naam = 'Instapvoorwaarden bepalen',
       uitleg = 'Eén instapvoorwaarde is genoeg om deze stap te zetten. De status zet je zelf, per voorwaarde — het systeem meet niets.'
 where afvinkregel = 'voorwaarden_ingevuld';

-- 6. En één naam die niet klopte: 'Tranche in de markt' zegt waar iets staat,
--    niet wat je gedaan hebt. Het is de eerste tranche, en die wordt geplaatst.
update processtap set naam = 'Eerste Tranche geplaatst'
 where afvinkregel = 'tranche_in_de_markt';
update db_choice set label = 'Eerste Tranche geplaatst'
 where tabel = 'processtap' and kolom = 'afvinkregel' and waarde = 'tranche_in_de_markt';

insert into schema_versie (versie, omschrijving) values (135, 'een instapvoorwaarde wordt bepaald, niet gemeten');
