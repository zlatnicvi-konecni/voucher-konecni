# Online vouchery Wix — zadání pro vývojového a testovacího agenta

## Potvrzený kontext a cíl
Repo `zlatnicvi-konecni/voucher-konecni` je vývojová kopie. Její Apps Script a tabulka jsou oddělené od ostré evidence `Dilnakk/voucher` na jiném účtu. **V první fázi jen bankovní převody a ruční vystavení**; předávané PDF s designem bude dodáno později. Budoucí bezobslužná aktivace po platbě kartou nebo ručním označení Wix objednávky jako zaplacené musí být připravitelná bez přepisování registru voucherů.

## Vývojový agent — úkoly v pořadí
1. Projdi `index.html`, najdi vydání (`create`), QR, lookup/redeem, autorizaci zařízení a tisk. Udělej stručný diagram současného toku a nepředpokládej neviděný Apps Script backend.
2. Připrav UI „Online poukazy“ přístupné **jen autorizovaným zařízením**; údaje: `wixOrderId`, případně položka objednávky, nominální hodnota Kč, e-mail zákazníka, osoba vystavující, PIN, zaškrtávací potvrzení bankovní platby. Ochranná část musí být i na serveru — JS ochrana nestačí. Před potvrzením nevolej `create`. Nevyužívej zákaznický veřejný web pro vystavení.
3. Navrhni nedestruktivní Apps Script API a schéma dat v samostatném listu `OnlineObjednavky` pro: order ID, line item ID/kus, částku, měnu, stav `PENDING_PAYMENT / PAYMENT_CONFIRMED / ISSUED / PDF_READY / SENT / CANCELLED`, voucher ID/kód, Drive ID, issuer, timestamps, audit, chyby a vazbu na prodejnu. ID objednávky plus line item/instance zaručuje jednoznačnost. `LockService` kolem vystavení.
4. Pro samotné vydání používej existující serverovou autorizační logiku a stejnou tabulku voucherů. Nikdy nedělej zápis přímo z Wix klienta do Sheets. Nedubluj kód. Zabezpečený backend může mít např. akce `online-preview`, `online-issue`, `online-get-pdf`; skutečné názvy přizpůsob stávajícímu backendu po jeho předložení.
5. Výstup: PDF voucher s dodaným grafickým podkladem, hodnotou, unikátním kódem, QR obsahujícím stejný kód a platností. Použij soukromé šablony/uložení; žádná veřejná QR API ani veřejné sdílení přímého PDF.
6. První verze: zaměstnanec zkontroluje banku, případně Wix objednávku, stiskne `Vystavit`, otevře PDF, odešle ručně zákazníkovi a označí `Odesláno`. Později lze doplnit posílání e-mailu z backendu.
7. Wix konektor navrhni serverově. Ověř skutečný typ produktu: vestavěné `Wix Gift Cards` vs standardní Wix Stores produkt. V případě vestavěných gift cards nejdříve posuď konflikt dvou registrů / automaticky odeslaného kódu, neprováděj souběžnou emisi. Čtení objednávky dělej podle Wix order ID přes backendovou autentizaci. Wix API secrets výhradně mimo repo.
8. Pro budoucí aktivaci lze využít `wixEcom_onOrderPaymentStatusUpdated` (Wix Velo `backend/events.js`) jako trigger, ale po události znovu ověř order ID, položky, měnu, částku a skutečný stav `PAID` na serveru a dodej idempotenci. Tuto automatickou emisi nyní **NEZAPÍNEJ**. Wix payment status `PAID` po ručním označení není totéž jako bankou strojově ověřený převod — jde o potvrzení obsluhy.
9. Bez testovacího Apps Script backendu a jeho přesného schématu vytvoř pouze UI mock/adaptér a zdokumentuj chybějící napojení. Nepředstírej funkční integraci.

## Nezávislý testovací agent — co ověřit
- Původní prodejní workflow: vytvoření, lookup, částečné/úplné uplatnění, QR sken, NIIMBOT štítek, autorizace a PIN beze změny.
- 1 objednávka / 1 položka / 1 voucher: vytvoří se jeden záznam, částka i měna souhlasí, QR po načtení vrací kód z registru.
- Dvojklik, současné dvě operace, timeout, opakovaný webhook, restart: stále jediný voucher; oprava PDF neaktivuje další kód.
- Nezaplacená objednávka, chybný typ produktu, chybné ID, záporné číslo, změna hodnoty, špatný PIN a neautorizované zařízení nevedou k vydání.
- Nesoulad s bankovní platbou, refundace, storno a částečná platba musí přejít do ručního řešení; neautomatizovat bez jednoznačného pravidla.
- QR ani PDF nezveřejňují osobní údaje nebo tajné tokeny, kódy nepředávají třetí QR službě.
- Přejímací scénář: testovací objednávky 1 500 Kč a 3 000 Kč, po ručním potvrzení 2 PDF, lookup+částečný redeem sedí, opakování první nevydá další.
- Každá připomínka má mít reprodukci (kroky, očekávání, skutečnost). Opravy vrátit vývojovému agentovi; test zopakovat. Žádný automatický merge.

## Předání / blokery
Získat a bezpečně zpřístupnit pouze testovací backend Apps Script (serverové funkce a schéma, bez osobních dat a tajných hodnot), testovací Google Sheet, grafický podklad PDF a typ produktu/dárkového poukazu ve Wixu. Rozhodnout, zda už má Wix ve výchozím stavu generovat/posílat vlastní Gift Card kód. Nezadávat citlivosti přímo do chatu ani GitHubu.

## Dokumentace
- Wix eCommerce event `onOrderPaymentStatusUpdated`: https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/events/on-order-payment-status-updated
- Wix manual payments: https://support.wix.com/en/article/setting-up-manual-offline-payments
- Wix gift cards: https://support.wix.com/en/article/about-wix-gift-cards

## Vstupní instrukce pro vývojového agenta
Proveď fázi 1 bezpečné rozšíření tohoto pracovní repo. Přečti `AGENTS.md` a `docs/ONLINE_VOUCHERY_WIX.md`. Zmapuj strukturu `index.html`, připrav návrh a mock UI pro online vouchery, bez kontaktu s ostrým backendem. Vytvoř změny jen ve své větvi, se samostatným testovacím plánem. Pokud chybí Apps Script kód nebo grafika, označ rozhraní jako nepropojené a dodej seznam potřebných souborů. Netvrď, že integrace funguje, dokud nejsou testy.

## Vstupní instrukce pro testovacího agenta
Neimplementuj nové funkce, kontroluj nezávisle práci vývojového agenta podle požadavků a negativních scénářů výše. Vytvoř reprodukovatelný test report, včetně možného dopadu na původní voucher, QR/NIIMBOT a login. Pro jakýkoli problém vrať úkol vývojovému agentovi. Nikdy nevystavuj ostré vouchery, nepřepisuj `main` ani `Dilnakk/voucher`.
