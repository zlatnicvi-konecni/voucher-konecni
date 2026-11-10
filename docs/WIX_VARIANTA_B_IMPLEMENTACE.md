# Varianta B – zachovat Wix vzhled a tlačítko, voucher vydává Koneční (IMPLEMENTAČNÍ ZADÁNÍ)

**Rozhodnutí (10. 11. 2026):** Přejít na B. U nativního Wix Gift Cards checkoutu **není doložena podporovaná cesta k získání úplného automaticky vytvořeného kódu** pro bezpečný import do Google Sheets. Jedná se o závěr z dokumentace; live Wix API test nebyl proveden.

## Pevná pravidla
- Zákazník má dál nahoře odkaz/tlačítko „Koupit dárkový poukaz“ a stránku vizuálně co nejpodobnější současné Wix Gift Cards. Zachovat výběr **3 000 / 5 000 / 10 000 Kč**, příjemce (jméno/e-mail) a checkout s převodem na účet.
- **Nenahrazovat zákaznickou stránku produktovou galerií** mezi šperky. Navrhnout samostatnou Wix Studio stránku / formulář. Pro košík lze prozkoumat běžný Wix Stores produkt / varianty, ale ověřit, jak lze omezit jeho zobrazování v galeriích; úplně skrytý produkt nemusí být zakoupitelný. Neoznačovat za vyřešené bez průchodu testovacím checkoutem.
- Nativní Wix Gift Cards checkout nesmí pro *nový* tok současně vydat další poukaz; přepnutí tlačítka na nový tok provést až po otestování, s možností návratu. Existující Wix Gift Cards systém nemaž, historické karty nenaruš.
- **Jediný zdroj pravdy pro nově vydané poukazy:** existující Google Sheets **testovací** evidence a její Apps Script backend. Použít existující vydávání, ověření a čerpání; zachovat původní QR textový kód, PIN, zařízení i NIIMBOT tisk. **Pro ostrý systém** je oddělený účet `Dilnakk/voucher`; na něj agenti nesmějí zapisovat.
- Nejprve jen příprava řešení a test v *izolovaném prostředí*; žádná změna publikovaného webu, žádné označení živé objednávky #10002 jako zaplacené, žádné skutečné e-maily, žádné PR merge.

## Uživatelský workflow
1. Tlačítko `Koupit dárkový poukaz` otevře vlastní Wix Studio stránku ve vizuální podobě dnešního Gift Cards. Zákazník vybere jednu ze tří hodnot a údaje příjemce.
2. Wix objednávka musí jednoznačně označovat digitální voucher (produkt/varianta/položka, množství, měna Kč, příjemce), bez automatické emise Wix Gift Cards. Běžná platba bankovním převodem.
3. Pouze **při skutečně potvrzeném stavu PAID** (po ručním potvrzení pracovníkem ve Wixu nebo později kartou) reaguje `wixEcom_onOrderPaymentStatusUpdated` v serverovém `backend/events.js`; poté backend přes autorizované Wix API znovu ověří order, line items, částku, měnu, stav, případné refundace/storna. Nevěřit browseru ani samotným payloadům.
4. Wix backend bezpečně předá podepsanou/autorizovanou žádost do **testovacího** Apps Script backendu. Autentizaci oddělit od uživatelského PINu, tajné klíče jen Wix Secrets a Apps Script ScriptProperties; nevystavovat klientovi ani veřejnému GitHubu. U klasické Apps Script web app ověřit, jak bezpečně přijímat webhooky/přes HTTPS, limity a možné potřeby proxy.
5. Serverová transakce v Sheets (LockService, ID `wixOrderId + wixLineItemId + unitNumber`, audit/idempotence) zajistí přesně jeden voucher na kus objednávky. Opakovaný event/timeout nesmí založit nový voucher.
6. Backend vytvoří PDF ze schválené dvoustránkové šablony 170×120 mm: na **2. straně dole vlevo v poli „Kód“** QR s týmž kódem a čitelný textový kód; uprostřed dole „Platnost poukazu do“ dle zásad (současné Wix 24 měsíců od nákupu, nutno sladit s pravidly Apps Scriptu); předtištěná nominální hodnota 3/5/10 tisíc Kč.
7. PDF uložit do neveřejné složky, propojit s ID voucheru a objednávky. Zpočátku pouze staff preview + ruční e-mail; automatické odeslání až po schválení, zajištění jednorázového odeslání a obnovitelných retry. Při chybě generování PDF nezakládat další voucher.
8. Online **uplatňování** Google Sheets voucherů ve Wix checkoutu je samostatný následující projekt; nehlásit jej jako hotové. Wix eCommerce Gift Cards provider service plugin dostupný jako SDK/REST může stát za pozdější analýzu.

