-- 0020 · kleur van de standaardavatar
-- Zolang iemand geen foto heeft gekozen: een gekleurde bol met de eerste
-- letter van zijn naam. Blauw voor Simon, groen voor Pieter, paars voor
-- Jacqueline.

update gebruiker set kleur = '#136289' where id = 'simon';
update gebruiker set kleur = '#1F5E45' where id = 'pieter';
update gebruiker set kleur = '#6B3FA0' where id = 'jacqueline';

insert into schema_versie (versie, omschrijving) values (20, 'avatarkleuren');
