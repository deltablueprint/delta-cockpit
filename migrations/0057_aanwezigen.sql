-- 0057 — Wie er bij was, bepaalt het quorum
--
-- Niet een getal in een instelling, maar de mensen die je aanwijst: wie
-- meedoet moet inzenden, wie er niet is telt niet mee. Daarmee is het quorum
-- per besluit anders en altijd uitlegbaar.

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht, alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier) values
  ('beoordelingsmoment','aanwezigen_ids','Aanwezigen','tekst',42,'moment',0,0,null,1,'220px',0);

-- Het oude quorumgetal op de processtap heeft afgedaan.
update processtap set quorum = null, quorum_van = null where quorum is not null;

insert into schema_versie (versie, omschrijving) values (57, 'aanwezigen bepalen het quorum');
