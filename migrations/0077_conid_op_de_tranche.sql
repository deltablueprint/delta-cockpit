-- Het contractnummer van de broker op de tranche.
--
-- Om te zien wat er met een tranche gebeurd is, moet de cockpit haar kunnen
-- terugvinden in het Flex-rapport. Op strike en expiratie matchen gaat bijna
-- altijd goed en af en toe mis — twee tranches op hetzelfde contract, of een
-- strike die als 5800 en als 5800.0 geschreven staat. IBKR geeft elk contract
-- één nummer (`conid`); dat is de enige sleutel die niet kan schuiven.
--
-- Het veld staat niet op het formulier: je kiest het niet, het komt mee als je
-- de positie uit het brokerkader aanwijst.
alter table positie add column conid text;

insert into db_field (tabel, kolom, label, type, volgorde, sectie, verplicht,
                      alleen_lezen, verwijst_naar, audit, breedte, toon_op_formulier)
values ('positie','conid','Contractnummer bij de broker','tekst',205,'uitvoering',0,1,null,1,'140px',0);

insert or ignore into schema_versie (versie, omschrijving) values
  (77, 'conid op de tranche');
