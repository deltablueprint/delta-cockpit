-- 0085 · de tabel heet in de app 'Technische analyse'
--
-- Deze hernoeming stond in 0082, maar werd daar toegevoegd nadat 0082 al was
-- toegepast — en een toegepaste migratie draait niet opnieuw. Vandaar een
-- eigen migratie. De regel 'een migratie wordt nooit aangepast nadat hij is
-- toegepast' bestaat precies hierom: wat er in het bestand staat, is dan niet
-- meer wat er in de database is gebeurd.
--
-- De update is idempotent: op een database waar 0082 wél de nieuwe naam zette,
-- verandert deze migratie niets.

update db_table set label = 'Technische analyse', label_mv = 'Technische analyse'
 where naam = 'chartlezing';

-- Een data-URL in een tabelcel is geen informatie maar een muur van tekens.
-- De schermafdruk hoort op het record en op het gesprek, niet in de lijst.
update db_view set kolommen = '["onderwerp","commentaar","aangemaakt_door","aangemaakt_op"]'
 where tabel = 'chartlezing' and naam = 'standaard';

insert into schema_versie (versie, omschrijving) values (85, 'naam technische analyse');
