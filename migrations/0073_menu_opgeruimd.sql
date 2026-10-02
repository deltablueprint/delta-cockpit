-- Niet elke tabel verdient een menu-ingang.
--
-- Een regel in 'Events in de looptijd' is de behandeling van één event binnen
-- één cyclus. Buiten die cyclus om zegt hij niets: je kijkt naar 'vermijden'
-- zonder te zien waarvan. Hetzelfde geldt voor een exitregel, die hoort bij één
-- tranche. Beide blijven als tabblad staan waar ze betekenis hebben.
--
-- Voorwaarden, inzendingen en besluiten blijven wél in het menu: die zijn over
-- cycli heen te lezen — alle inzendingen van dit kwartaal, alle voorwaarden die
-- rood stonden — en dat is een vraag die je stelt zonder eerst een cyclus te
-- kiezen.
update db_module set actief = 0
 where doeltabel in ('cyclus_event', 'exitregel');
