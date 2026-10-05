-- 0149 · hoe een tranche zich ontwikkelde
--
-- De cockpit wist tot nu toe alleen hoe een positie er nú voor staat: de brug
-- overschrijft de prijs bij elke hartslag. Daarmee is 'hij staat onder druk'
-- een momentopname zonder verleden — terwijl juist het verloop de vraag
-- beantwoordt die een lid stelt: wordt het beter of slechter?
--
-- Eén rij per gemeten moment, en alleen als er iets te zien is: de stand
-- verandert, of er is een uur voorbij. Elke hartslag wegschrijven zou een tabel
-- opleveren die honderd keer zo groot is en geen enkele regel extra vertelt.
create table positiemeting (
  positie integer not null references positie(id),
  moment  text not null default (datetime('now')),
  ask     real,
  bod     real,
  stand   integer,
  binnen  real,                       -- procent van de premie binnen, met teken
  primary key (positie, moment)
);

create index positiemeting_positie on positiemeting (positie, moment desc);

insert into instelling (sleutel, label, waarde, eenheid, uitleg)
 values ('meting_minuten', 'Verloop vastleggen om de', '60', 'minuten',
         'Hoe vaak de stand van een tranche wordt vastgelegd als er niets verandert. Verandert de stand, dan gaat dat altijd meteen mee.');

insert into schema_versie (versie, omschrijving) values (149, 'hoe een tranche zich ontwikkelde');
