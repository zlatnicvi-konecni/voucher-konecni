# Samostatný plán kontroly etapy 1

## Lokální kontrola vývojáře

Z kořene repozitáře: `node --check online-vouchers.js` a
`node --test tests/online-vouchers.test.cjs`. VM nemá síťové ani storage API;
ověřuje výchozí uzamčení, ztrátu autorizace a vymazání dat, povinnou platbu,
zápornou/nulovou/desetinnou/nebezpečně velkou částku, prázdný PIN a opakování.
Neověřuje HTML ani prohlížečové constraint validation, skutečný login či backend.

Browser smoke test: `node tests/online-vouchers.browser.cjs` (Playwright a
Chromium; případně nastavit `CHROMIUM_PATH`). V cloudovém prostředí prošel:
UI se ukryje/zobrazí podle testovacího stavu, submit zůstane nepropojený,
PIN a údaje po ztrátě oprávnění zmizí. Všechny externí požadavky jsou
zablokované před navigací; žádný požadavek na backend nebyl ani zahájen.
CDN skripty se nenačítají, takže tento smoke test neověřuje QR/NIIMBOT.
Ověřena také syntaxe inline skriptu a JS modulu a `git diff --check`.

## Nezávislá kontrola — dosud neprovedena

Pro browser test před navigací blokovat všechny externí požadavky (zejména
Google Apps Script), odpovědi zařízení dodávat pouze testovacím stubem.
Nespouštět skutečný create/redeem. HTTPS je stávající podmínka aplikace.

| Kroky | Očekávání |
| --- | --- |
| Bez registrace / zamítnutá autorizace / chyba připojení | Online formulář skrytý, pole zakázaná. |
| Testovací stub device-status vrátí autorizaci | Formulář dostupný; výrazně označený jako nepropojený. |
| Prázdná pole, chybný e-mail, nulová/záporná/desetinná částka či kus, whitespace ID/PIN, nezaškrtnutá platba | Kontrola neprojde; žádný síťový požadavek ani kód. |
| Smyšlená objednávka a položka, kus 1, 1500 Kč, e-mail example@example.invalid, testovací osoba/PIN, potvrzení platby; opakovat s 3000 Kč | Pouze zpráva o lokálním formátu; jasně neověřený PIN/platba, žádný voucher/PDF; PIN smazán. |
| Dvojklik nebo opakované odeslání | Žádná emise ani API. |
| Ztráta autorizace a reset | Údaje a zpráva smazány; při ztrátě i zamčení. |
| Vložit HTML do ID/osoby | Žádné spuštění HTML ani vypsání osobních údajů do výsledku. |
| Klávesnice, mobilní viewport, čtečka | Labely, validace, status a tlačítka srozumitelné a ovladatelné. |
| Porovnat původní workflow proti výchozí větvi se stubem | Payloady create/lookup/redeem a device akcí, QR obsah a NIIMBOT 30×20 beze změn. Kamera a skutečná tiskárna vyžadují zařízení. |

## Až bude dodán testovací backend

Ověřit skutečné PIN/zařízení na serveru i při přímém volání, částku/měnu/
produkt podle objednávky, dva testovací vouchery 1500/3000 Kč, jejich PDF,
QR lookup a částečné/úplné redeem. Dvojklik, dvě souběžné operace, retry,
timeout, restart mezi zápisy a opakovaný webhook musí vrátit tentýž voucher.
Selhání a regenerace PDF nesmějí vydat další kód. Nezaplacená/částečná platba,
refundace, storno a nesoulad částky vedou k blokaci/ručnímu řešení. Prověřit
současné Wix Gift Card kódy, soukromé PDF, nepřítomnost osobních údajů v QR
a absenci veřejných QR služeb. Automatická emise musí zůstat vypnutá.

Každý nález: verze/commit, předpoklady, kroky, očekávání, skutečnost, dopad,
bezpečný důkaz bez tajemství. Vrátit vývojovému agentovi, po opravě zopakovat.
Tento plán ani lokální VM test nejsou nezávislý Codex Code Review.
