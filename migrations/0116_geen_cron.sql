-- 0116 · de brug is de klok
--
-- De motor draaide elk uur op een cron. Dat betekende dat een kaart die uit een
-- toestand komt — 'jouw stem ontbreekt', 'de charts zijn niet gelezen' — tot
-- negenenvijftig minuten op zich kon laten wachten. Voor een go/no-go die nú
-- begint is dat onbruikbaar.
--
-- Maar er draait al een klok: de brug stuurt elke tien seconden een hartslag
-- vanaf de VPS, dag en nacht, ook als er niets gebeurt. Dat is precies wat een
-- cron deed, alleen tweehonderdveertig keer zo fijn.
--
-- Drie aanleidingen, en samen dekken ze alles:
--   brug   — elke hartslag weegt; de rondgang over de dag hoogstens elke paar
--            minuten, want die hoeft niet elke tien seconden.
--   mens   — elke schrijfactie die een toestand kan maken, meteen.
--   scherm — een openstaande werkbank peilt toch al; die houdt het draaiend als
--            de brug er even uit ligt.
--
-- Wat we daarmee opgeven: als álles stilligt — geen brug, niemand ingelogd —
-- gebeurt er niets. Dat is geen verlies. Een kaart die niemand kan zien hoeft
-- niet te bestaan, en zodra er iemand kijkt staat hij er.
insert into instelling (sleutel, label, waarde, eenheid, uitleg) values
  ('motor_rondgang_seconden', 'Volledige rondgang hoogstens elke', '10', 'seconden',
   'De brug tikt elke tien seconden. Wegen is goedkoop en gebeurt bij elke tik; de rondgang langs de kalender en alle toestandsvragen is duurder. Staat dit gelijk aan de hartslag, dan gebeurt alles meteen. Hoger zetten is de knop om aan te draaien als de database het te druk krijgt — niet eerder.');

insert into schema_versie (versie, omschrijving) values (116, 'de brug is de klok; de cron gaat eruit');
