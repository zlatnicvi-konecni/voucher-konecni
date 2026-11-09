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

## Regrese oprav P2 / P3 v PR #1

Spustit navíc `node tests/voucher-regression.browser.cjs`. Test používá pouze
smyšlené údaje a odpovědi přes Playwright route; skutečný backend ani tabulky
nepoužívá. Prohlížeč má navíc proxy na uzavřeném loopback portu, takže ani
nezachycený požadavek nemůže odejít ven. Přechod z Apps Script URL na
Googleusercontent se simuluje klientskou navigací (WindowProxy se zachová),
nikoli skutečným Google HTTP přesměrováním: Playwright neinterceptuje další
HTTP redirect hops. Test nepředstírá ověření reálného deploymentu.

Ověřeno v Chromiu:
- Správný request ID z cizího iframe včetně stejného Google sandbox původu
  neodemkne autorizaci. Odmítají se také chybný původ při správném source,
  `null`, HTTP, podvržené suffixy/domény, chybějící source a chybná obálka/ID.
- Legitimní odpověď ze skutečného vnořeného sandboxu odemkne UI;
  přímá odpověď po navigaci na script.googleusercontent.com také projde.
  Samostatně je ověřen přímý script.google.com původ.
- Registrace zachová payload bez device tokenu; další operace přidávají
  autorizaci. Create zachová částku/PIN a předá pouze kód do QR; lookup,
  redeem 500 + 1000 Kč a následný nulový zůstatek fungují s in-memory fixture.
  Chybný PIN serverová fixture odmítne, chybějící PIN ani neautorizované
  zařízení neodesílají požadavek.
- Scanner předá normalizovaný kód do lookup. NIIMBOT dostane volání se
  zachovanou velikostí 240 × 160 px / 203 dpi, jednou kopií a kódem voucheru.
  QR knihovna, kamera, rasterizace štítku i Bluetooth jsou testovací doubles;
  čitelnost QR a fyzický tisk tím ověřeny nejsou.
- `tests/online-vouchers.browser.cjs` ověřuje P3 po úpravě částky, checkboxu,
  opakovaném potvrzení s vymazaným PIN a programově zneplatněném e-mailu.
  Nativní `invalid` vymaže starý úspěch, i když vůbec nenastane `submit`.

Žádný reálný voucher nebyl vytvořen ani uplatněn. Integrace se skutečným
backendem a periferiemi zůstává samostatnou přejímkou v testovacím prostředí.
