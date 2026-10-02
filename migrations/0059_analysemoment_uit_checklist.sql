-- 0059 — Het volgend analysemoment hoort niet in de checklist
--
-- Het is geen stap in de pre-analyse: je prikt het juist ná een no-go, en
-- tot dat moment staat het terecht leeg. Als herinnering stond het alleen in
-- de weg; het veld blijft gewoon op de cyclus staan.

update processtap set archief = 1 where afvinkregel = 'analysemoment_geprikt';

insert into schema_versie (versie, omschrijving) values (59, 'analysemoment uit de checklist');
