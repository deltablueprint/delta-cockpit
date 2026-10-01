-- Proefinzendingen voor Pieter en Jacqueline, alleen voor staging.
--
-- Dit is GEEN migratie: het hoort niet in migrations/ en wordt nooit op
-- productie toegepast. Het zet twee verstuurde inzendingen klaar op het
-- lopende beoordelingsmoment van cyclus 2026-10, zodat de derde inzending —
-- die van Simon, via het scherm — het quorum haalt en de inzendingen opengaan.
--
-- Opnieuw draaien mag: het ruimt eerst zijn eigen regels op.

delete from inzending
 where deelnemer in ('pieter', 'jacqueline')
   and beoordelingsmoment in (
     select m.id from beoordelingsmoment m
       join cyclus c on c.id = m.cyclus
      where c.label like '%2026-10%' and m.status <> 'uitkomst vastgelegd');

insert into inzending (cyclus, beoordelingsmoment, deelnemer, status, positie,
                       strike, expiratiedatum, inzet_pct, reden,
                       motivering, intuitie, wat_ik_zag, verstuurd_op)
select m.cyclus, m.id, d.deelnemer, 'verstuurd', d.positie,
       d.strike, d.expiratie, d.inzet, d.reden,
       d.motivering, d.intuitie, d.zag, datetime('now', '-' || d.minuten || ' minutes')
  from beoordelingsmoment m
  join cyclus c on c.id = m.cyclus
  join (
    select 'pieter' as deelnemer, 'go' as positie, 4900.0 as strike,
           '2026-11-20' as expiratie, 2.5 as inzet, null as reden,
           'Structuur onder de 50-daags is niet gebroken; de daling verloopt ordelijk en het volume bevestigt geen paniek. Op 4900 ligt de buffer ruim onder de steun van augustus.' as motivering,
           'Rustige markt, geen gejaagdheid in de open.' as intuitie,
           'SX5E 5138, VSTOXX 18,4, skew iets opgelopen maar binnen bandbreedte.' as zag,
           95 as minuten
    union all
    select 'jacqueline', 'go', 4850.0,
           '2026-11-20', 2.0, null,
           'Macro-agenda is zwaar: Fed op 28 oktober en ECB op 29 oktober vallen midden in de looptijd. Daarom één strike lager en een kleinere inzet dan Pieter voorstelt.',
           'Twijfel over de rust; het voelt als een markt die nog één keer wil testen.',
           'Rente loopt op, obligaties zwak, olie vlak. Buffer belangrijker dan premie.',
           40
  ) d
 where c.label like '%2026-10%' and m.status <> 'uitkomst vastgelegd';