## Etapy pro agenty
### B0 – UX a technické ověření (bez ostrých zásahů)
- Zmapovat současné tlačítko, adresu stránky a Wix možnosti opakování jejího vzhledu (Wix Studio), zachovat mobilní/desktop design.
- Ověřit prodej běžného digitálního Wix Stores produktu nebo vhodného alternativního checkoutu s volbou nominálu a příjemce. Produkt nesmí být mezi galeriemi šperků; ověřit chování konkrétního setupu, nepředpokládat, že přepínač „skrytý produkt“ stále dovoluje prodej.
- Sepsat minimální Wix Velo backend modul a seznam oprávnění potřebných k eventům / order read.
- Pokud není přístup k Wix Studio nebo Apps Script backendu, vytvořit adapter mock a výslovně uvést **nepropojeno**.

### B1 – testovací Wix → testovací Sheets
- V odděleném Wix testovacím webu/publikované testovací verzi (events.js nefunguje ve Wix Preview) vyzkoušet objednávku, přechod do PAID, API ověření a vydání jednoho testovacího voucheru ve zkušebním Sheets.
- Negativní scénáře: NOT_PAID, dvojklik, dva eventy, souběh dvou triggerů, dvě různá množství, neznámé line item, změněná cena, jiná měna, špatné podpisy, network timeout, rollback po PDF error, refundace.
- Nejdřív test bez zákaznických e-mailů a bez skutečné platby. Neúmyslné vystavení se zaznamená jako stornované/VOID, nemaže se audit.

### B2 – PDF + předání obsluze
- Z vložených grafik 3 000 / 5 000 / 10 000 Kč udělat šablony; vyzkoušet přesné souřadnice QR/textu na 2. straně. Před přidáním grafik do repozitáře zajistit, že existuje oprávnění ke sdílení a že repo není veřejné; **aktuálně je pracovní repo public**, proto grafiky ani citlivé údaje nezapisovat automaticky do něj.
- Test čitelnosti QR mobilní kamerou, tisk na A4 a výsledný dvoustránkový PDF.

### B3 – test podpisu a release
- Nezávislý tester provede regresní test původních create/lookup/redeem, pin/device auth, QR a NIIMBOT; test propojení se skutečnou **testovací** Sheets. Opravený `postMessage` ověřit se skutečným Apps Script iframe, ne jen mock.
- Publikování z testu do ostrého Wixu a ostré evidenční aplikace až po výslovném schválení majitelem, včetně rollback plánu a migrace.

## Oddělení rolí
- **Vývojový agent** připraví B0/B1, testy a návrh Wix Studio UI; pracuje na samostatné větvi a Draft PR.
- **Testovací agent** nezávisle vyhodnotí bezpečnost, idempotenci, duplicity, původní QR/pokladní workflow a výsledky testovací evidence; bez ostrých změn.

## Dokumentace a aktuální omezení
- Wix payment status updated backend event: https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/events/on-order-payment-status-updated
- Wix Velo cart API: staré `wix-stores-frontend.cart.addProducts()` je deprecated; preferovat `wix-ecom-backend.currentCart.addToCurrentCart()` s ověřeným správným kontraktem: https://dev.wix.com/docs/velo/apis/wix-stores-frontend/cart/add-products
- Wix gallery může zobrazovat kategorii, místo všech produktů: https://support.wix.com/en/article/wix-stores-customizing-product-galleries
- Wix Gift Cards provider (pro budoucí online uplatnění): https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/payments/gift-cards/gift-cards-service-plugin/introduction

## Výstup pro další schválení
1. Návrh stránky zachovávající zákaznickou zkušenost se stávajícím tlačítkem.
2. Rozhodnutí vhodného Wix checkout modelu s ověřením, že poukaz není v galeriích šperků a nepoužije automatickou Wix Gift Card emisi.
3. Bezpečný tok a přesné rozhraní Wix → Apps Script + idempotence, PDF a evidence.
4. Test report a seznam otevřených blokérů. **Bez automatického nasazení.**
